import { registerAs } from '@nestjs/config';

export default registerAs('scraper', () => ({
  // Global scraper settings
  enabled: process.env.SCRAPER_ENABLED !== 'false',
  enabledSites: process.env.SCRAPER_ENABLED_SITES ? 
    process.env.SCRAPER_ENABLED_SITES.split(',') : ['dev.bg', 'jobs.bg'],

  // Site-specific configurations
  sites: {
    devBg: {
      enabled: process.env.DEV_BG_ENABLED !== 'false',
      baseUrl: process.env.DEV_BG_BASE_URL || 'https://dev.bg',
      apiUrl: process.env.DEV_BG_API_URL || 'https://dev.bg/company/jobs/java/',
      requestTimeout: parseInt(process.env.DEV_BG_REQUEST_TIMEOUT || '30000', 10),
      requestDelay: parseInt(process.env.DEV_BG_REQUEST_DELAY || '2000', 10),
      maxPages: parseInt(process.env.DEV_BG_MAX_PAGES || '10', 10),
      maxRetries: parseInt(process.env.DEV_BG_MAX_RETRIES || '3', 10),
      userAgent: process.env.DEV_BG_USER_AGENT || 'TalentRadar/1.0 (Job Aggregator)',
    },
    
    jobsBg: {
      enabled: process.env.JOBS_BG_ENABLED !== 'false',
      baseUrl: process.env.JOBS_BG_BASE_URL || 'https://www.jobs.bg',
      searchUrl: process.env.JOBS_BG_SEARCH_URL || 'https://www.jobs.bg/front_job_search.php',
      requestTimeout: parseInt(process.env.JOBS_BG_REQUEST_TIMEOUT || '30000', 10),
      requestDelay: parseInt(process.env.JOBS_BG_REQUEST_DELAY || '3000', 10), // Slower for jobs.bg
      maxPages: parseInt(process.env.JOBS_BG_MAX_PAGES || '10', 10),
      maxRetries: parseInt(process.env.JOBS_BG_MAX_RETRIES || '3', 10),
      userAgent: process.env.JOBS_BG_USER_AGENT || 'TalentRadar/1.0 (Job Aggregator)',
    },
  },

  // Duplicate detection settings
  duplicateDetection: {
    enabled: process.env.DUPLICATE_DETECTION_ENABLED !== 'false',
    fuzzyMatchThreshold: parseFloat(process.env.FUZZY_MATCH_THRESHOLD || '0.8'),
    exactMatchThreshold: parseFloat(process.env.EXACT_MATCH_THRESHOLD || '0.95'),
    companyMatchThreshold: parseFloat(process.env.COMPANY_MATCH_THRESHOLD || '0.8'),
    enableCrossSiteDeduplication: process.env.CROSS_SITE_DEDUPLICATION !== 'false',
  },
  // Technology detection patterns - can be extended via environment variables
  techPatterns: {
    // Core patterns are handled by TechPatternService
    // Additional custom patterns can be added here
    customPatterns: process.env.CUSTOM_TECH_PATTERNS ? 
      JSON.parse(process.env.CUSTOM_TECH_PATTERNS) : {},
  },
  // Translation mappings - for extending built-in translations
  translations: {
    // Core translations are handled by TranslationService  
    // Additional translations can be added here
    customTranslations: process.env.CUSTOM_TRANSLATIONS ?
      JSON.parse(process.env.CUSTOM_TRANSLATIONS) : {},
  },
  // Rate limiting and performance settings
  performance: {
    maxConcurrentRequests: parseInt(process.env.SCRAPER_MAX_CONCURRENT || '5', 10),
    retryAttempts: parseInt(process.env.SCRAPER_RETRY_ATTEMPTS || '3', 10),
    retryDelay: parseInt(process.env.SCRAPER_RETRY_DELAY || '1000', 10),
    cacheTtl: parseInt(process.env.SCRAPER_CACHE_TTL || '3600', 10), // 1 hour
  },
  // Job processing settings
  jobProcessing: {
    batchSize: parseInt(process.env.SCRAPER_BATCH_SIZE || '50', 10),
    maxVacancies: parseInt(process.env.SCRAPER_MAX_VACANCIES || '0', 10), // 0 means no limit
    includeJobDetails: process.env.SCRAPER_INCLUDE_DETAILS !== 'false',
    enableTranslation: process.env.SCRAPER_ENABLE_TRANSLATION !== 'false',
    enableTechDetection: process.env.SCRAPER_ENABLE_TECH_DETECTION !== 'false',
  },
}));