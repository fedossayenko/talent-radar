import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { ScraperService } from './scraper.service';
import { DevBgScraper } from './scrapers/dev-bg.scraper';
import { ScraperProcessor } from './processors/scraper.processor';
import { ScraperScheduler } from './scraper.scheduler';
import { ScraperController } from './scraper.controller';
import { TranslationService } from './services/translation.service';
import { JobParserService } from './services/job-parser.service';
import { TechPatternService } from './services/tech-pattern.service';
import { ContentExtractorService } from './services/content-extractor.service';
import { HtmlCleanerService } from './services/html-cleaner.service';
import { AiProcessingPipelineService } from './services/ai-processing-pipeline.service';
import { CompanyProfileScraper } from './services/company-profile.scraper';
import { VacancyModule } from '../vacancy/vacancy.module';
import { CompanyModule } from '../company/company.module';
import { AiModule } from '../ai/ai.module';
import { DatabaseModule } from '../../common/database/database.module';
import scraperConfig from '../../config/scraper.config';

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
  controllers: [ScraperController],
  providers: [
    ScraperService,
    DevBgScraper,
    ScraperProcessor,
    ScraperScheduler,
    TranslationService,
    JobParserService,
    TechPatternService,
    ContentExtractorService,
    HtmlCleanerService,
    AiProcessingPipelineService,
    CompanyProfileScraper,
  ],
  exports: [ScraperService, ScraperScheduler, ContentExtractorService, HtmlCleanerService, AiProcessingPipelineService],
})
export class ScraperModule {}