import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

/**
 * Mock Redis service for testing
 * Provides the same interface as RedisService but stores data in memory
 */
@Injectable()
export class RedisMockService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisMockService.name);
  private store = new Map<string, any>();
  private ttlStore = new Map<string, number>();

  async onModuleInit() {
    this.logger.log('✅ Mock Redis connected successfully');
  }

  async onModuleDestroy() {
    this.store.clear();
    this.ttlStore.clear();
    this.logger.log('🔌 Mock Redis disconnected');
  }

  getClient() {
    return {
      ping: () => 'PONG',
    };
  }

  getPublisher() {
    return this.getClient();
  }

  getSubscriber() {
    return this.getClient();
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    this.store.set(key, value);
    if (ttl) {
      this.ttlStore.set(key, Date.now() + ttl * 1000);
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    if (this.isExpired(key)) {
      this.store.delete(key);
      this.ttlStore.delete(key);
      return null;
    }
    return this.store.get(key) || null;
  }

  async del(key: string): Promise<number> {
    const existed = this.store.has(key);
    this.store.delete(key);
    this.ttlStore.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key: string): Promise<boolean> {
    if (this.isExpired(key)) {
      this.store.delete(key);
      this.ttlStore.delete(key);
      return false;
    }
    return this.store.has(key);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    if (this.store.has(key)) {
      this.ttlStore.set(key, Date.now() + seconds * 1000);
      return true;
    }
    return false;
  }

  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    return keys.map(key => this.store.get(key) || null);
  }

  async mset(keyValuePairs: Record<string, any>): Promise<void> {
    Object.entries(keyValuePairs).forEach(([key, value]) => {
      this.store.set(key, value);
    });
  }

  async incr(key: string): Promise<number> {
    const current = this.store.get(key) || 0;
    const newValue = Number(current) + 1;
    this.store.set(key, newValue);
    return newValue;
  }

  async incrby(key: string, increment: number): Promise<number> {
    const current = this.store.get(key) || 0;
    const newValue = Number(current) + increment;
    this.store.set(key, newValue);
    return newValue;
  }

  async lpush(key: string, ...values: any[]): Promise<number> {
    const list = this.store.get(key) || [];
    list.unshift(...values);
    this.store.set(key, list);
    return list.length;
  }

  async lrange<T = any>(key: string, start: number, stop: number): Promise<T[]> {
    const list = this.store.get(key) || [];
    return list.slice(start, stop === -1 ? undefined : stop + 1);
  }

  async sadd(key: string, ...members: any[]): Promise<number> {
    const set = new Set(this.store.get(key) || []);
    let added = 0;
    members.forEach(member => {
      if (!set.has(member)) {
        set.add(member);
        added++;
      }
    });
    this.store.set(key, Array.from(set));
    return added;
  }

  async smembers<T = any>(key: string): Promise<T[]> {
    return this.store.get(key) || [];
  }

  async publish(channel: string, message: any): Promise<number> {
    // Mock publish - just log for testing
    this.logger.debug(`Published to ${channel}: ${JSON.stringify(message)}`);
    return 1;
  }

  async subscribe(channel: string, _callback: (message: any) => void): Promise<void> {
    // Mock subscribe - just log for testing
    this.logger.debug(`Subscribed to ${channel}`);
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async getInfo(): Promise<any> {
    return {
      server: { redis_version: 'mock' },
      memory: { used_memory: 0 },
      clients: { connected_clients: 1 },
      timestamp: new Date().toISOString(),
    };
  }

  async flushall(): Promise<void> {
    this.store.clear();
    this.ttlStore.clear();
    this.logger.warn('🗑️ Mock Redis database cleared');
  }

  private isExpired(key: string): boolean {
    const ttl = this.ttlStore.get(key);
    if (ttl && Date.now() > ttl) {
      return true;
    }
    return false;
  }
}