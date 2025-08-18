import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { RedisService } from '../../common/redis/redis.service';
import { HashingUtil } from '../../common/utils/hashing.util';

export interface VacancyExtractionResult {
  title: string | null;
  company: string | null;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  experienceLevel: string | null;
  employmentType: string | null;
  workModel: string | null;
  description: string | null;
  requirements: string[] | null;
  responsibilities: string[] | null;
  technologies: string[] | null;
  benefits: string[] | null;
  educationLevel: string | null;
  industry: string | null;
  teamSize: string | null;
  companySize: string | null;
  applicationDeadline: string | null;
  postedDate: string | null;
  confidenceScore: number;
  qualityScore: number;
  extractionMetadata: {
    sourceType: string;
    contentLength: number;
    hasStructuredData: boolean;
    language: string;
  };
}


@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openai: OpenAI;
  private readonly config: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.config = this.configService.get('ai');
    
    if (!this.config?.openai?.apiKey) {
      this.logger.warn('OpenAI API key not configured. AI features will be disabled.');
      return;
    }

    this.openai = new OpenAI({
      apiKey: this.config.openai.apiKey,
      baseURL: this.config.openai.baseUrl,
      timeout: this.config.openai.timeout,
      maxRetries: this.config.openai.maxRetries,
    });

    this.logger.log('AiService initialized with OpenAI integration');
  }

  /**
   * Extract structured vacancy data from job posting content
   */
  async extractVacancyData(
    content: string,
    sourceUrl: string,
    options: { skipCache?: boolean } = {},
  ): Promise<VacancyExtractionResult | null> {
    try {
      // Generate content hash for caching using unified utility
      const contentHash = HashingUtil.generateContentHash({
        url: sourceUrl,
        content: content,
        useUrlHashing: this.config.contentHashing.enableUrlHashing,
        useContentHashing: this.config.contentHashing.enableContentHashing,
        cleanBeforeHash: this.config.contentHashing.contentCleaningBeforeHash,
      });

      // Check cache first
      if (!options.skipCache && this.config.enableCaching) {
        const cachedResult = await this.getCachedExtraction(contentHash);
        if (cachedResult) {
          this.logger.log(`Cache hit for content hash: ${contentHash}`);
          return cachedResult;
        }
      }

      // Clean and optimize content
      const optimizedContent = await this.optimizeContentForExtraction(content);
      
      // Prepare prompt
      const prompt = this.config.prompts.vacancyExtraction.template
        .replace('{content}', optimizedContent)
        .replace('{sourceUrl}', sourceUrl);

      // Make API call
      const apiCall: any = {
        model: this.config.models.scraping.vacancy,
        messages: [
          {
            role: 'user' as const,
            content: prompt,
          },
        ],
        max_completion_tokens: this.config.prompts.vacancyExtraction.maxTokens,
      };

      // Model-specific configurations
      const isGpt5Nano = this.config.models.scraping.vacancy.includes('gpt-5-nano');
      
      if (!isGpt5Nano) {
        // Standard models support temperature and json_object format
        apiCall.temperature = this.config.prompts.vacancyExtraction.temperature;
        apiCall.response_format = { type: 'json_object' as const };
      }
      // GPT-5 Nano uses default temperature and doesn't support structured response format

      const response = await this.openai.chat.completions.create(apiCall);

      const extractedData = this.parseExtractionResponse(response.choices[0]?.message?.content, isGpt5Nano);
      
      if (!extractedData) {
        this.logger.warn('Failed to parse AI extraction response');
        return null;
      }

      // Validate quality threshold
      if (extractedData.confidenceScore < 70) {
        this.logger.warn(`Low confidence extraction (${extractedData.confidenceScore}%) for URL: ${sourceUrl}`);
      }

      // Cache the result
      if (this.config.enableCaching) {
        await this.cacheExtraction(contentHash, extractedData);
      }

      this.logger.log(`Successfully extracted vacancy data with ${extractedData.confidenceScore}% confidence`);
      return extractedData;

    } catch (error) {
      this.logger.error(`Failed to extract vacancy data from ${sourceUrl}:`, error.message);
      return null;
    }
  }

  /**
   * Clean content to remove noise and optimize for extraction
   */
  async cleanContent(content: string): Promise<string> {
    try {
      const prompt = this.config.prompts.contentCleaning.template
        .replace('{content}', content);

      const apiCall: any = {
        model: this.config.models.scraping.contentCleaning,
        messages: [
          {
            role: 'user' as const,
            content: prompt,
          },
        ],
        max_completion_tokens: this.config.prompts.contentCleaning.maxTokens,
      };

      // Only add temperature if the model supports it (GPT-5 Nano only supports default temperature)
      if (!this.config.models.scraping.contentCleaning.includes('gpt-5-nano')) {
        apiCall.temperature = this.config.prompts.contentCleaning.temperature;
      }

      const response = await this.openai.chat.completions.create(apiCall);

      return response.choices[0]?.message?.content || content;
    } catch (error) {
      this.logger.warn('Content cleaning failed, using original content:', error.message);
      return content;
    }
  }

  /**
   * Assess the quality of job posting content
   */
  async assessContentQuality(content: string): Promise<any> {
    try {
      const prompt = this.config.prompts.qualityAssessment.template
        .replace('{content}', content);

      const apiCall: any = {
        model: this.config.models.scraping.qualityAssessment,
        messages: [
          {
            role: 'user' as const,
            content: prompt,
          },
        ],
        max_completion_tokens: this.config.prompts.qualityAssessment.maxTokens,
      };

      // Model-specific configurations for quality assessment
      const isGpt5Nano = this.config.models.scraping.qualityAssessment.includes('gpt-5-nano');
      
      if (!isGpt5Nano) {
        apiCall.temperature = this.config.prompts.qualityAssessment.temperature;
        apiCall.response_format = { type: 'json_object' as const };
      }

      const response = await this.openai.chat.completions.create(apiCall);

      return JSON.parse(response.choices[0]?.message?.content || '{}');
    } catch (error) {
      this.logger.warn('Quality assessment failed:', error.message);
      return { overallScore: 50, issues: ['Quality assessment failed'] };
    }
  }


  /**
   * Optimize content for token efficiency
   */
  private async optimizeContentForExtraction(content: string): Promise<string> {
    const maxLength = this.config.tokenOptimization.maxContentLength;
    
    if (content.length <= maxLength) {
      return content;
    }

    if (this.config.tokenOptimization.enableContentTruncation) {
      // Smart truncation: keep important sections
      if (this.config.tokenOptimization.preserveImportantSections) {
        return this.smartTruncateContent(content, maxLength);
      } else {
        // Simple truncation
        return content.substring(0, maxLength);
      }
    }

    return content;
  }

  /**
   * Smart content truncation preserving important sections
   */
  private smartTruncateContent(content: string, maxLength: number): string {
    // Priority sections (regex patterns for important content)
    const importantPatterns = [
      /job.{0,20}(title|position|role)/gi,
      /responsibilit(y|ies)/gi,
      /requirement(s)?/gi,
      /qualifications?/gi,
      /experience/gi,
      /salary|compensation|pay/gi,
      /benefit(s)?/gi,
      /location/gi,
      /remote|hybrid|office/gi,
    ];

    // Extract important sections first
    let importantContent = '';
    let remainingContent = content;

    for (const pattern of importantPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          const index = remainingContent.indexOf(match);
          if (index !== -1) {
            // Extract context around the match
            const start = Math.max(0, index - 100);
            const end = Math.min(remainingContent.length, index + 200);
            const section = remainingContent.substring(start, end);
            importantContent += section + '\n';
            remainingContent = remainingContent.replace(section, '');
          }
        }
      }
    }

    // Add remaining content if there's space
    const remainingSpace = maxLength - importantContent.length;
    if (remainingSpace > 0 && remainingContent.length > 0) {
      importantContent += remainingContent.substring(0, remainingSpace);
    }

    return importantContent.substring(0, maxLength);
  }

  /**
   * Parse AI extraction response
   */
  private parseExtractionResponse(response: string | undefined, isUnstructuredModel: boolean = false): VacancyExtractionResult | null {
    if (!response) return null;

    try {
      // Log the raw response for debugging
      this.logger.debug('Raw AI response:', response);
      
      let parsed: any;
      
      if (isUnstructuredModel) {
        // For models like GPT-5 Nano that don't support structured output
        // Try to extract JSON from the response text
        parsed = this.extractJsonFromText(response);
      } else {
        // Standard JSON parsing for structured models
        parsed = JSON.parse(response);
      }
      
      if (!parsed) {
        this.logger.warn('Failed to extract structured data from response');
        return null;
      }
      
      // Validate required fields
      if (!parsed.confidenceScore || parsed.confidenceScore < 0 || parsed.confidenceScore > 100) {
        this.logger.warn('Invalid confidence score in extraction response');
        this.logger.debug('Parsed response:', JSON.stringify(parsed, null, 2));
        return null;
      }

      return parsed as VacancyExtractionResult;
    } catch (error) {
      this.logger.error('Failed to parse extraction response:', error.message);
      this.logger.error('Raw response that failed to parse:', response);
      return null;
    }
  }

  /**
   * Extract JSON from unstructured text response (for models that don't support structured output)
   */
  private extractJsonFromText(text: string): any | null {
    try {
      // First try to find JSON block in the text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // If no JSON found, try to parse the entire response as JSON
      return JSON.parse(text);
    } catch {
      this.logger.warn('Could not extract JSON from text response, using fallback parsing');
      
      // Fallback: create a basic structure if the model provided readable text
      if (text.trim().length > 0) {
        return {
          title: null,
          company: null,
          location: null,
          description: text.trim(),
          confidenceScore: 50, // Default low confidence for unstructured parsing
          qualityScore: 50,
          extractionMetadata: {
            sourceType: "unstructured_text",
            contentLength: text.length,
            hasStructuredData: false,
            language: "en"
          }
        };
      }
      
      return null;
    }
  }

  /**
   * Cache extraction result
   */
  private async cacheExtraction(contentHash: string, extractionResult: VacancyExtractionResult): Promise<void> {
    try {
      const cacheKey = `vacancy_extraction:${contentHash}`;
      const expirySeconds = this.config.contentHashing.hashCacheExpiryDays * 24 * 60 * 60;
      
      await this.redisService.set(
        cacheKey,
        JSON.stringify(extractionResult),
        expirySeconds,
      );
    } catch (error) {
      this.logger.warn('Failed to cache extraction result:', error.message);
    }
  }

  /**
   * Get cached extraction result
   */
  private async getCachedExtraction(contentHash: string): Promise<VacancyExtractionResult | null> {
    try {
      const cacheKey = `vacancy_extraction:${contentHash}`;
      const cached = await this.redisService.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached) as VacancyExtractionResult;
      }
      
      return null;
    } catch (error) {
      this.logger.warn('Failed to get cached extraction result:', error.message);
      return null;
    }
  }

  /**
   * Check if AI service is properly configured
   */
  isConfigured(): boolean {
    return !!this.config?.openai?.apiKey && !!this.openai;
  }

  /**
   * Invalidate cache entries created with old hashing algorithm
   * This should be called once after the hashing unification to clean up inconsistent cache entries
   */
  async invalidateOldHashedCache(): Promise<{ invalidated: number; errors: number }> {
    const invalidated = 0;
    let errors = 0;
    
    try {
      // Note: This is a simplified implementation
      // In production, you might want to scan in batches for large cache sets
      this.logger.log('Starting cache invalidation for old hashed entries...');
      
      // This would require implementing a way to identify old vs new hash formats
      // For now, we'll log the action for manual intervention if needed
      this.logger.warn('Cache invalidation requires manual intervention or a background job to identify old hash formats');
      
      return { invalidated, errors };
      
    } catch (error) {
      this.logger.error('Failed to invalidate old hashed cache entries:', error.message);
      errors++;
      return { invalidated, errors };
    }
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(): Promise<any> {
    // Implementation for tracking API usage, costs, etc.
    return {
      totalRequests: 0,
      totalTokens: 0,
      averageConfidence: 0,
      cacheHitRate: 0,
    };
  }
}