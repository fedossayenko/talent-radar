import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Services
import { ScraperRegistryService } from './services/scraper-registry.service';

// Scrapers
import { DevBgScraper } from './scrapers/dev-bg.scraper';
import { JobsBgScraper } from './scrapers/jobs-bg.scraper';

// Support services
import { TranslationService } from './services/translation.service';
import { JobParserService } from './services/job-parser.service';
import { TechPatternService } from './services/tech-pattern.service';
import { ContentExtractorService } from './services/content-extractor.service';
import { HtmlCleanerService } from './services/html-cleaner.service';

// Modern browser services
import { BrowserEngineService } from './services/browser-engine.service';
import { StealthConfigService } from './services/stealth-config.service';

// Controllers
import { ScraperController } from './scraper.controller';

// External modules
import { DatabaseModule } from '../../common/database/database.module';
import scraperConfig from '../../config/scraper.config';

/**
 * Simplified Scraper Module
 * 
 * Features:
 * - Direct scraper access via registry
 * - Support for dev.bg and jobs.bg
 * - Clean, single-endpoint architecture
 */
@Module({
  imports: [
    ConfigModule.forFeature(scraperConfig),
    DatabaseModule,
  ],
  controllers: [
    ScraperController,
  ],
  providers: [
    // === Core Services ===
    ScraperRegistryService,

    // === Modern Browser Services ===
    BrowserEngineService,
    StealthConfigService,

    // === Scrapers ===
    DevBgScraper,
    JobsBgScraper,

    // === Shared Services ===
    TranslationService,
    JobParserService,
    TechPatternService,
    ContentExtractorService,
    HtmlCleanerService,
  ],
  exports: [
    ScraperRegistryService,
    BrowserEngineService,
    StealthConfigService,
    ContentExtractorService,
    HtmlCleanerService,
  ],
})
export class ScraperModule {}