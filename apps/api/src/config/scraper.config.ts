import { registerAs } from '@nestjs/config';

export default registerAs('scraper', () => ({
  devBg: {
    baseUrl: process.env.DEV_BG_BASE_URL || 'https://dev.bg',
    apiUrl: process.env.DEV_BG_API_URL || 'https://dev.bg/company/jobs/java/',
    requestTimeout: parseInt(process.env.DEV_BG_REQUEST_TIMEOUT || '30000', 10),
    requestDelay: parseInt(process.env.DEV_BG_REQUEST_DELAY || '2000', 10),
    maxPages: parseInt(process.env.DEV_BG_MAX_PAGES || '10', 10),
    userAgent: process.env.DEV_BG_USER_AGENT || 'TalentRadar/1.0 (Job Aggregator)',
  },
  enabled: process.env.SCRAPER_ENABLED === 'true' || true,
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