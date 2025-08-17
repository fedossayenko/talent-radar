import { registerAs } from '@nestjs/config';

export const aiConfig = registerAs('ai', () => ({
  // OpenAI configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    defaultModel: process.env.AI_MODEL_DEFAULT || 'gpt-5-nano',
    timeout: parseInt(process.env.AI_TIMEOUT || '60000', 10),
    maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3', 10),
  },
  
  // OpenRouter configuration (fallback)
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: process.env.AI_MODEL_DEFAULT || 'anthropic/claude-3-haiku',
    timeout: parseInt(process.env.AI_TIMEOUT || '30000', 10),
  },
  
  // Rate limiting
  rateLimit: parseInt(process.env.AI_RATE_LIMIT || '10', 10), // requests per minute
  
  // Model configurations
  models: {
    scraping: {
      vacancy: process.env.AI_MODEL_VACANCY_SCRAPING || 'gpt-5-nano',
      contentCleaning: process.env.AI_MODEL_CONTENT_CLEANING || 'gpt-5-nano',
      qualityAssessment: process.env.AI_MODEL_QUALITY_ASSESSMENT || 'gpt-5-nano',
    },
    analysis: {
      company: process.env.AI_MODEL_COMPANY || 'anthropic/claude-3-haiku',
      vacancy: process.env.AI_MODEL_VACANCY || 'anthropic/claude-3-haiku',
      cv: process.env.AI_MODEL_CV || 'anthropic/claude-3-haiku',
    },
    generation: {
      coverLetter: process.env.AI_MODEL_COVER_LETTER || 'anthropic/claude-3-haiku',
      cvImprovement: process.env.AI_MODEL_CV_IMPROVEMENT || 'anthropic/claude-3-haiku',
    },
    scoring: {
      default: process.env.AI_MODEL_SCORING || 'anthropic/claude-3-haiku',
    },
  },
  
  // Prompt templates
  prompts: {
    vacancyExtraction: {
      temperature: 0.1,
      maxTokens: 2000,
      template: `You are an expert job vacancy data extraction system. Extract structured information from the provided job posting content.

IMPORTANT RULES:
1. Only extract information that is explicitly mentioned in the content
2. If information is not available, return null for that field
3. Return a confidence score (0-100) for the overall extraction quality
4. Normalize salary to monthly amounts in local currency
5. Standardize location names (city, country format)
6. Extract ALL technologies, tools, and skills mentioned

INPUT CONTENT:
{content}

SOURCE URL: {sourceUrl}

EXTRACT THE FOLLOWING JSON STRUCTURE:
{
  "title": "string (job title)",
  "company": "string (company name)",
  "location": "string (city, country or remote)",
  "salaryMin": "number (monthly minimum in local currency, null if not specified)",
  "salaryMax": "number (monthly maximum in local currency, null if not specified)",
  "currency": "string (salary currency code, null if no salary)",
  "experienceLevel": "string (junior|mid|senior|lead|principal|entry|not_specified)",
  "employmentType": "string (full-time|part-time|contract|internship|freelance|not_specified)",
  "workModel": "string (remote|hybrid|office|not_specified)",
  "description": "string (job description, max 500 words)",
  "requirements": "array of strings (key requirements and qualifications)",
  "responsibilities": "array of strings (main job responsibilities)",
  "technologies": "array of strings (all technologies, tools, languages mentioned)",
  "benefits": "array of strings (benefits and perks mentioned)",
  "educationLevel": "string (high_school|bachelor|master|phd|not_specified)",
  "industry": "string (industry/sector)",
  "teamSize": "string (team size if mentioned)",
  "companySize": "string (startup|small|medium|large|enterprise|not_specified)",
  "applicationDeadline": "string (ISO date if mentioned, null otherwise)",
  "postedDate": "string (ISO date if found, null otherwise)",
  "confidenceScore": "number (0-100, overall extraction confidence)",
  "qualityScore": "number (0-100, job posting quality assessment)",
  "extractionMetadata": {
    "sourceType": "string (job_board|company_website|social_media|other)",
    "contentLength": "number (character count of input)",
    "hasStructuredData": "boolean (if content appears well-structured)",
    "language": "string (detected language code)"
  }
}

RESPOND ONLY WITH THE JSON OBJECT, NO ADDITIONAL TEXT.`,
    },
    
    contentCleaning: {
      temperature: 0.1,
      maxTokens: 1500,
      template: `You are a content cleaning system for job postings. Remove irrelevant content and return only the core job posting information.

REMOVE:
- Navigation menus, headers, footers
- Advertisements and promotional content
- Comments and user-generated content
- Related job suggestions
- Company-wide information not specific to this job
- Cookie notices and legal disclaimers
- Social media widgets and sharing buttons

KEEP:
- Job title and description
- Company name and brief description
- Requirements and qualifications
- Responsibilities and duties
- Salary and benefits information
- Location and work arrangements
- Application instructions

INPUT CONTENT:
{content}

Return the cleaned content maintaining the original structure but removing noise. Keep all job-relevant information intact.`,
    },
    
    qualityAssessment: {
      temperature: 0.1,
      maxTokens: 500,
      template: `Assess the quality of this job posting content and provide a score.

CONTENT:
{content}

CRITERIA (0-100 scale each):
- Completeness: Does it have title, description, requirements, company info?
- Clarity: Is the information clear and well-structured?
- Specificity: Are requirements and responsibilities specific?
- Relevance: Is all content relevant to the job posting?
- Professionalism: Does it appear to be a legitimate job posting?

Return JSON:
{
  "overallScore": "number (0-100)",
  "completeness": "number (0-100)",
  "clarity": "number (0-100)",
  "specificity": "number (0-100)",
  "relevance": "number (0-100)",
  "professionalism": "number (0-100)",
  "issues": "array of strings (specific problems identified)",
  "recommendations": "array of strings (suggestions for improvement)"
}`,
    },
    
    companyAnalysis: {
      temperature: 0.3,
      maxTokens: 1000,
      template: `Analyze the following company and provide insights about:
1. Company size and growth stage
2. Engineering culture and practices
3. Technology stack and tools
4. Work-life balance indicators
5. Career growth opportunities
6. Compensation competitiveness

Company: {companyName}
Website: {companyWebsite}
Description: {companyDescription}
Job postings: {jobPostings}

Provide a structured JSON response with scores (1-10) for each category.`,
    },
    
    vacancyScoring: {
      temperature: 0.2,
      maxTokens: 500,
      template: `Score this job vacancy based on the candidate's preferences and profile:

Vacancy: {vacancyTitle}
Company: {companyName}
Description: {vacancyDescription}
Requirements: {vacancyRequirements}
Salary: {vacancySalary}
Location: {vacancyLocation}

Candidate Profile:
- Skills: {candidateSkills}
- Experience: {candidateExperience}
- Preferences: {candidatePreferences}

Provide scores (0-100) for:
1. Skill match
2. Experience fit
3. Salary alignment
4. Location preference
5. Career growth potential

Return as JSON with explanation for each score.`,
    },
    
    cvImprovement: {
      temperature: 0.4,
      maxTokens: 1500,
      template: `Analyze and suggest improvements for this CV targeting {targetRole} positions:

Current CV:
{cvContent}

Target Role: {targetRole}
Target Company: {targetCompany}

Provide specific suggestions for:
1. Skills to highlight or add
2. Experience description improvements
3. Missing sections or information
4. Overall structure and presentation
5. Keywords to include for ATS systems

Return as JSON with categorized suggestions and priority levels.`,
    },
    
    coverLetterGeneration: {
      temperature: 0.6,
      maxTokens: 800,
      template: `Generate a personalized cover letter for this job application:

Job Details:
- Position: {vacancyTitle}
- Company: {companyName}
- Description: {vacancyDescription}
- Requirements: {vacancyRequirements}

Candidate Details:
- Name: {candidateName}
- Background: {candidateBackground}
- Key Skills: {candidateSkills}
- Notable Achievements: {candidateAchievements}

Company Information:
- About: {companyDescription}
- Culture: {companyCulture}
- Recent News: {companyNews}

Tone: {tone} (professional/enthusiastic/casual)
Length: {length} (short/medium/long)

Generate a compelling cover letter that:
1. Shows genuine interest in the company
2. Highlights relevant experience and skills
3. Demonstrates knowledge of the company
4. Explains why the candidate is a good fit
5. Includes a strong call to action`,
    },
  },
  
  // Content hashing and caching
  contentHashing: {
    algorithm: 'sha256',
    enableUrlHashing: process.env.AI_ENABLE_URL_HASHING !== 'false',
    enableContentHashing: process.env.AI_ENABLE_CONTENT_HASHING !== 'false',
    contentCleaningBeforeHash: process.env.AI_CLEAN_BEFORE_HASH !== 'false',
    hashCacheExpiryDays: parseInt(process.env.AI_HASH_CACHE_EXPIRY_DAYS || '7', 10),
  },
  
  // Token optimization
  tokenOptimization: {
    maxContentLength: parseInt(process.env.AI_MAX_CONTENT_LENGTH || '10000', 10),
    enableContentTruncation: process.env.AI_ENABLE_CONTENT_TRUNCATION !== 'false',
    preserveImportantSections: process.env.AI_PRESERVE_IMPORTANT_SECTIONS !== 'false',
    compressionRatio: parseFloat(process.env.AI_COMPRESSION_RATIO || '0.7'),
  },
  
  // Caching
  enableCaching: process.env.AI_ENABLE_CACHING !== 'false',
  cacheExpiryHours: parseInt(process.env.AI_CACHE_EXPIRY_HOURS || '24', 10),
  
  // Fallback and retry
  retryAttempts: parseInt(process.env.AI_RETRY_ATTEMPTS || '3', 10),
  retryDelay: parseInt(process.env.AI_RETRY_DELAY || '1000', 10),
  
  // Usage tracking
  trackUsage: process.env.AI_TRACK_USAGE !== 'false',
  usageLogging: process.env.AI_USAGE_LOGGING === 'true',
}));