import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/talent_radar',
  
  // Connection pool settings
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
  connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),
  queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
  
  // Logging
  logging: process.env.DB_LOGGING === 'true',
  logLevel: process.env.DB_LOG_LEVEL || 'info',
  
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false,
  } : false,
  
  // Migration settings
  migrationsRun: process.env.NODE_ENV !== 'production',
  synchronize: process.env.NODE_ENV === 'development',
  
  // Performance
  enableQueryCache: process.env.DB_ENABLE_QUERY_CACHE !== 'false',
  cacheSize: parseInt(process.env.DB_CACHE_SIZE || '1000', 10),
}));