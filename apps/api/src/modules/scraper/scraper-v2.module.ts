import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';

// V2 Enhanced Services
import { ScraperServiceV2 } from './scraper-v2.service';
import { ScraperFactoryService } from './services/scraper-factory.service';
import { ScraperRegistryService } from './services/scraper-registry.service';
import { DuplicateDetectorService } from './services/duplicate-detector.service';
import { CompanyMatcherService } from './services/company-matcher.service';

// V2 Enhanced Scrapers
import { DevBgScraper as DevBgScraperV2 } from './scrapers/dev-bg-v2.scraper';
import { JobsBgScraper } from './scrapers/jobs-bg.scraper';

// Legacy services (kept for compatibility)
import { ScraperService } from './scraper.service';
import { DevBgScraper } from './scrapers/dev-bg.scraper';
import { ScraperProcessor } from './processors/scraper.processor';
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
 * Enhanced Scraper Module V2
 * 
 * Features:
 * - Multi-site scraping support (dev.bg, jobs.bg, extensible)
 * - Intelligent duplicate detection across sites
 * - Company deduplication and matching
 * - Plugin architecture for adding new scrapers
 * - Backward compatibility with V1 scrapers
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
    ScraperController, // Enhanced controller supports both V1 and V2
  ],
  providers: [
    // === V2 Enhanced Services ===
    ScraperServiceV2,
    ScraperFactoryService,
    ScraperRegistryService,
    DuplicateDetectorService,
    CompanyMatcherService,

    // === V2 Enhanced Scrapers ===
    DevBgScraperV2,
    JobsBgScraper,

    // === Legacy Services (V1) - Kept for backward compatibility ===
    ScraperService,
    DevBgScraper,
    ScraperProcessor,
    ScraperScheduler,

    // === Shared Services (used by both V1 and V2) ===
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
    // V2 exports (primary)
    ScraperServiceV2,
    ScraperFactoryService,
    ScraperRegistryService,
    DuplicateDetectorService,
    CompanyMatcherService,
    
    // Legacy exports (for backward compatibility)
    ScraperService,
    ScraperScheduler,
    ScraperProcessor,
    
    // Shared services
    ContentExtractorService,
    HtmlCleanerService,
    AiProcessingPipelineService,
  ],
})
export class ScraperModuleV2 {}