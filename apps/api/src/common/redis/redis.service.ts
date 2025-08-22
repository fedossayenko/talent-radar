import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private publisher: Redis;
  private subscriber: Redis;

  constructor(private configService: ConfigService) {
    const redisConfig = {
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
      password: this.configService.get<string>('redis.password'),
      username: this.configService.get<string>('redis.username'),
      retryDelayOnFailover: this.configService.get<number>('redis.retryDelayOnFailover'),
      maxRetriesPerRequest: this.configService.get<number>('redis.maxRetriesPerRequest'),
      lazyConnect: this.configService.get<boolean>('redis.lazyConnect'),
      keepAlive: this.configService.get<number>('redis.keepAlive'),
      family: this.configService.get<number>('redis.family'),
      db: this.configService.get<number>('redis.db'),
      keyPrefix: this.configService.get<string>('redis.keyPrefix'),
    };

    this.client = new Redis(redisConfig);
    this.publisher = new Redis(redisConfig);
    this.subscriber = new Redis(redisConfig);
  }

  async onModuleInit() {
    try {
      await Promise.all([
        this.client.ping(),
        this.publisher.ping(),
        this.subscriber.ping(),
      ]);
      this.logger.log('✅ Redis connected successfully');
    } catch (error) {
      this.logger.error('❌ Failed to connect to Redis:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await Promise.all([
        this.client.quit(),
        this.publisher.quit(),
        this.subscriber.quit(),
      ]);
      this.logger.log('🔌 Redis disconnected');
    } catch (error) {
      this.logger.error('❌ Failed to disconnect from Redis:', error);
    }
  }

  /**
   * Get the main Redis client
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Get publisher client for pub/sub
   */
  getPublisher(): Redis {
    return this.publisher;
  }

  /**
   * Get subscriber client for pub/sub
   */
  getSubscriber(): Redis {
    return this.subscriber;
  }

  /**
   * Set a key-value pair with optional expiration
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    
    const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
    
    if (ttl) {
      await this.client.setex(key, ttl, serializedValue);
    } else {
      await this.client.set(key, serializedValue);
    }
  }

  /**
   * Get a value by key
   */
  async get<T = any>(key: string): Promise<T | null> {
    
    const value = await this.client.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value);
    } catch {
      return value as T;
    }
  }

  /**
   * Delete a key
   */
  async del(key: string): Promise<number> {
    return await this.client.del(key);
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * Set expiration for a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.client.expire(key, seconds);
    return result === 1;
  }

  /**
   * Get multiple keys at once
   */
  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    
    const values = await this.client.mget(...keys);
    return values.map(value => {
      if (!value) return null;
      try {
        return JSON.parse(value);
      } catch {
        return value as T;
      }
    });
  }

  /**
   * Set multiple key-value pairs
   */
  async mset(keyValuePairs: Record<string, any>): Promise<void> {
    const serializedPairs = Object.entries(keyValuePairs).flat().map(item => 
      typeof item === 'string' ? item : JSON.stringify(item)
    );
    
    await this.client.mset(...serializedPairs);
  }

  /**
   * Increment a numeric value
   */
  async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  /**
   * Increment by a specific amount
   */
  async incrby(key: string, increment: number): Promise<number> {
    return await this.client.incrby(key, increment);
  }

  /**
   * Add items to a list
   */
  async lpush(key: string, ...values: any[]): Promise<number> {
    const serializedValues = values.map(value => 
      typeof value === 'string' ? value : JSON.stringify(value)
    );
    return await this.client.lpush(key, ...serializedValues);
  }

  /**
   * Get items from a list
   */
  async lrange<T = any>(key: string, start: number, stop: number): Promise<T[]> {
    const values = await this.client.lrange(key, start, stop);
    return values.map(value => {
      try {
        return JSON.parse(value);
      } catch {
        return value as T;
      }
    });
  }

  /**
   * Add items to a set
   */
  async sadd(key: string, ...members: any[]): Promise<number> {
    const serializedMembers = members.map(member => 
      typeof member === 'string' ? member : JSON.stringify(member)
    );
    return await this.client.sadd(key, ...serializedMembers);
  }

  /**
   * Get all members of a set
   */
  async smembers<T = any>(key: string): Promise<T[]> {
    const members = await this.client.smembers(key);
    return members.map(member => {
      try {
        return JSON.parse(member);
      } catch {
        return member as T;
      }
    });
  }

  /**
   * Publish a message to a channel
   */
  async publish(channel: string, message: any): Promise<number> {
    const serializedMessage = typeof message === 'string' ? message : JSON.stringify(message);
    return await this.publisher.publish(channel, serializedMessage);
  }

  /**
   * Subscribe to a channel
   */
  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (receivedChannel, message) => {
      if (receivedChannel === channel) {
        try {
          const parsedMessage = JSON.parse(message);
          callback(parsedMessage);
        } catch {
          callback(message);
        }
      }
    });
  }

  /**
   * Health check for Redis connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
      return false;
    }
  }

  /**
   * Get Redis server info
   */
  async getInfo(): Promise<any> {
    try {
      const info = await this.client.info();
      const memory = await this.client.info('memory');
      const clients = await this.client.info('clients');
      
      return {
        server: this.parseRedisInfo(info),
        memory: this.parseRedisInfo(memory),
        clients: this.parseRedisInfo(clients),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get Redis info:', error);
      throw error;
    }
  }

  /**
   * Parse Redis INFO command output
   */
  private parseRedisInfo(info: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = info.split('\r\n');
    
    for (const line of lines) {
      if (line && !line.startsWith('#') && line.includes(':')) {
        const [key, value] = line.split(':');
        if (key) { // Only process lines with non-empty keys
          result[key] = isNaN(Number(value)) ? value : Number(value);
        }
      }
    }
    
    return result;
  }

  /**
   * Clear all data (use with caution)
   */
  async flushall(): Promise<void> {
    await this.client.flushall();
    this.logger.warn('🗑️ Redis database cleared');
  }
}