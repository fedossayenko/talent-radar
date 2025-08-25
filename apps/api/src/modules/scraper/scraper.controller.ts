import { Controller, Post, Get, Logger, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ScraperRegistryService } from './services/scraper-registry.service';
import { Public } from '../../auth/decorators/public.decorator';

@ApiTags('scraper')
@Controller({ path: 'scraper', version: '1' })
export class ScraperController {
  private readonly logger = new Logger(ScraperController.name);

  constructor(
    private readonly scraperRegistry: ScraperRegistryService,
  ) {
    this.logger.log('ScraperController initialized');
  }

  @Public()
  @Post('scrape')
  @ApiOperation({ summary: 'Scrape jobs from specified site or URL' })
  @ApiQuery({ name: 'url', required: true, type: String, description: 'Site name (dev.bg, jobs.bg) or full URL to scrape' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of jobs to scrape (default: 1)' })
  @ApiResponse({ status: 200, description: 'Scraping completed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid parameters or scraper not available' })
  async scrape(
    @Query('url') url: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 1;
    
    if (!url) {
      return {
        success: false,
        error: 'URL parameter is required',
        message: 'Provide either a site name (dev.bg, jobs.bg) or a full URL to scrape',
      };
    }
    
    this.logger.log(`Scraping requested: url=${url}, limit=${limitNum}`);
    
    try {
      // Determine if it's a site name or URL
      const siteName = this.extractSiteName(url);
      if (!siteName) {
        return {
          success: false,
          error: 'Unsupported URL or site',
          message: 'Only dev.bg and jobs.bg sites are supported',
        };
      }
      
      // Get scraper from registry
      const scraper = this.scraperRegistry.getScraper(siteName);
      if (!scraper) {
        this.logger.error(`No scraper found for site: ${siteName}`);
        return {
          success: false,
          error: `Scraper not available for site: ${siteName}`,
          message: `The ${siteName} scraper is not registered or initialized`,
          availableSites: this.scraperRegistry.getEnabledSiteNames(),
        };
      }
      
      // Scrape jobs
      const result = await scraper.scrapeJobs({ limit: limitNum });
      
      return {
        success: true,
        message: `Successfully scraped ${result.jobs.length} jobs from ${siteName}`,
        data: {
          site: siteName,
          totalFound: result.totalFound,
          jobs: result.jobs,
          page: result.page,
          hasNextPage: result.hasNextPage,
          processingTime: result.metadata.processingTime,
          errors: result.errors,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to scrape ${url}:`, error);
      return {
        success: false,
        error: error.message,
        message: `Scraping failed for ${url}`,
      };
    }
  }




  @Public()
  @Get('debug')
  @ApiOperation({ summary: 'Debug scraper registry and available scrapers' })
  @ApiResponse({ status: 200, description: 'Debug information about scraper registry' })
  async debugScrapers() {
    this.logger.log('Fetching scraper debug information');
    
    try {
      const enabledSites = this.scraperRegistry.getEnabledSiteNames();
      const stats = this.scraperRegistry.getStats();
      
      return {
        success: true,
        data: {
          enabledSites,
          stats,
          scrapers: {
            'dev.bg': {
              available: this.scraperRegistry.hasScraperForSite('dev.bg'),
              config: this.scraperRegistry.getScraperConfig('dev.bg'),
            },
            'jobs.bg': {
              available: this.scraperRegistry.hasScraperForSite('jobs.bg'),
              config: this.scraperRegistry.getScraperConfig('jobs.bg'),
            },
          },
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch scraper debug info:', error);
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }








  
  /**
   * Helper method to extract site name from URL or validate site name
   */
  private extractSiteName(urlOrSiteName: string): string | null {
    // Direct site names
    if (urlOrSiteName === 'dev.bg' || urlOrSiteName === 'jobs.bg') {
      return urlOrSiteName;
    }
    
    // URL patterns
    if (urlOrSiteName.includes('dev.bg')) {
      return 'dev.bg';
    }
    if (urlOrSiteName.includes('jobs.bg')) {
      return 'jobs.bg';
    }
    
    return null;
  }
}