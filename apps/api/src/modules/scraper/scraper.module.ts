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
import { DateUtils } from './utils/date.utils';
import { SalaryUtils } from './utils/salary.utils';
import { ExperienceUtils } from './utils/experience.utils';
import { VacancyModule } from '../vacancy/vacancy.module';
import { CompanyModule } from '../company/company.module';
import { DatabaseModule } from '../../common/database/database.module';
import scraperConfig from '../../config/scraper.config';

@Module({
  imports: [
    ConfigModule.forFeature(scraperConfig),
    DatabaseModule,
    VacancyModule,
    CompanyModule,
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
    DateUtils,
    SalaryUtils,
    ExperienceUtils,
  ],
  exports: [ScraperService, ScraperScheduler],
})
export class ScraperModule {}