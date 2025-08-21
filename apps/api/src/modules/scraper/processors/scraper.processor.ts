import { Process, Processor } from '@nestjs/bull';
import { Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Bull from 'bull';
import { ScraperService, ScrapingResult, CompanyAnalysisJobData } from '../scraper.service';
import { AiService, VacancyExtractionResult } from '../../ai/ai.service';
import { AiProcessingPipelineService, PipelineResult } from '../services/ai-processing-pipeline.service';
import { VacancyService } from '../../vacancy/vacancy.service';
import { CompanyService } from '../../company/company.service';
import { CompanySourceService } from '../../company/company-source.service';
import { CompanyProfileScraper } from '../services/company-profile.scraper';

export interface ScrapingJobData {
  source: string;
  options?: any;
  triggeredBy?: string;
}

export interface AiExtractionJobData {
  vacancyId?: string;
  contentHash: string;
  content: string;
  sourceUrl: string;
  priority: number; // 1-10, higher = more priority
  retryCount?: number;
  maxRetries?: number;
  batchId?: string; // For batch processing
}

export interface BatchProcessingJobData {
  batchId: string;
  urls: string[];
  priority: number;
  options?: {
    maxConcurrent?: number;
    delayBetweenRequests?: number;
    enableAiExtraction?: boolean;
    qualityThreshold?: number;
  };
}

export interface HealthCheckJobData {
  timestamp?: number; // Optional timestamp for health check jobs
}

export type AllJobData = ScrapingJobData | AiExtractionJobData | BatchProcessingJobData | HealthCheckJobData | CompanyAnalysisJobData;

@Processor('scraper')
export class ScraperProcessor implements OnModuleInit {
  private readonly logger = new Logger(ScraperProcessor.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly scraperService: ScraperService,
    private readonly aiService: AiService,
    private readonly aiPipelineService: AiProcessingPipelineService,
    private readonly vacancyService: VacancyService,
    private readonly companyService: CompanyService,
    private readonly companySourceService: CompanySourceService,
    private readonly companyProfileScraper: CompanyProfileScraper,
  ) {
    this.logger.log('ScraperProcessor initialized');
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('🚀 ScraperProcessor initializing...');
    
    // Check if scraper is enabled via configuration
    const isScrapingEnabled = this.configService?.get<boolean>('SCRAPER_ENABLED', true);
    const scraperConfig = this.configService?.get('scraper');
    
    this.logger.log(`Configuration: SCRAPER_ENABLED=${isScrapingEnabled}, scraper.enabled=${scraperConfig?.enabled}`);
    
    // Log all processor methods that should be registered
    const processorMethods = [
      'scrape-dev-bg',
      'health-check', 
      'ai-extraction',
      'batch-processing',
      'company-analysis'
    ];
    
    this.logger.log(`✅ ScraperProcessor ready - registered processors: ${processorMethods.join(', ')}`);
  }


  @Process('scrape-dev-bg')
  async handleDevBgScraping(job: Bull.Job<ScrapingJobData>): Promise<ScrapingResult> {
    const { data } = job;
    
    this.logger.log(`🔥 PROCESSOR CALLED - Starting dev.bg scraping job ${job.id}`, {
      triggeredBy: data.triggeredBy,
      options: data.options,
    });

    try {
      // Update job progress
      await job.progress(10);

      // Execute scraping with options
      const result = await this.scraperService.scrapeDevBg(data.options);

      // Update job progress
      await job.progress(90);

      this.logger.log(`Dev.bg scraping job ${job.id} completed successfully`, {
        totalJobsFound: result.totalJobsFound,
        newVacancies: result.newVacancies,
        updatedVacancies: result.updatedVacancies,
        newCompanies: result.newCompanies,
        errors: result.errors.length,
        duration: result.duration,
      });

      // Final progress update
      await job.progress(100);

      return result;

    } catch (error) {
      this.logger.error(`Dev.bg scraping job ${job.id} failed:`, error);
      
      // Re-throw to mark job as failed
      throw error;
    }
  }

  @Process('health-check')
  async handleHealthCheck(job: Bull.Job<HealthCheckJobData>): Promise<{ status: string; timestamp: Date }> {
    this.logger.log(`Processing health check job ${job.id}`);
    
    return {
      status: 'healthy',
      timestamp: new Date(),
    };
  }

  @Process('ai-extraction')
  async handleAiExtraction(job: Bull.Job<AiExtractionJobData>): Promise<PipelineResult> {
    const { data } = job;
    
    this.logger.log(`🤖 Starting AI extraction job ${job.id}`, {
      contentHash: data.contentHash,
      sourceUrl: data.sourceUrl,
      priority: data.priority,
      batchId: data.batchId,
    });

    try {
      // Update job progress
      await job.progress(10);

      // Check if AI service is configured
      if (!this.aiService.isConfigured()) {
        this.logger.warn('AI service not configured, skipping extraction');
        return {
          success: false,
          vacancyData: null,
          metadata: {
            contentExtraction: null as any,
            htmlCleaning: null as any,
            processing: {
              totalTime: 0,
              aiProcessingTime: 0,
              cacheHit: false,
              qualityCheckPassed: false,
              retryCount: 0,
            },
            qualityScore: 0,
            confidenceScore: 0,
          },
          errors: ['AI service not configured'],
          warnings: [],
        };
      }

      await job.progress(30);

      // Process using the comprehensive AI pipeline
      const pipelineResult = await this.aiPipelineService.process({
        html: data.content,
        sourceUrl: data.sourceUrl,
        vacancyId: data.vacancyId,
        options: {
          aiOptions: {
            skipCache: false,
            qualityThreshold: 60,
            maxRetries: data.maxRetries || 2,
          },
          performQualityCheck: true,
          enableFallback: true,
        },
      });

      await job.progress(80);

      // Update vacancy with extracted data if successful and vacancy ID provided
      if (pipelineResult.success && pipelineResult.vacancyData && data.vacancyId) {
        await this.updateVacancyWithPipelineData(data.vacancyId, pipelineResult, data.contentHash);
      }

      await job.progress(100);

      this.logger.log(`AI extraction job ${job.id} completed`, {
        success: pipelineResult.success,
        qualityScore: pipelineResult.metadata.qualityScore,
        confidenceScore: pipelineResult.metadata.confidenceScore,
        processingTime: pipelineResult.metadata.processing.totalTime,
        errors: pipelineResult.errors.length,
        warnings: pipelineResult.warnings.length,
      });

      return pipelineResult;

    } catch (error) {
      this.logger.error(`AI extraction job ${job.id} failed:`, error);
      
      // Check if we should retry
      const retryCount = (data.retryCount || 0) + 1;
      const maxRetries = data.maxRetries || 3;
      
      if (retryCount < maxRetries) {
        this.logger.log(`Retrying AI extraction job ${job.id} (attempt ${retryCount}/${maxRetries})`);
        
        // Re-queue with updated retry count
        throw new Error(`Retry attempt ${retryCount}/${maxRetries}: ${error.message}`);
      }
      
      throw error;
    }
  }

  @Process('batch-processing')
  async handleBatchProcessing(job: Bull.Job<BatchProcessingJobData>): Promise<any> {
    const { data } = job;
    
    this.logger.log(`Starting batch processing job ${job.id}`, {
      batchId: data.batchId,
      urlCount: data.urls.length,
      priority: data.priority,
    });

    const results = {
      batchId: data.batchId,
      totalUrls: data.urls.length,
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [] as any[],
      duration: 0,
    };

    const startTime = Date.now();

    try {
      const { maxConcurrent = 2, delayBetweenRequests = 1000 } = data.options || {};
      
      // Process URLs in batches to respect rate limits
      for (let i = 0; i < data.urls.length; i += maxConcurrent) {
        const urlBatch = data.urls.slice(i, i + maxConcurrent);
        
        // Update progress
        await job.progress(Math.round((i / data.urls.length) * 100));
        
        // Process batch concurrently
        const batchPromises = urlBatch.map(async (url, index) => {
          try {
            // Add delay between requests
            if (index > 0 && delayBetweenRequests > 0) {
              await this.delay(delayBetweenRequests);
            }
            
            // Here you would implement the actual scraping logic
            // For now, this is a placeholder
            await this.processSingleUrl(url, data);
            
            results.successful++;
            return { url, success: true };
            
          } catch (error) {
            this.logger.warn(`Failed to process URL ${url}:`, error.message);
            results.failed++;
            results.errors.push({ url, error: error.message });
            return { url, success: false, error: error.message };
          } finally {
            results.processed++;
          }
        });

        await Promise.allSettled(batchPromises);
      }

      results.duration = Date.now() - startTime;
      await job.progress(100);

      this.logger.log(`Batch processing job ${job.id} completed`, results);
      return results;

    } catch (error) {
      results.duration = Date.now() - startTime;
      this.logger.error(`Batch processing job ${job.id} failed:`, error);
      throw error;
    }
  }

  @Process('company-analysis')
  async handleCompanyAnalysis(job: Bull.Job<CompanyAnalysisJobData>): Promise<any> {
    const { data } = job;
    
    this.logger.log(`Starting company analysis job ${job.id}`, {
      companyId: data.companyId,
      sourceSite: data.sourceSite,
      sourceUrl: data.sourceUrl,
      analysisType: data.analysisType,
      priority: data.priority,
    });

    try {
      // Update job progress
      await job.progress(10);

      // Check if AI service is configured
      if (!this.aiService.isConfigured()) {
        this.logger.warn('AI service not configured, skipping company analysis');
        return {
          success: false,
          error: 'AI service not configured',
          companyId: data.companyId,
          sourceSite: data.sourceSite,
        };
      }

      await job.progress(20);

      // Scrape company content
      let scrapingResult;
      if (data.analysisType === 'profile' && data.sourceSite === 'dev.bg') {
        scrapingResult = await this.companyProfileScraper.scrapeDevBgCompanyProfile(data.sourceUrl);
      } else if (data.analysisType === 'website') {
        scrapingResult = await this.companyProfileScraper.scrapeCompanyWebsite(data.sourceUrl);
      } else {
        throw new Error(`Unsupported analysis type: ${data.analysisType} for source: ${data.sourceSite}`);
      }

      if (!scrapingResult.success) {
        this.logger.warn(`Failed to scrape company content: ${scrapingResult.error}`);
        // Mark source as invalid
        await this.companySourceService.markSourceAsInvalid(
          data.companyId, 
          data.sourceSite, 
          scrapingResult.error
        );
        
        return {
          success: false,
          error: scrapingResult.error,
          companyId: data.companyId,
          sourceSite: data.sourceSite,
        };
      }

      await job.progress(50);

      // Save scraped content to CompanySource
      await this.companySourceService.saveCompanySource({
        companyId: data.companyId,
        sourceSite: data.sourceSite,
        sourceUrl: data.sourceUrl,
        scrapedContent: scrapingResult.data?.rawContent,
        isValid: true,
      });

      await job.progress(70);

      // Analyze content with AI
      let analysisResult;
      const content = scrapingResult.data?.rawContent || '';
      
      if (data.analysisType === 'profile') {
        analysisResult = await this.aiService.analyzeCompanyProfile(content, data.sourceUrl);
      } else {
        analysisResult = await this.aiService.analyzeCompanyWebsite(content, data.sourceUrl);
      }

      if (!analysisResult) {
        this.logger.warn(`AI analysis failed for company ${data.companyId}`);
        return {
          success: false,
          error: 'AI analysis failed',
          companyId: data.companyId,
          sourceSite: data.sourceSite,
        };
      }

      await job.progress(90);

      // Save analysis results to company
      await this.saveCompanyAnalysis(data.companyId, analysisResult, data.sourceSite);

      await job.progress(100);

      this.logger.log(`Company analysis job ${job.id} completed successfully`, {
        companyId: data.companyId,
        sourceSite: data.sourceSite,
        confidenceScore: analysisResult.confidenceScore,
        dataCompleteness: analysisResult.dataCompleteness,
      });

      return {
        success: true,
        companyId: data.companyId,
        sourceSite: data.sourceSite,
        analysisResult,
      };

    } catch (error) {
      this.logger.error(`Company analysis job ${job.id} failed:`, error);
      
      // Check if we should retry
      const retryCount = (job.opts.attempts || 1) - (job.attemptsMade || 0);
      const maxRetries = data.maxRetries || 3;
      
      if (retryCount > 0 && retryCount < maxRetries) {
        this.logger.log(`Retrying company analysis job ${job.id} (attempt ${retryCount}/${maxRetries})`);
        throw new Error(`Retry attempt ${retryCount}/${maxRetries}: ${error.message}`);
      }
      
      throw error;
    }
  }

  /**
   * Save company analysis results to database
   */
  private async saveCompanyAnalysis(companyId: string, analysisResult: any, sourceSite: string): Promise<void> {
    try {
      // Update company with basic info if available
      if (analysisResult.name || analysisResult.description || analysisResult.industry) {
        const companyUpdateData: any = {};
        
        if (analysisResult.name) companyUpdateData.name = analysisResult.name;
        if (analysisResult.description) companyUpdateData.description = analysisResult.description;
        if (analysisResult.industry) companyUpdateData.industry = analysisResult.industry;
        if (analysisResult.location) companyUpdateData.location = analysisResult.location;
        if (analysisResult.website) companyUpdateData.website = analysisResult.website;
        if (analysisResult.size) companyUpdateData.size = analysisResult.size;
        if (analysisResult.founded) companyUpdateData.founded = analysisResult.founded;
        if (analysisResult.employeeCount) companyUpdateData.employeeCount = analysisResult.employeeCount;

        await this.companyService.update(companyId, companyUpdateData);
      }

      // Create or update company analysis
      const analysisData = {
        companyId,
        analysisSource: sourceSite,
        recommendationScore: analysisResult.recommendationScore || null,
        pros: analysisResult.pros ? JSON.stringify(analysisResult.pros) : null,
        cons: analysisResult.cons ? JSON.stringify(analysisResult.cons) : null,
        cultureScore: analysisResult.cultureScore || null,
        workLifeBalance: analysisResult.workLifeBalance || null,
        careerGrowth: analysisResult.careerGrowth || null,
        salaryCompetitiveness: analysisResult.salaryCompetitiveness || null,
        benefitsScore: analysisResult.benefitsScore || null,
        techCulture: analysisResult.techCulture || null,
        retentionRate: analysisResult.retentionRate || null,
        workEnvironment: analysisResult.workEnvironment || null,
        interviewProcess: analysisResult.interviewProcess || null,
        growthOpportunities: analysisResult.growthOpportunities ? JSON.stringify(analysisResult.growthOpportunities) : null,
        benefits: analysisResult.benefits ? JSON.stringify(analysisResult.benefits) : null,
        techStack: analysisResult.technologies ? JSON.stringify(analysisResult.technologies) : null,
        companyValues: analysisResult.values ? JSON.stringify(analysisResult.values) : null,
        confidenceScore: analysisResult.confidenceScore || 0,
        rawData: JSON.stringify(analysisResult),
      };

      await this.companyService.createOrUpdateAnalysis(analysisData);
      
      this.logger.log(`Saved company analysis for company ${companyId} from ${sourceSite}`);

    } catch (error) {
      this.logger.error(`Failed to save company analysis for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Update vacancy with AI-extracted data (legacy method for compatibility)
   */
  private async updateVacancyWithAiData(
    vacancyId: string,
    extractionResult: VacancyExtractionResult,
    contentHash: string
  ): Promise<void> {
    try {
      const updateData = {
        title: extractionResult.title || undefined,
        description: extractionResult.description || undefined,
        requirements: extractionResult.requirements ? JSON.stringify(extractionResult.requirements) : undefined,
        responsibilities: extractionResult.responsibilities ? JSON.stringify(extractionResult.responsibilities) : undefined,
        location: extractionResult.location || undefined,
        salaryMin: extractionResult.salaryMin || undefined,
        salaryMax: extractionResult.salaryMax || undefined,
        currency: extractionResult.currency || undefined,
        experienceLevel: extractionResult.experienceLevel || undefined,
        employmentType: extractionResult.employmentType || undefined,
        workModel: extractionResult.workModel || undefined,
        technologies: extractionResult.technologies ? JSON.stringify(extractionResult.technologies) : undefined,
        benefits: extractionResult.benefits ? JSON.stringify(extractionResult.benefits) : undefined,
        educationLevel: extractionResult.educationLevel || undefined,
        industry: extractionResult.industry || undefined,
        teamSize: extractionResult.teamSize || undefined,
        companySize: extractionResult.companySize || undefined,
        applicationDeadline: extractionResult.applicationDeadline ? new Date(extractionResult.applicationDeadline) : undefined,
        contentHash,
        extractionConfidence: extractionResult.confidenceScore,
        qualityScore: extractionResult.qualityScore,
        extractionMetadata: JSON.stringify(extractionResult.extractionMetadata),
        aiExtractedData: JSON.stringify(extractionResult),
      };

      // Remove undefined values
      const cleanedUpdateData = Object.entries(updateData).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

      await this.vacancyService.update(vacancyId, cleanedUpdateData);
      this.logger.log(`Updated vacancy ${vacancyId} with AI-extracted data`);

    } catch (error) {
      this.logger.error(`Failed to update vacancy ${vacancyId} with AI data:`, error);
      throw error;
    }
  }

  /**
   * Update vacancy with pipeline result data
   */
  private async updateVacancyWithPipelineData(
    vacancyId: string,
    pipelineResult: PipelineResult,
    contentHash: string
  ): Promise<void> {
    try {
      const extractionResult = pipelineResult.vacancyData;
      if (!extractionResult) {
        throw new Error('No vacancy data in pipeline result');
      }

      const updateData = {
        title: extractionResult.title || undefined,
        description: extractionResult.description || undefined,
        requirements: extractionResult.requirements ? JSON.stringify(extractionResult.requirements) : undefined,
        responsibilities: extractionResult.responsibilities ? JSON.stringify(extractionResult.responsibilities) : undefined,
        location: extractionResult.location || undefined,
        salaryMin: extractionResult.salaryMin || undefined,
        salaryMax: extractionResult.salaryMax || undefined,
        currency: extractionResult.currency || undefined,
        experienceLevel: extractionResult.experienceLevel || undefined,
        employmentType: extractionResult.employmentType || undefined,
        workModel: extractionResult.workModel || undefined,
        technologies: extractionResult.technologies ? JSON.stringify(extractionResult.technologies) : undefined,
        benefits: extractionResult.benefits ? JSON.stringify(extractionResult.benefits) : undefined,
        educationLevel: extractionResult.educationLevel || undefined,
        industry: extractionResult.industry || undefined,
        teamSize: extractionResult.teamSize || undefined,
        companySize: extractionResult.companySize || undefined,
        applicationDeadline: extractionResult.applicationDeadline ? new Date(extractionResult.applicationDeadline) : undefined,
        contentHash,
        extractionConfidence: pipelineResult.metadata.confidenceScore,
        qualityScore: pipelineResult.metadata.qualityScore,
        extractionMetadata: JSON.stringify({
          ...extractionResult.extractionMetadata,
          pipelineProcessing: pipelineResult.metadata.processing,
          contentExtraction: {
            originalLength: pipelineResult.metadata.contentExtraction?.metadata?.originalLength,
            cleanedLength: pipelineResult.metadata.contentExtraction?.metadata?.cleanedLength,
            compressionRatio: pipelineResult.metadata.contentExtraction?.metadata?.compressionRatio,
          },
          htmlCleaning: {
            appliedProfile: pipelineResult.metadata.htmlCleaning?.appliedProfile,
            removedElements: pipelineResult.metadata.htmlCleaning?.removedElements?.length || 0,
            processingTime: pipelineResult.metadata.htmlCleaning?.processingTime,
          },
          errors: pipelineResult.errors,
          warnings: pipelineResult.warnings,
        }),
        aiExtractedData: JSON.stringify(extractionResult),
        rawContent: pipelineResult.metadata.contentExtraction?.content,
      };

      // Remove undefined values
      const cleanedUpdateData = Object.entries(updateData).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

      await this.vacancyService.update(vacancyId, cleanedUpdateData);
      
      this.logger.log(`Updated vacancy ${vacancyId} with pipeline-extracted data`, {
        qualityScore: pipelineResult.metadata.qualityScore,
        confidenceScore: pipelineResult.metadata.confidenceScore,
        processingTime: pipelineResult.metadata.processing.totalTime,
        fieldsUpdated: Object.keys(cleanedUpdateData).length,
      });

    } catch (error) {
      this.logger.error(`Failed to update vacancy ${vacancyId} with pipeline data:`, error);
      throw error;
    }
  }

  /**
   * Process a single URL for batch processing
   */
  private async processSingleUrl(_url: string, _batchData: BatchProcessingJobData): Promise<void> {
    // This is a placeholder - you would implement actual scraping logic here
    // For example:
    // 1. Fetch the page content
    // 2. Clean the content
    // 3. If AI extraction is enabled, extract data
    // 4. Save to database
    
    await this.delay(100); // Simulate processing time
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}