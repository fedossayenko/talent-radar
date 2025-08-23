import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';

// Enhanced Services
import { ScraperService } from './scraper.service';
import { ScraperFactoryService } from './services/scraper-factory.service';
import { ScraperRegistryService } from './services/scraper-registry.service';
import { DuplicateDetectorService } from './services/duplicate-detector.service';
import { CompanyMatcherService } from './services/company-matcher.service';

// Enhanced Scrapers
import { DevBgScraper } from './scrapers/dev-bg.scraper';
import { JobsBgScraper } from './scrapers/jobs-bg.scraper';

// Other services
import { ScraperScheduler } from './scraper.scheduler';
import { TranslationService } from './services/translation.service';
import { JobParserService } from './services/job-parser.service';
import { TechPatternService } from './services/tech-pattern.service';
import { ContentExtractorService } from './services/content-extractor.service';
import { HtmlCleanerService } from './services/html-cleaner.service';
import { AiProcessingPipelineService } from './services/ai-processing-pipeline.service';
import { CompanyProfileScraper } from './services/company-profile.scraper';
import { CompanyValidationService } from './services/company-validation.service';
import { DevBgCompanyExtractor } from './services/devbg-company-extractor.service';

// Controllers
import { ScraperController } from './scraper.controller';

// External modules
import { VacancyModule } from '../vacancy/vacancy.module';
import { CompanyModule } from '../company/company.module';
import { AiModule } from '../ai/ai.module';
import { DatabaseModule } from '../../common/database/database.module';
import scraperConfig from '../../config/scraper.config';

/**
 * Enhanced Scraper Module
 * 
 * Features:
 * - Multi-site scraping support (dev.bg, jobs.bg, extensible)
 * - Intelligent duplicate detection across sites
 * - Company deduplication and matching
 * - Plugin architecture for adding new scrapers
 */
@Module({
  imports: [
    ConfigModule.forFeature(scraperConfig),
    DatabaseModule,
    VacancyModule,
    CompanyModule,
    AiModule,
    BullModule.registerQueue({
      name: 'scraper',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    }),
  ],
  controllers: [
    ScraperController,
  ],
  providers: [
    // === Enhanced Services ===
    ScraperService,
    ScraperFactoryService,
    ScraperRegistryService,
    DuplicateDetectorService,
    CompanyMatcherService,

    // === Enhanced Scrapers ===
    DevBgScraper,
    JobsBgScraper,

    // === Other Services ===
    ScraperScheduler,

    // === Shared Services ===
    TranslationService,
    JobParserService,
    TechPatternService,
    ContentExtractorService,
    HtmlCleanerService,
    AiProcessingPipelineService,
    CompanyProfileScraper,
    CompanyValidationService,
    DevBgCompanyExtractor,
  ],
  exports: [
    // Primary exports
    ScraperService,
    ScraperFactoryService,
    ScraperRegistryService,
    DuplicateDetectorService,
    CompanyMatcherService,
    
    // Other exports
    ScraperScheduler,
    
    // Shared services
    ContentExtractorService,
    HtmlCleanerService,
    AiProcessingPipelineService,
  ],
})
export class ScraperModule {}