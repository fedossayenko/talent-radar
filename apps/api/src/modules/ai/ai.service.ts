import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { RedisService } from '../../common/redis/redis.service';
import { HashingUtil } from '../../common/utils/hashing.util';
import { AiRequestLoggerService } from '../../common/ai-logging/ai-request-logger.service';
import { ContentExtractorService } from '../scraper/services/content-extractor.service';

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

export interface CompanyProfileAnalysisResult {
  name: string | null;
  description: string | null;
  industry: string | null;
  size: string | null;
  location: string | null;
  website: string | null;
  employeeCount: number | null;
  founded: number | null;
  technologies: string[] | null;
  benefits: string[] | null;
  values: string[] | null;
  hiringProcess: string[] | null;
  pros: string[] | null;
  cons: string[] | null;
  cultureScore: number | null;
  workLifeBalance: number | null;
  careerGrowth: number | null;
  techCulture: number | null;
  confidenceScore: number;
  dataCompleteness: number;
}

export interface CompanyWebsiteAnalysisResult {
  name: string | null;
  description: string | null;
  industry: string | null;
  location: string | null;
  website: string | null;
  technologies: string[] | null;
  benefits: string[] | null;
  values: string[] | null;
  workEnvironment: string | null;
  pros: string[] | null;
  cons: string[] | null;
  cultureScore: number | null;
  workLifeBalance: number | null;
  careerGrowth: number | null;
  techCulture: number | null;
  confidenceScore: number;
  dataCompleteness: number;
}

export interface ConsolidatedCompanyAnalysisResult {
  name: string | null;
  description: string | null;
  industry: string | null;
  size: string | null;
  location: string | null;
  website: string | null;
  employeeCount: number | null;
  founded: number | null;
  technologies: string[] | null;
  benefits: string[] | null;
  values: string[] | null;
  workEnvironment: string | null;
  hiringProcess: string[] | null;
  growthOpportunities: string[] | null;
  pros: string[] | null;
  cons: string[] | null;
  interviewProcess: string | null;
  cultureScore: number | null;
  retentionRate: number | null;
  workLifeBalance: number | null;
  careerGrowth: number | null;
  salaryCompetitiveness: number | null;
  benefitsScore: number | null;
  techCulture: number | null;
  recommendationScore: number | null;
  confidenceScore: number;
  dataCompleteness: number;
  sourceDataSummary: string | null;
}


