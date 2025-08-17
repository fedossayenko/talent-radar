import { Controller, Post, Get, Logger } from '@nestjs/common';
import { ScraperScheduler } from './scraper.scheduler';
import { ScraperService } from './scraper.service';

// Controller for managing scraping operations

@Controller('api/v1/scraper')
export class ScraperController {
  private readonly logger = new Logger(ScraperController.name);

  constructor(
    private readonly scraperScheduler: ScraperScheduler,
    private readonly scraperService: ScraperService,
  ) {}

  @Post('dev-bg/manual')
  async triggerManualScraping() {
    this.logger.log('Manual scraping triggered via API');
    
    try {
      const jobId = await this.scraperScheduler.manualScrapeDevBg('api');
      return {
        success: true,
        message: 'Dev.bg scraping job queued successfully',
        jobId,
      };
    } catch (error) {
      this.logger.error('Failed to trigger manual scraping:', error);
      throw error;
    }
  }

  @Get('stats')
  async getScrapingStats() {
    this.logger.log('Fetching scraping statistics');
    
    try {
      const stats = await this.scraperService.getScrapingStats();
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error('Failed to fetch scraping stats:', error);
      throw error;
    }
  }
}