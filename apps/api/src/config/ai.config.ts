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
    
    // Request logging configuration
    requestLogging: {
      enabled: process.env.AI_REQUEST_LOGGING_ENABLED === 'true',
      logDirectory: process.env.AI_LOG_DIRECTORY || './logs/ai-requests',
      retentionDays: parseInt(process.env.AI_LOG_RETENTION_DAYS || '30', 10),
      includeResponses: process.env.AI_LOG_INCLUDE_RESPONSES !== 'false',
    },
    
    // Main prompt template for vacancy extraction
    vacancyPrompt: `Extract structured job vacancy data from this content:

{content}

Source: {sourceUrl}

SALARY EXTRACTION INSTRUCTIONS:
Look for salary information in ALL possible formats:
- "4,500 - 9,500 BGN net" → salaryMin: 4500, salaryMax: 9500, currency: "BGN"
- "€50,000-€60,000" → salaryMin: 50000, salaryMax: 60000, currency: "EUR"
- "Up to $120,000" → salaryMin: null, salaryMax: 120000, currency: "USD"
- "2000 лв месечно" → salaryMin: 2000, salaryMax: null, currency: "BGN"
- "Monthly: 3000-5000 лева" → salaryMin: 3000, salaryMax: 5000, currency: "BGN"
- "От 5000 до 8000 лв" → salaryMin: 5000, salaryMax: 8000, currency: "BGN"

Bulgarian currency parsing: "лв"/"лева"/"BGN" = "BGN"
Always extract exact numbers, remove thousand separators (commas).

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

    // Ultra-efficient company profile prompt for structured data (token-optimized)
    companyProfilePrompt: `Enhance structured company data with insights:

INPUT: {content}

Return JSON with enhanced fields:
- name, description, industry, size, location, website, employeeCount, founded: (from input)
- technologies, benefits, values: (cleaned arrays from input)
- hiringProcess: [3-4 typical steps based on company type/size]
- pros: [3 key advantages based on tech/benefits/values]
- cons: [2-3 potential concerns from missing data/context]
- cultureScore, workLifeBalance, careerGrowth, techCulture: (0-10, derive from input quality)
- confidenceScore, dataCompleteness: (0-100, based on input completeness)

Focus on value-add insights only. JSON only.`,

    // Token-optimized company website prompt
    companyWebsitePrompt: `Extract key company data from website:

{content}
URL: {sourceUrl}

CRITICAL: Return null for name if this is a job board/aggregator, not company site.

CONTACT EXTRACTION (Priority):
Look for: phone numbers, email addresses, physical addresses, business license numbers

JSON fields:
- name: (actual company, NOT job board)
- description, industry, location, website: (key info)
- contactEmail: email address (info@, contact@, etc.)
- contactPhone: phone number with country code
- address: full physical address 
- services: array of services offered
- companyType: "agency", "product", "startup", "enterprise"
- businessLicense: any license/registration numbers
- clientProjects: array of notable projects/clients mentioned
- foundedYear: founding year or years in business
- employeeCount: number of employees/team size
- technologies, benefits, values: (arrays)
- workEnvironment: (brief culture desc)
- pros: [top 3], cons: [top 3]
- cultureScore, workLifeBalance, careerGrowth, techCulture: (0-10)
- confidenceScore, dataCompleteness: (0-100)

JSON only.`,

    // Ultra-efficient consolidated analysis prompt  
    consolidatedCompanyPrompt: `Merge company data from sources:

DEV.BG: {devBgData}
WEBSITE: {websiteData}
NAME: {companyName}

Consolidate into comprehensive JSON:
- name: (use NAME param, NOT job board)
- description, industry, size, location, website, employeeCount, founded: (best from sources)
- technologies, benefits, values: (merged arrays)
- workEnvironment, interviewProcess: (combined insights)
- hiringProcess, growthOpportunities: (derived from data)
- pros: [top 5], cons: [top 3]
- All scores (0-10): cultureScore, retentionRate, workLifeBalance, careerGrowth, salaryCompetitiveness, benefitsScore, techCulture, recommendationScore
- confidenceScore, dataCompleteness: (0-100)
- sourceDataSummary: (brief)

JSON only.`,

    // Ultra-efficient scoring prompt for structured data
    companyStructuredScoringPrompt: `Score company from structured data (JSON only):

INPUT: {structuredData}

Return JSON:
- overallScore: (0-100)
- categories: {developerExperience, cultureValues, growthOpportunities, compensation, workLifeBalance, stability}: (0-10 each)
- insights: {strengths: [3], concerns: [2-3], recommendations: [3]}
- confidence: (0-100)

Modern tech/remote = higher scores.`,

    // NEW: Token-optimized structured data validation prompt  
    structuredDataValidationPrompt: `Validate and enhance extracted structured data:

INPUT: {extractedData}

Return cleaned JSON with:
- All original fields (validated)
- technologies: (clean tech array, remove duplicates)
- benefits: (standardized benefits)
- values: (clear company values)
- workModel: (remote/hybrid/office/unknown)
- dataQuality: (0-100, extraction quality score)
- missingFields: [array of critical missing fields]

Enhance data quality, preserve structure.`,
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
    // Legacy support for prompts config (optimized with reduced token limits)
    prompts: {
      vacancyExtraction: {
        temperature: 0.1,
        maxTokens: 4000, // Keep high for vacancy extraction
        template: config.vacancyPrompt,
      },
      contentCleaning: {
        temperature: 0.1,
        maxTokens: 500, // Reduced from 1000 
        template: `Clean job posting HTML, remove navigation/ads:

{content}

Return clean content only.`,
      },
      qualityAssessment: {
        temperature: 0.1,
        maxTokens: 300, // Reduced from 500
        template: `Rate job posting quality (JSON: {overallScore: 0-100, issues: []}):

{content}`,
      },
      companyProfile: {
        temperature: 0.1,
        maxTokens: 1200, // Reduced from 2500 (52% reduction)
        template: config.companyProfilePrompt,
      },
      companyWebsite: {
        temperature: 0.1,
        maxTokens: 800, // Reduced from 2500 (68% reduction) 
        template: config.companyWebsitePrompt,
      },
      consolidatedCompany: {
        temperature: 0.1,
        maxTokens: 1000, // Reduced from 3000 (67% reduction)
        template: config.consolidatedCompanyPrompt,
      },
      // NEW: Structured data validation prompt
      structuredDataValidation: {
        temperature: 0.1,
        maxTokens: 600,
        template: config.structuredDataValidationPrompt,
      },
      // NEW: Ultra-efficient scoring prompt
      structuredScoring: {
        temperature: 0.1,
        maxTokens: 400,
        template: config.companyStructuredScoringPrompt,
      },
    },
  };
});