@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openai: OpenAI;
  private readonly config: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly aiRequestLogger: AiRequestLoggerService,
    private readonly contentExtractor: ContentExtractorService,
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
    
    // Log AI request logger status
    if (this.aiRequestLogger.isEnabled()) {
      this.logger.log(`AI request logging enabled. Files stored in: ${this.aiRequestLogger.getLogDirectoryPath()}`);
    }
  }

  /**
   * Wrapper method for OpenAI API calls that includes request/response logging
   */
  private async callOpenAiWithLogging(
    methodName: string,
    apiCall: any
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const startTime = Date.now();
    let requestId: string;

    try {
      // Log the request
      requestId = await this.aiRequestLogger.logRequest(methodName, apiCall);
      
      // Make the API call
      const response = await this.openai.chat.completions.create(apiCall);
      
      // Log the response
      const duration = Date.now() - startTime;
      await this.aiRequestLogger.logResponse(requestId, response, duration);
      
      return response;
    } catch (error) {
      // Log the error
      const duration = Date.now() - startTime;
      await this.aiRequestLogger.logResponse(requestId!, null, duration, error);
      throw error;
    }
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
      const optimizedContent = await this.optimizeContentForExtraction(content, sourceUrl);
      
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

      const response = await this.callOpenAiWithLogging('extractVacancyData', apiCall);

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
   * Analyze company profile data from dev.bg
   */
  async analyzeCompanyProfile(
    content: string,
    sourceUrl: string,
    options: { skipCache?: boolean } = {},
  ): Promise<CompanyProfileAnalysisResult | null> {
    try {
      // Generate content hash for caching
      const contentHash = HashingUtil.generateContentHash({
        url: sourceUrl,
        content: content,
        useUrlHashing: this.config.contentHashing.enableUrlHashing,
        useContentHashing: this.config.contentHashing.enableContentHashing,
        cleanBeforeHash: this.config.contentHashing.contentCleaningBeforeHash,
      });

      // Check cache first
      if (!options.skipCache && this.config.enableCaching) {
        const cachedResult = await this.getCachedCompanyAnalysis(contentHash, 'profile');
        if (cachedResult) {
          this.logger.log(`Cache hit for company profile analysis: ${contentHash}`);
          return cachedResult;
        }
      }

      // Clean and optimize content
      const optimizedContent = await this.optimizeContentForExtraction(content, sourceUrl);
      
      // Prepare prompt
      const prompt = this.config.prompts.companyProfile.template
        .replace('{content}', optimizedContent)
        .replace('{sourceUrl}', sourceUrl);

      // Make API call
      const apiCall: any = {
        model: this.config.models.scraping.vacancy, // Reuse vacancy model for now
        messages: [
          {
            role: 'user' as const,
            content: prompt,
          },
        ],
        max_completion_tokens: this.config.prompts.companyProfile.maxTokens,
      };

      // Model-specific configurations
      const isGpt5Nano = this.config.models.scraping.vacancy.includes('gpt-5-nano');
      
      if (!isGpt5Nano) {
        apiCall.temperature = this.config.prompts.companyProfile.temperature;
        apiCall.response_format = { type: 'json_object' as const };
      }

      const response = await this.callOpenAiWithLogging('analyzeCompanyProfile', apiCall);
      const analysisResult = this.parseCompanyAnalysisResponse(response.choices[0]?.message?.content, isGpt5Nano);
      
      if (!analysisResult) {
        this.logger.warn('Failed to parse company profile analysis response');
        return null;
      }

      // Cache the result
      if (this.config.enableCaching) {
        await this.cacheCompanyAnalysis(contentHash, 'profile', analysisResult);
      }

      this.logger.log(`Successfully analyzed company profile with ${analysisResult.confidenceScore}% confidence`);
      return analysisResult;

    } catch (error) {
      this.logger.error(`Failed to analyze company profile from ${sourceUrl}:`, error.message);
      return null;
    }
  }

  /**
   * Analyze company website content
   */
  async analyzeCompanyWebsite(
    content: string,
    sourceUrl: string,
    options: { skipCache?: boolean } = {},
  ): Promise<CompanyWebsiteAnalysisResult | null> {
    try {
      // Generate content hash for caching
      const contentHash = HashingUtil.generateContentHash({
        url: sourceUrl,
        content: content,
        useUrlHashing: this.config.contentHashing.enableUrlHashing,
        useContentHashing: this.config.contentHashing.enableContentHashing,
        cleanBeforeHash: this.config.contentHashing.contentCleaningBeforeHash,
      });

      // Check cache first
      if (!options.skipCache && this.config.enableCaching) {
        const cachedResult = await this.getCachedCompanyAnalysis(contentHash, 'website');
        if (cachedResult) {
          this.logger.log(`Cache hit for company website analysis: ${contentHash}`);
          return cachedResult;
        }
      }

      // Clean and optimize content
      const optimizedContent = await this.optimizeContentForExtraction(content, sourceUrl);
      
      // Prepare prompt
      const prompt = this.config.prompts.companyWebsite.template
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
        max_completion_tokens: this.config.prompts.companyWebsite.maxTokens,
      };

      // Model-specific configurations
      const isGpt5Nano = this.config.models.scraping.vacancy.includes('gpt-5-nano');
      
      if (!isGpt5Nano) {
        apiCall.temperature = this.config.prompts.companyWebsite.temperature;
        apiCall.response_format = { type: 'json_object' as const };
      }

      const response = await this.callOpenAiWithLogging('analyzeCompanyWebsite', apiCall);
      const analysisResult = this.parseCompanyAnalysisResponse(response.choices[0]?.message?.content, isGpt5Nano, 'website');
      
      if (!analysisResult) {
        this.logger.warn('Failed to parse company website analysis response');
        return null;
      }

      // Cache the result
      if (this.config.enableCaching) {
        await this.cacheCompanyAnalysis(contentHash, 'website', analysisResult);
      }

      this.logger.log(`Successfully analyzed company website with ${analysisResult.confidenceScore}% confidence`);
      return analysisResult;

    } catch (error) {
      this.logger.error(`Failed to analyze company website from ${sourceUrl}:`, error.message);
      return null;
    }
  }

  /**
   * Create consolidated company analysis from multiple sources
   */
  async consolidateCompanyAnalysis(
    companyName: string,
    devBgData?: CompanyProfileAnalysisResult,
    websiteData?: CompanyWebsiteAnalysisResult,
    options: { skipCache?: boolean } = {},
  ): Promise<ConsolidatedCompanyAnalysisResult | null> {
    try {
      if (!devBgData && !websiteData) {
        this.logger.warn('No data provided for company analysis consolidation');
        return null;
      }

      // Generate cache key based on input data
      const cacheKey = HashingUtil.generateContentHash({
        url: `consolidated-${companyName}`,
        content: JSON.stringify({ devBgData, websiteData }),
        useUrlHashing: true,
        useContentHashing: true,
        cleanBeforeHash: false,
      });

      // Check cache first
      if (!options.skipCache && this.config.enableCaching) {
        const cachedResult = await this.getCachedCompanyAnalysis(cacheKey, 'consolidated');
        if (cachedResult) {
          this.logger.log(`Cache hit for consolidated company analysis: ${companyName}`);
          return cachedResult;
        }
      }

      // Prepare prompt with data from both sources
      const prompt = this.config.prompts.consolidatedCompany.template
        .replace('{devBgData}', devBgData ? JSON.stringify(devBgData, null, 2) : 'No dev.bg data available')
        .replace('{websiteData}', websiteData ? JSON.stringify(websiteData, null, 2) : 'No website data available')
        .replace('{companyName}', companyName);

      // Make API call
      const apiCall: any = {
        model: this.config.models.scraping.vacancy,
        messages: [
          {
            role: 'user' as const,
            content: prompt,
          },
        ],
        max_completion_tokens: this.config.prompts.consolidatedCompany.maxTokens,
      };

      // Model-specific configurations
      const isGpt5Nano = this.config.models.scraping.vacancy.includes('gpt-5-nano');
      
      if (!isGpt5Nano) {
        apiCall.temperature = this.config.prompts.consolidatedCompany.temperature;
        apiCall.response_format = { type: 'json_object' as const };
      }

      const response = await this.callOpenAiWithLogging('consolidateCompanyAnalysis', apiCall);
      const analysisResult = this.parseCompanyAnalysisResponse(response.choices[0]?.message?.content, isGpt5Nano, 'consolidated');
      
      if (!analysisResult) {
        this.logger.warn('Failed to parse consolidated company analysis response');
        return null;
      }

      // Cache the result
      if (this.config.enableCaching) {
        await this.cacheCompanyAnalysis(cacheKey, 'consolidated', analysisResult);
      }

      this.logger.log(`Successfully consolidated company analysis for ${companyName} with ${analysisResult.confidenceScore}% confidence`);
      return analysisResult;

    } catch (error) {
      this.logger.error(`Failed to consolidate company analysis for ${companyName}:`, error.message);
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

      const response = await this.callOpenAiWithLogging('cleanContent', apiCall);

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

      const response = await this.callOpenAiWithLogging('assessContentQuality', apiCall);

      return JSON.parse(response.choices[0]?.message?.content || '{}');
    } catch (error) {
      this.logger.warn('Quality assessment failed:', error.message);
      return { overallScore: 50, issues: ['Quality assessment failed'] };
    }
  }


  /**
   * Optimize content for token efficiency
   */
  private async optimizeContentForExtraction(content: string, sourceUrl?: string): Promise<string> {
    try {
      // Use the enhanced preprocessing pipeline for HTML content
      if (content.includes('<html') || content.includes('<div') || content.includes('<p')) {
        this.logger.debug('Processing HTML content with enhanced preprocessing pipeline');
        
        const preprocessed = await this.contentExtractor.preprocessHtml(content, sourceUrl || 'unknown', {
          convertToMarkdown: true,
          extractSpecificSections: true,
          optimizeForAI: true,
          maxTokens: this.config.tokenOptimization.maxContentLength / 4, // Convert chars to tokens
          preserveStructure: true,
        });

        this.logger.debug('Preprocessing completed', {
          originalSize: preprocessed.metadata.originalSize,
          processedSize: preprocessed.metadata.processedSize,
          compressionRatio: preprocessed.metadata.compressionRatio,
          tokensEstimate: preprocessed.metadata.tokensEstimate,
          sectionsFound: preprocessed.metadata.sectionCount,
          language: preprocessed.metadata.language,
        });

        // Return the markdown content (70% size reduction achieved)
        return preprocessed.markdown || preprocessed.html;
      }
      
      // Fallback to legacy optimization for non-HTML content
      const maxLength = this.config.tokenOptimization.maxContentLength;
      
      if (content.length <= maxLength) {
        return content;
      }

      // Simple truncation for non-HTML content
      return content.substring(0, maxLength);
      
    } catch (error) {
      this.logger.error('Failed to preprocess content, falling back to simple truncation:', error);
      
      // Fallback to simple truncation
      const maxLength = this.config.tokenOptimization.maxContentLength;
      return content.length > maxLength ? content.substring(0, maxLength) : content;
    }
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
      // Log the raw response for debugging - force to info level for visibility
      this.logger.log('=== AI RESPONSE DEBUGGING ===');
      this.logger.log(`Raw AI response length: ${response?.length || 0}`);
      this.logger.log(`Raw AI response: ${response?.substring(0, 500)}...`);
      this.logger.log(`Is unstructured model: ${isUnstructuredModel}`);
      
      // GPT-5 Nano produces valid JSON, just doesn't support response_format parameter
      // All models should use standard JSON parsing
      const parsed = JSON.parse(response);
      
      if (!parsed) {
        this.logger.log('Failed to extract structured data from response');
        this.logger.log(`Response that failed: ${response}`);
        return null;
      }
      
      this.logger.log(`Successfully parsed response. Type: ${typeof parsed}`);
      this.logger.log(`Parsed keys: ${Object.keys(parsed || {}).join(', ')}`);
      this.logger.log(`Confidence score: ${parsed?.confidenceScore}`);
      this.logger.log(`Quality score: ${parsed?.qualityScore}`);
      
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
    this.logger.log('=== EXTRACTING JSON FROM UNSTRUCTURED TEXT ===');
    this.logger.log(`Text length: ${text.length}`);
    this.logger.log(`First 200 chars: ${text.substring(0, 200)}`);
    
    try {
      // First try to find JSON block in the text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      this.logger.log(`JSON match found: ${!!jsonMatch}`);
      
      if (jsonMatch) {
        this.logger.log(`JSON match content: ${jsonMatch[0].substring(0, 200)}...`);
        const parsed = JSON.parse(jsonMatch[0]);
        this.logger.log(`Successfully parsed JSON match`);
        return parsed;
      }
      
      // If no JSON found, try to parse the entire response as JSON
      this.logger.log('No JSON match found, trying to parse entire text as JSON');
      const parsed = JSON.parse(text);
      this.logger.log(`Successfully parsed entire text as JSON`);
      return parsed;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
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
   * Parse company analysis response (handles different analysis types)
   */
  private parseCompanyAnalysisResponse(response: string | undefined, _isUnstructuredModel: boolean = false, analysisType: 'profile' | 'website' | 'consolidated' = 'profile'): any | null {
    if (!response) return null;

    try {
      // GPT-5 Nano produces valid JSON, just doesn't support response_format parameter
      // All models should use standard JSON parsing
      const parsed = JSON.parse(response);
      
      if (!parsed) {
        this.logger.warn(`Failed to extract structured data from company ${analysisType} analysis response`);
        return null;
      }
      
      // Validate required fields based on analysis type
      if (!parsed.confidenceScore || parsed.confidenceScore < 0 || parsed.confidenceScore > 100) {
        this.logger.warn(`Invalid confidence score in company ${analysisType} analysis response`);
        return null;
      }

      return parsed;
    } catch (error) {
      this.logger.error(`Failed to parse company ${analysisType} analysis response:`, error.message);
      this.logger.error('Raw response that failed to parse:', response);
      return null;
    }
  }

  /**
   * Cache company analysis result
   */
  private async cacheCompanyAnalysis(contentHash: string, analysisType: string, analysisResult: any): Promise<void> {
    try {
      const cacheKey = `company_analysis_${analysisType}:${contentHash}`;
      const expirySeconds = this.config.contentHashing.hashCacheExpiryDays * 24 * 60 * 60;
      
      await this.redisService.set(
        cacheKey,
        JSON.stringify(analysisResult),
        expirySeconds,
      );
    } catch (error) {
      this.logger.warn(`Failed to cache company ${analysisType} analysis result:`, error.message);
    }
  }

  /**
   * Get cached company analysis result
   */
  private async getCachedCompanyAnalysis(contentHash: string, analysisType: string): Promise<any | null> {
    try {
      const cacheKey = `company_analysis_${analysisType}:${contentHash}`;
      const cached = await this.redisService.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      return null;
    } catch (error) {
      this.logger.warn(`Failed to get cached company ${analysisType} analysis result:`, error.message);
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