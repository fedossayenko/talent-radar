import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async getHealthStatus() {
    const timestamp = new Date().toISOString();
    
    try {
      const [dbHealth, redisHealth] = await Promise.allSettled([
        this.checkDatabase(),
        this.checkRedis(),
      ]);

      const services = {
        database: dbHealth.status === 'fulfilled' && dbHealth.value ? 'ok' : 'error',
        redis: redisHealth.status === 'fulfilled' && redisHealth.value ? 'ok' : 'error',
      };

      const overallStatus = Object.values(services).every(status => status === 'ok') ? 'ok' : 'error';

      return {
        status: overallStatus,
        timestamp,
        services,
        version: process.env.npm_package_version || '0.1.0',
        uptime: process.uptime(),
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'error',
        timestamp,
        error: 'Health check failed',
        services: {
          database: 'unknown',
          redis: 'unknown',
        },
      };
    }
  }

  async getDetailedHealth() {
    const basicHealth = await this.getHealthStatus();
    
    try {
      const [dbStats, redisInfo] = await Promise.allSettled([
        this.getDatabaseStats(),
        this.getRedisStats(),
      ]);

      return {
        ...basicHealth,
        details: {
          database: dbStats.status === 'fulfilled' ? dbStats.value : { error: 'Failed to get stats' },
          redis: redisInfo.status === 'fulfilled' ? redisInfo.value : { error: 'Failed to get stats' },
          memory: this.getMemoryUsage(),
          environment: {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            environment: process.env.NODE_ENV || 'development',
          },
        },
      };
    } catch (error) {
      this.logger.error('Detailed health check failed:', error);
      return {
        ...basicHealth,
        details: {
          error: 'Failed to get detailed health information',
        },
      };
    }
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      return await this.prismaService.healthCheck();
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      return await this.redisService.healthCheck();
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
      return false;
    }
  }

  private async getDatabaseStats() {
    try {
      return await this.prismaService.getStats();
    } catch (error) {
      this.logger.error('Failed to get database stats:', error);
      throw error;
    }
  }

  private async getRedisStats() {
    try {
      return await this.redisService.getInfo();
    } catch (error) {
      this.logger.error('Failed to get Redis stats:', error);
      throw error;
    }
  }

  private getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(usage.external / 1024 / 1024)} MB`,
      arrayBuffers: `${Math.round(usage.arrayBuffers / 1024 / 1024)} MB`,
    };
  }
}