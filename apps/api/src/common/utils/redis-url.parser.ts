export interface ParsedRedisConfig {
  host: string;
  port: number;
  password?: string;
  username?: string;
  db?: number;
}

/**
 * Parse Redis URL in the format: redis://[username[:password]@]host[:port][/db]
 * 
 * Examples:
 * - redis://localhost:6379
 * - redis://user:pass@redis:6379/1
 * - redis://redis:6379
 */
export class RedisUrlParser {
  static parseRedisUrl(url: string): ParsedRedisConfig {
    try {
      const parsedUrl = new URL(url);
      console.log('🔍 DEBUG parseRedisUrl - parsedUrl.hostname:', parsedUrl.hostname);
      console.log('🔍 DEBUG parseRedisUrl - parsedUrl.port:', parsedUrl.port);
      
      if (!parsedUrl.protocol.startsWith('redis')) {
        throw new Error(`Invalid Redis URL protocol: ${parsedUrl.protocol}`);
      }

      const config: ParsedRedisConfig = {
        host: parsedUrl.hostname || 'localhost',
        port: parsedUrl.port ? parseInt(parsedUrl.port, 10) : 6379,
      };

      // Extract username and password
      if (parsedUrl.username) {
        config.username = parsedUrl.username;
      }
      
      if (parsedUrl.password) {
        config.password = parsedUrl.password;
      }

      // Extract database number from pathname
      if (parsedUrl.pathname && parsedUrl.pathname !== '/') {
        const dbStr = parsedUrl.pathname.substring(1); // Remove leading '/'
        const db = parseInt(dbStr, 10);
        if (!isNaN(db) && db >= 0) {
          config.db = db;
        }
      }

      return config;
    } catch (error) {
      throw new Error(`Failed to parse Redis URL "${url}": ${error.message}`);
    }
  }

  /**
   * Create Redis configuration from environment variables
   * When REDIS_URL is provided, parsed values take precedence over individual env vars
   */
  static createRedisConfig(): ParsedRedisConfig {
    const redisUrl = process.env.REDIS_URL;
    console.log('🔍 DEBUG createRedisConfig - REDIS_URL:', redisUrl);
    console.log('🔍 DEBUG createRedisConfig - REDIS_HOST:', process.env.REDIS_HOST);
    
    if (redisUrl) {
      // Parse REDIS_URL and use parsed values as primary source
      const parsedConfig = this.parseRedisUrl(redisUrl);
      console.log('🔍 DEBUG createRedisConfig - parsedConfig after parsing:', JSON.stringify(parsedConfig, null, 2));
      
      const finalConfig = {
        host: parsedConfig.host || process.env.REDIS_HOST || 'localhost',
        port: parsedConfig.port || (process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379),
        password: parsedConfig.password || process.env.REDIS_PASSWORD,
        username: parsedConfig.username || process.env.REDIS_USERNAME,
        db: parsedConfig.db || (process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0),
      };
      
      console.log('🔍 DEBUG createRedisConfig - finalConfig:', JSON.stringify(finalConfig, null, 2));
      return finalConfig;
    }

    // Fall back to individual environment variables
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      username: process.env.REDIS_USERNAME,
      db: parseInt(process.env.REDIS_DB || '0', 10),
    };
  }
}