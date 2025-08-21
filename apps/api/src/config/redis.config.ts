import { registerAs } from '@nestjs/config';
import { RedisUrlParser } from '../common/utils/redis-url.parser';

export const redisConfig = registerAs('redis', () => {
  const parsedConfig = RedisUrlParser.createRedisConfig();
  
  // Debug logging to understand what's being parsed
  console.log('🔍 Redis URL:', process.env.REDIS_URL);
  console.log('🔍 Parsed Redis Config:', JSON.stringify(parsedConfig, null, 2));
  
  return {
    url: process.env.REDIS_URL || `redis://${parsedConfig.host}:${parsedConfig.port}`,
    host: parsedConfig.host,
    port: parsedConfig.port,
    password: parsedConfig.password,
    username: parsedConfig.username,
    
    // Connection settings
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: false, // Bull workers need immediate connections
    keepAlive: 30000,
    
    // Pool settings
    family: 4,
    db: parsedConfig.db,
    
    // Performance
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'talent-radar:',
    
    // Cache TTL (in seconds)
    defaultTtl: parseInt(process.env.REDIS_DEFAULT_TTL || '3600', 10), // 1 hour
    sessionTtl: parseInt(process.env.REDIS_SESSION_TTL || '86400', 10), // 24 hours
    
    // Queue configuration (use same parsed config for all queues)
    queues: {
      scraping: {
        name: 'scraping',
        redis: {
          host: parsedConfig.host,
          port: parsedConfig.port,
          password: parsedConfig.password,
          username: parsedConfig.username,
          db: parsedConfig.db,
        },
      },
      ai: {
        name: 'ai-processing',
        redis: {
          host: parsedConfig.host,
          port: parsedConfig.port,
          password: parsedConfig.password,
          username: parsedConfig.username,
          db: parsedConfig.db,
        },
      },
      notifications: {
        name: 'notifications',
        redis: {
          host: parsedConfig.host,
          port: parsedConfig.port,
          password: parsedConfig.password,
          username: parsedConfig.username,
          db: parsedConfig.db,
        },
      },
    },
  };
});