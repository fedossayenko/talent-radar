import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService, VacancyExtractionResult } from '../../ai/ai.service';
import { ContentExtractorService, ContentExtractionResult, ExtractionOptions } from './content-extractor.service';
import { HtmlCleanerService, CleaningResult } from './html-cleaner.service';

export interface PipelineInput {
  html: string;
  sourceUrl: string;
  vacancyId?: string;
  options?: PipelineOptions;
}

export interface PipelineOptions {
  contentExtraction?: ExtractionOptions;
  cleaningProfile?: string;
  aiOptions?: {
    skipCache?: boolean;
    forceReprocess?: boolean;
    qualityThreshold?: number;
    maxRetries?: number;
  };
  enableFallback?: boolean;
  performQualityCheck?: boolean;
}

export interface PipelineResult {
  success: boolean;
  vacancyData: VacancyExtractionResult | null;
  
  // Enhanced traceability fields
  cleanedContentSentToAi: string;
  rawAiResponse?: string;
  
  metadata: {
    contentExtraction: ContentExtractionResult;
    htmlCleaning: CleaningResult;
    processing: {
      totalTime: number;
      aiProcessingTime: number;
      cacheHit: boolean;
      qualityCheckPassed: boolean;
      retryCount: number;
    };
    qualityScore: number;
    confidenceScore: number;
  };
  errors: string[];
  warnings: string[];
}

export interface BatchPipelineInput {
  items: Array<{
    id: string;
    html: string;
    sourceUrl: string;
    vacancyId?: string;
  }>;
  options?: PipelineOptions;
}

export interface BatchPipelineResult {
  successful: PipelineResult[];
  failed: Array<{
    id: string;
    error: string;
    sourceUrl: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    averageQualityScore: number;
    averageProcessingTime: number;
    cacheHitRate: number;
  };
}

@Injectable()
export class AiProcessingPipelineService {
  private readonly logger = new Logger(AiProcessingPipelineService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly contentExtractor: ContentExtractorService,
    private readonly htmlCleaner: HtmlCleanerService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Process a single HTML document through the complete AI pipeline
   */
  async process(input: PipelineInput): Promise<PipelineResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    this.logger.debug(`Starting AI pipeline processing`, {
      sourceUrl: input.sourceUrl,
      vacancyId: input.vacancyId,
      htmlLength: input.html.length,
    });

    try {
      // Step 1: Extract content from HTML
      const contentResult = await this.extractContent(input, errors, warnings);
      
      // Step 2: Clean and optimize content
      const cleaningResult = await this.cleanContent(contentResult, input, errors, warnings);
      
      // Step 3: Process with AI for structured extraction (enhanced with raw response)
      const aiProcessingResult = await this.processWithAi(cleaningResult.cleanedText, input, errors, warnings);
      
      // Step 4: Perform quality validation
      const qualityResult = await this.validateQuality(aiProcessingResult.aiResult, contentResult, input, errors, warnings);
      
      const totalTime = Date.now() - startTime;

      const result: PipelineResult = {
        success: aiProcessingResult.aiResult !== null && errors.length === 0,
        vacancyData: qualityResult.passedValidation ? aiProcessingResult.aiResult : null,
        
        // Enhanced traceability: cleaned content and raw response
        cleanedContentSentToAi: cleaningResult.cleanedText,
        rawAiResponse: aiProcessingResult.rawResponse,
        
        metadata: {
          contentExtraction: contentResult,
          htmlCleaning: cleaningResult,
          processing: {
            totalTime,
            aiProcessingTime: qualityResult.aiProcessingTime,
            cacheHit: qualityResult.cacheHit,
            qualityCheckPassed: qualityResult.passedValidation,
            retryCount: qualityResult.retryCount,
          },
          qualityScore: qualityResult.qualityScore,
          confidenceScore: aiProcessingResult.aiResult?.confidenceScore || 0,
        },
        errors,
        warnings,
      };

      this.logger.log(`AI pipeline processing completed`, {
        sourceUrl: input.sourceUrl,
        success: result.success,
        qualityScore: result.metadata.qualityScore,
        confidenceScore: result.metadata.confidenceScore,
        totalTime,
        errors: errors.length,
        warnings: warnings.length,
      });

      return result;

    } catch (error) {
      this.logger.error(`AI pipeline processing failed for ${input.sourceUrl}:`, error);
      
      return {
        success: false,
        vacancyData: null,
        
        // Enhanced traceability: empty values for failed processing
        cleanedContentSentToAi: '',
        rawAiResponse: '',
        
        metadata: {
          contentExtraction: null as any,
          htmlCleaning: null as any,
          processing: {
            totalTime: Date.now() - startTime,
            aiProcessingTime: 0,
            cacheHit: false,
            qualityCheckPassed: false,
            retryCount: 0,
          },
          qualityScore: 0,
          confidenceScore: 0,
        },
        errors: [...errors, error.message],
        warnings,
      };
    }
  }

