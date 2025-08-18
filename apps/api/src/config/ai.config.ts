import { registerAs } from '@nestjs/config';

export const aiConfig = registerAs('ai', () => {
  // Simplified configuration with backward compatibility
  const config = {
    // Core settings
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.AI_MODEL_DEFAULT || 'gpt-5-nano',
    timeout: parseInt(process.env.AI_TIMEOUT || '60000', 10),
    maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3', 10),
    rateLimit: parseInt(process.env.AI_RATE_LIMIT || '10', 10),
    
    // Content processing
    maxContentLength: parseInt(process.env.AI_MAX_CONTENT_LENGTH || '10000', 10),
    
    // Caching
    enableCaching: process.env.AI_ENABLE_CACHING !== 'false',
    cacheExpiryHours: parseInt(process.env.AI_CACHE_EXPIRY_HOURS || '24', 10),
    
    // Content hashing configuration
    contentHashing: {
      enableUrlHashing: true,
      enableContentHashing: true,
      contentCleaningBeforeHash: true,
    },
    
    // Token optimization configuration
    tokenOptimization: {
      maxContentLength: parseInt(process.env.AI_MAX_CONTENT_LENGTH || '10000', 10),
      enableCompression: true,
      prioritizeKeywords: true,
    },
    
    // Main prompt template for vacancy extraction
    vacancyPrompt: `Extract structured job vacancy data from this content:

{content}

Source: {sourceUrl}

Return JSON with ALL these fields (use null for missing values):
- title: string
- company: string  
- location: string
- salaryMin: number (null if not specified)
- salaryMax: number (null if not specified)
- currency: string (null if not specified)
- experienceLevel: string (junior/mid/senior/lead/principal/not_specified)
- employmentType: string (full-time/part-time/contract/internship/freelance)
- workModel: string (remote/hybrid/office/not_specified)
- description: string
- requirements: array of strings
- responsibilities: array of strings
- technologies: array of strings
- benefits: array of strings
- educationLevel: string
- industry: string
- teamSize: string
- companySize: string
- applicationDeadline: string (ISO date format)
- postedDate: string (ISO date format) 
- confidenceScore: number (0-100, your confidence in extraction accuracy)
- qualityScore: number (0-100, overall quality of job posting)
- extractionMetadata: {
    sourceType: "scraped_html",
    contentLength: number,
    hasStructuredData: boolean,
    language: "en"
  }

RESPOND ONLY WITH VALID JSON. No explanations.`,
  };
  
  // Backward compatibility - map old nested structure to new flat structure
  return {
    ...config,
    // Legacy support for nested openai config
    openai: {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      defaultModel: config.model,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    },
    // Legacy support for models config
    models: {
      scraping: {
        vacancy: config.model,
        contentCleaning: config.model,
        qualityAssessment: config.model,
      },
    },
    // Legacy support for prompts config
    prompts: {
      vacancyExtraction: {
        temperature: 0.1,
        maxTokens: 2000,
        template: config.vacancyPrompt,
      },
      contentCleaning: {
        temperature: 0.1,
        maxTokens: 1000,
        template: `Clean and extract the main job posting content from this HTML, removing navigation, ads, and irrelevant content:

{content}

Return only the cleaned job posting content.`,
      },
      qualityAssessment: {
        temperature: 0.1,
        maxTokens: 500,
        template: `Assess the quality of this job posting content and return a JSON object with overallScore (0-100) and issues array:

{content}

Consider completeness, clarity, and usefulness for job seekers.`,
      },
    },
  };
});