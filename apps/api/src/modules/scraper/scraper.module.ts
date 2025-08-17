import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ScraperService } from './scraper.service';
import { DevBgScraper } from './scrapers/dev-bg.scraper';
import { ScraperProcessor } from './processors/scraper.processor';
import { ScraperScheduler } from './scraper.scheduler';
import { ScraperController } from './scraper.controller';
import { VacancyModule } from '../vacancy/vacancy.module';
import { CompanyModule } from '../company/company.module';
import { DatabaseModule } from '../../common/database/database.module';

@Module({
  imports: [
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
  ],
  exports: [ScraperService, ScraperScheduler],
})
export class ScraperModule {}