  /**
   * Process multiple HTML documents in batch
   */
  async processBatch(input: BatchPipelineInput): Promise<BatchPipelineResult> {
    this.logger.log(`Starting batch AI pipeline processing for ${input.items.length} items`);
    
    const results = await Promise.allSettled(
      input.items.map(item => 
        this.process({
          html: item.html,
          sourceUrl: item.sourceUrl,
          vacancyId: item.vacancyId,
          options: input.options,
        })
      )
    );

    const successful: PipelineResult[] = [];
    const failed: Array<{ id: string; error: string; sourceUrl: string }> = [];

    results.forEach((result, index) => {
      const item = input.items[index];
      
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          successful.push(result.value);
        } else {
          failed.push({
            id: item.id,
            error: result.value.errors.join('; '),
            sourceUrl: item.sourceUrl,
          });
        }
      } else {
        failed.push({
          id: item.id,
          error: result.reason?.message || 'Unknown error',
          sourceUrl: item.sourceUrl,
        });
      }
    });

    // Calculate summary statistics
    const summary = {
      total: input.items.length,
      successful: successful.length,
      failed: failed.length,
      averageQualityScore: successful.length > 0 
        ? successful.reduce((sum, r) => sum + r.metadata.qualityScore, 0) / successful.length 
        : 0,
      averageProcessingTime: successful.length > 0
        ? successful.reduce((sum, r) => sum + r.metadata.processing.totalTime, 0) / successful.length
        : 0,
      cacheHitRate: successful.length > 0
        ? successful.filter(r => r.metadata.processing.cacheHit).length / successful.length
        : 0,
    };

    this.logger.log(`Batch AI pipeline processing completed`, summary);

    return {
      successful,
      failed,
      summary,
    };
  }

  /**
   * Extract content from HTML
   */
  private async extractContent(
    input: PipelineInput,
    errors: string[],
    warnings: string[]
  ): Promise<ContentExtractionResult> {
    try {
      const result = await this.contentExtractor.extractContent(
        input.html,
        input.sourceUrl,
        input.options?.contentExtraction
      );

      // Validate content extraction quality
      const qualityCheck = this.contentExtractor.validateContentQuality(result);
      
      if (!qualityCheck.isValid) {
        warnings.push(`Content extraction quality issues: ${qualityCheck.issues.join(', ')}`);
      }

      if (result.cleanedContent.length < 50) {
        warnings.push('Extracted content is very short, may impact AI processing quality');
      }

      return result;

    } catch (error) {
      errors.push(`Content extraction failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean content for AI processing
   */
  private async cleanContent(
    contentResult: ContentExtractionResult,
    input: PipelineInput,
    errors: string[],
    warnings: string[]
  ): Promise<{ cleanedText: string } & CleaningResult> {
    try {
      const cleaningProfile = input.options?.cleaningProfile || 'job-vacancy';
      
      // Use the already extracted content as input to the cleaner
      const cleaned = await this.htmlCleaner.cleanHtml(
        `<div>${contentResult.cleanedContent}</div>`, // Wrap in div for proper parsing
        cleaningProfile
      );

      // Check cleaning effectiveness
      if (cleaned.result.cleanedLength < contentResult.cleanedContent.length * 0.5) {
        warnings.push('Aggressive content cleaning may have removed important information');
      }

      return {
        cleanedText: cleaned.cleanedText,
        ...cleaned.result,
      };

    } catch (error) {
      warnings.push(`Content cleaning failed, using original extracted content: ${error.message}`);
      
      // Return fallback result with original content
      return {
        cleanedText: contentResult.cleanedContent,
        originalLength: contentResult.cleanedContent.length,
        cleanedLength: contentResult.cleanedContent.length,
        removedElements: [],
        preservedElements: [],
        appliedProfile: 'fallback',
        processingTime: 0,
      };
    }
  }

  /**
   * Process content with AI - Enhanced version with raw response
   */
  private async processWithAi(
    cleanedContent: string,
    input: PipelineInput,
    errors: string[],
    warnings: string[]
  ): Promise<{ aiResult: VacancyExtractionResult | null; rawResponse?: string }> {
    const maxRetries = input.options?.aiOptions?.maxRetries || 2;
    let retryCount = 0;
    let lastRawResponse = '';

    while (retryCount <= maxRetries) {
      try {
        // Use the enhanced AI service method that returns both structured result and raw response
        const { result, rawResponse } = await this.aiService.extractVacancyDataWithRawResponse(
          cleanedContent,
          input.sourceUrl,
          {
            skipCache: input.options?.aiOptions?.skipCache || false,
          }
        );

        lastRawResponse = rawResponse; // Keep track of the raw response

        if (result) {
          // Check if retry is needed based on confidence
          const minConfidence = input.options?.aiOptions?.qualityThreshold || 50;
          
          if (result.confidenceScore < minConfidence && retryCount < maxRetries) {
            warnings.push(`Low confidence score (${result.confidenceScore}), retrying...`);
            retryCount++;
            continue;
          }

          return { aiResult: result, rawResponse };
        }

        errors.push('AI extraction returned null result');
        return { aiResult: null, rawResponse: lastRawResponse };

      } catch (error) {
        if (retryCount < maxRetries) {
          warnings.push(`AI processing attempt ${retryCount + 1} failed, retrying: ${error.message}`);
          retryCount++;
          
          // Add exponential backoff delay
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        } else {
          errors.push(`AI processing failed after ${maxRetries + 1} attempts: ${error.message}`);
          return { aiResult: null, rawResponse: lastRawResponse };
        }
      }
    }

    return { aiResult: null, rawResponse: lastRawResponse };
  }

  /**
   * Validate processing quality
   */
  private async validateQuality(
    aiResult: VacancyExtractionResult | null,
    contentResult: ContentExtractionResult,
    input: PipelineInput,
    errors: string[],
    warnings: string[]
  ): Promise<{
    passedValidation: boolean;
    qualityScore: number;
    aiProcessingTime: number;
    cacheHit: boolean;
    retryCount: number;
  }> {
    if (!input.options?.performQualityCheck) {
      return {
        passedValidation: aiResult !== null,
        qualityScore: aiResult?.qualityScore || 0,
        aiProcessingTime: 0, // Would need to track this in AI service
        cacheHit: false, // Would need to track this in AI service
        retryCount: 0, // Would need to track this
      };
    }

    let qualityScore = 0;
    const issues: string[] = [];

    if (!aiResult) {
      issues.push('No AI extraction result');
      return {
        passedValidation: false,
        qualityScore: 0,
        aiProcessingTime: 0,
        cacheHit: false,
        retryCount: 0,
      };
    }

    // Quality checks
    if (aiResult.title) qualityScore += 20;
    if (aiResult.description && aiResult.description.length > 50) qualityScore += 20;
    if (aiResult.requirements && aiResult.requirements.length > 0) qualityScore += 15;
    if (aiResult.location) qualityScore += 10;
    if (aiResult.experienceLevel) qualityScore += 10;
    if (aiResult.salaryMin || aiResult.salaryMax) qualityScore += 10;
    if (aiResult.technologies && aiResult.technologies.length > 0) qualityScore += 10;
    if (aiResult.confidenceScore > 70) qualityScore += 5;

    // Penalty for low confidence
    if (aiResult.confidenceScore < 50) {
      qualityScore -= 20;
      issues.push(`Low AI confidence score: ${aiResult.confidenceScore}`);
    }

    // Check minimum quality threshold
    const minQualityThreshold = this.configService.get<number>('AI_QUALITY_THRESHOLD', 60);
    const passedValidation = qualityScore >= minQualityThreshold;

    if (!passedValidation) {
      warnings.push(`Quality validation failed (score: ${qualityScore}, threshold: ${minQualityThreshold})`);
      issues.forEach(issue => warnings.push(`Quality issue: ${issue}`));
    }

    return {
      passedValidation,
      qualityScore,
      aiProcessingTime: 0, // Will be implemented when AI service metrics are added
      cacheHit: false, // Will be implemented when AI service metrics are added
      retryCount: 0, // Will be implemented when retry logic is added
    };
  }

  /**
   * Get pipeline health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      aiService: boolean;
      contentExtractor: boolean;
      htmlCleaner: boolean;
    };
    lastCheck: Date;
  }> {
    try {
      const aiServiceHealthy = this.aiService.isConfigured();
      const contentExtractorHealthy = true; // Service is always available
      const htmlCleanerHealthy = true; // Service is always available

      const allServicesHealthy = aiServiceHealthy && contentExtractorHealthy && htmlCleanerHealthy;
      const someServicesHealthy = aiServiceHealthy || contentExtractorHealthy || htmlCleanerHealthy;

      return {
        status: allServicesHealthy ? 'healthy' : someServicesHealthy ? 'degraded' : 'unhealthy',
        services: {
          aiService: aiServiceHealthy,
          contentExtractor: contentExtractorHealthy,
          htmlCleaner: htmlCleanerHealthy,
        },
        lastCheck: new Date(),
      };

    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        services: {
          aiService: false,
          contentExtractor: false,
          htmlCleaner: false,
        },
        lastCheck: new Date(),
      };
    }
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<{
    totalProcessed: number;
    successRate: number;
    averageProcessingTime: number;
    cacheHitRate: number;
    averageQualityScore: number;
  }> {
    // This would typically query a metrics service or database
    // For now, return placeholder values
    return {
      totalProcessed: 0,
      successRate: 0,
      averageProcessingTime: 0,
      cacheHitRate: 0,
      averageQualityScore: 0,
    };
  }
}