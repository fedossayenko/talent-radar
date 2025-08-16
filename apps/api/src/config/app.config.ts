import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3001', 10),
  environment: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  
  // Security
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  
  // API Configuration
  globalPrefix: 'api/v1',
  rateLimitWindow: parseInt(process.env.API_RATE_LIMIT_WINDOW || '60000', 10),
  rateLimitMax: parseInt(process.env.API_RATE_LIMIT_MAX || '100', 10),
  
  // File uploads
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
  uploadPath: process.env.UPLOAD_PATH || './uploads',
  
  // Feature flags
  enableRegistration: process.env.ENABLE_REGISTRATION === 'true',
  enableEmailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true',
  enableWebsockets: process.env.ENABLE_WEBSOCKETS !== 'false',
  enableApiDocs: process.env.ENABLE_API_DOCS !== 'false',
  enableProfiling: process.env.ENABLE_PROFILING === 'true',
  
  // External services
  linkedinScraperEnabled: process.env.LINKEDIN_SCRAPER_ENABLED === 'true',
  glassdoorApiKey: process.env.GLASSDOOR_API_KEY,
  crunchbaseApiKey: process.env.CRUNCHBASE_API_KEY,
}));