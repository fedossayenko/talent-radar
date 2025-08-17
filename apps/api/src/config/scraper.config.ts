import { registerAs } from '@nestjs/config';

export default registerAs('scraper', () => ({
  enabled: process.env.SCRAPER_ENABLED === 'true' || process.env.NODE_ENV === 'development',
  schedule: {
    devBg: process.env.SCRAPER_DEVBG_SCHEDULE || '0 2 * * *', // Daily at 2 AM
    healthCheck: process.env.SCRAPER_HEALTH_SCHEDULE || '0 * * * *', // Every hour
  },
  devBg: {
    baseUrl: process.env.DEVBG_BASE_URL || 'https://dev.bg',
    apiUrl: process.env.DEVBG_API_URL || 'https://dev.bg/company/jobs/java/',
    requestTimeout: parseInt(process.env.DEVBG_REQUEST_TIMEOUT || '30000'),
    requestDelay: parseInt(process.env.DEVBG_REQUEST_DELAY || '2000'),
    maxPages: parseInt(process.env.DEVBG_MAX_PAGES || '10'),
    userAgent: process.env.DEVBG_USER_AGENT || 'TalentRadar/1.0 (Job Aggregator)',
  },
  queue: {
    attempts: parseInt(process.env.SCRAPER_QUEUE_ATTEMPTS || '3'),
    backoffDelay: parseInt(process.env.SCRAPER_QUEUE_BACKOFF_DELAY || '5000'),
    removeOnComplete: parseInt(process.env.SCRAPER_QUEUE_KEEP_COMPLETED || '100'),
    removeOnFail: parseInt(process.env.SCRAPER_QUEUE_KEEP_FAILED || '50'),
  },
  filters: {
    technologies: (process.env.SCRAPER_TECH_FILTER || 'java,spring,hibernate,maven,gradle').split(','),
    locations: (process.env.SCRAPER_LOCATION_FILTER || 'bulgaria,sofia,plovdiv,varna').split(','),
    jobTypes: (process.env.SCRAPER_JOB_TYPE_FILTER || 'backend,full-stack').split(','),
  },
}));