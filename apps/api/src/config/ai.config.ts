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

    // Company profile analysis prompt for dev.bg profiles
    companyProfilePrompt: `Analyze this company profile from dev.bg and extract structured information:

{content}

Source URL: {sourceUrl}

Return JSON with ALL these fields (use null for missing values):
- name: string
- description: string (clean summary of what the company does)
- industry: string
- size: string (1-10/11-50/51-200/201-500/501-1000/1000+)
- location: string
- website: string (company's main website if mentioned)
- employeeCount: number (estimated number of employees)
- founded: number (founding year if mentioned)
- technologies: array of strings (tech stack used by company)
- benefits: array of strings (employee benefits mentioned)
- values: array of strings (company values/culture points)
- hiringProcess: array of strings (interview/hiring process steps if described)
- pros: array of strings (top 5 positive aspects of working there)
- cons: array of strings (top 5 potential concerns or challenges)
- cultureScore: number (0-10, rating for company culture based on available info)
- workLifeBalance: number (0-10, rating for work-life balance)
- careerGrowth: number (0-10, rating for career growth opportunities)
- techCulture: number (0-10, rating for technical culture and innovation)
- confidenceScore: number (0-100, confidence in analysis accuracy)
- dataCompleteness: number (0-100, how complete the source data was)

RESPOND ONLY WITH VALID JSON. No explanations.`,

    // Company website analysis prompt
    companyWebsitePrompt: `Analyze this company website content and extract insights:

{content}

Source URL: {sourceUrl}

Return JSON with ALL these fields (use null for missing values):
- name: string
- description: string (what the company does - from about/mission sections)
- industry: string
- location: string (headquarters/main office)
- website: string (the source URL)
- technologies: array of strings (tech stack from engineering/tech sections)
- benefits: array of strings (employee benefits from careers sections)
- values: array of strings (company values/mission/vision statements)
- workEnvironment: string (description of work environment/culture)
- pros: array of strings (top 5 reasons to work there based on content)
- cons: array of strings (top 5 potential concerns based on missing info or challenges)
- cultureScore: number (0-10, rating for company culture)
- workLifeBalance: number (0-10, rating based on flexibility/remote work mentions)
- careerGrowth: number (0-10, rating based on learning/development mentions)
- techCulture: number (0-10, rating for engineering/innovation culture)
- confidenceScore: number (0-100, confidence in analysis accuracy)
- dataCompleteness: number (0-100, how complete the source data was)

RESPOND ONLY WITH VALID JSON. No explanations.`,

    // Consolidated company analysis prompt (merges multiple sources)
    consolidatedCompanyPrompt: `Analyze and consolidate information about this company from multiple sources:

DEV.BG PROFILE DATA:
{devBgData}

COMPANY WEBSITE DATA:
{websiteData}

Company Name: {companyName}

Create a comprehensive analysis by merging information from all sources. Return JSON with ALL these fields:
- name: string
- description: string (comprehensive description combining all sources)
- industry: string
- size: string (1-10/11-50/51-200/201-500/501-1000/1000+)
- location: string
- website: string
- employeeCount: number
- founded: number
- technologies: array of strings (comprehensive tech stack)
- benefits: array of strings (all benefits mentioned across sources)
- values: array of strings (company values/culture/mission)
- workEnvironment: string (work culture description)
- hiringProcess: array of strings (interview process if available)
- growthOpportunities: array of strings (career development opportunities)
- pros: array of strings (top 5-7 reasons to work there)
- cons: array of strings (top 3-5 potential concerns or challenges)
- interviewProcess: string (description of interview process)
- cultureScore: number (0-10, overall culture rating)
- retentionRate: number (0-100, estimated employee retention based on info)
- workLifeBalance: number (0-10, work-life balance rating)
- careerGrowth: number (0-10, career growth opportunities rating)
- salaryCompetitiveness: number (0-10, estimated salary competitiveness)
- benefitsScore: number (0-10, benefits package rating)
- techCulture: number (0-10, technical culture and innovation rating)
- recommendationScore: number (0-10, overall recommendation to work there)
- confidenceScore: number (0-100, overall confidence in consolidated analysis)
- dataCompleteness: number (0-100, completeness of available data)
- sourceDataSummary: string (summary of what sources provided the data)

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
        maxTokens: 4000,
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
      companyProfile: {
        temperature: 0.1,
        maxTokens: 2500,
        template: config.companyProfilePrompt,
      },
      companyWebsite: {
        temperature: 0.1,
        maxTokens: 2500,
        template: config.companyWebsitePrompt,
      },
      consolidatedCompany: {
        temperature: 0.1,
        maxTokens: 3000,
        template: config.consolidatedCompanyPrompt,
      },
    },
  };
});