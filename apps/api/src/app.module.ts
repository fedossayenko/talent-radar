import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { APP_GUARD } from '@nestjs/core';

// Authentication
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

// Feature modules
import { VacancyModule } from './modules/vacancy/vacancy.module';
import { CompanyModule } from './modules/company/company.module';
import { ScraperModule } from './modules/scraper/scraper.module';
import { AiModule } from './modules/ai/ai.module';
import { CvModule } from './modules/cv/cv.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { ApplicationModule } from './modules/application/application.module';

// Common modules
import { DatabaseModule } from './common/database/database.module';
import { RedisModule } from './common/redis/redis.module';

// Configuration
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { redisConfig } from './config/redis.config';
import { aiConfig } from './config/ai.config';
import scraperConfig from './config/scraper.config';

// Health and monitoring
import { HealthModule } from './common/health/health.module';
import { MetricsModule } from './common/metrics/metrics.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, aiConfig, scraperConfig],
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting - relaxed for test environment
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isTest = configService.get<string>('NODE_ENV') === 'test';
        return isTest ? [
          // Very permissive limits for testing
          {
            name: 'short',
            ttl: 1000,
            limit: 1000,
          },
          {
            name: 'medium',
            ttl: 10000,
            limit: 5000,
          },
          {
            name: 'long',
            ttl: 60000,
            limit: 10000,
          },
        ] : [
          // Production limits
          {
            name: 'short',
            ttl: 1000,
            limit: 3,
          },
          {
            name: 'medium',
            ttl: 10000,
            limit: 20,
          },
          {
            name: 'long',
            ttl: 60000,
            limit: 100,
          },
        ];
      },
    }),

    // Task scheduling
    ScheduleModule.forRoot(),

    // Queue management with Redis
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password'),
          username: configService.get<string>('redis.username'),
          db: configService.get<number>('redis.db'),
          // Connection options  
          retryDelayOnFailover: configService.get<number>('redis.retryDelayOnFailover'),
          maxRetriesPerRequest: configService.get<number>('redis.maxRetriesPerRequest'),
          lazyConnect: false, // Bull workers need immediate connections
          family: configService.get<number>('redis.family'),
        },
      }),
    }),

    // Core infrastructure
    DatabaseModule,
    RedisModule,

    // Authentication
    AuthModule,

    // Health and monitoring
    HealthModule,
    MetricsModule,

    // Feature modules
    VacancyModule,
    CompanyModule,
    ScraperModule,
    AiModule,
    CvModule,
    ScoringModule,
    ApplicationModule,
  ],
  controllers: [],
  providers: [
    // Global authentication guard
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}