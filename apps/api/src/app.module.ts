import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';

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

    // Rate limiting
    ThrottlerModule.forRoot([
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
    ]),

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
          lazyConnect: configService.get<boolean>('redis.lazyConnect'),
          family: configService.get<number>('redis.family'),
        },
      }),
    }),

    // Core infrastructure
    DatabaseModule,
    RedisModule,

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
  providers: [],
})
export class AppModule {}