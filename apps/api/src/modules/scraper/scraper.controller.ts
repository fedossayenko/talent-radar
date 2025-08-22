import { Controller, Post, Get, Logger, Query } from '@nestjs/common';
import { ScraperScheduler } from './scraper.scheduler';
import { ScraperService } from './scraper.service';
import { Public } from '../../auth/decorators/public.decorator';

// Controller for managing scraping operations

@Controller('scraper')
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

  @Public()
  @Post('dev-bg/test')
  async triggerTestScraping(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 1;
    this.logger.log(`Test scraping triggered via API with limit: ${limitNum}`);
    
    try {
      const result = await this.scraperService.scrapeDevBg({
        limit: limitNum,
        enableAiExtraction: true,
      });
      
      return {
        success: true,
        message: `Test scraping completed with ${limitNum} vacancy limit`,
        data: result,
      };
    } catch (error) {
      this.logger.error('Failed to trigger test scraping:', error);
      throw error;
    }
  }

  @Public()
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
