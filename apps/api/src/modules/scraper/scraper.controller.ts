import { Controller, Post, Get, Logger, Query, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ScraperService } from './scraper.service';
import { ScraperScheduler } from './scraper.scheduler';
import { ScraperFactoryService } from './services/scraper-factory.service';
import { DuplicateDetectorService } from './services/duplicate-detector.service';
import { Public } from '../../auth/decorators/public.decorator';

@ApiTags('scraper')
@Controller({ path: 'scraper', version: '2' })
export class ScraperController {
  private readonly logger = new Logger(ScraperController.name);

  constructor(
    private readonly scraperService: ScraperService,
    private readonly scraperScheduler: ScraperScheduler,
    private readonly scraperFactory: ScraperFactoryService,
    private readonly duplicateDetector: DuplicateDetectorService,
  ) {}

  @Post('scrape')
  @ApiOperation({ summary: 'Scrape jobs from all enabled sites or specific sites' })
  @ApiQuery({ name: 'sites', required: false, type: String, description: 'Comma-separated list of sites (dev.bg,jobs.bg)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of jobs per site' })
  @ApiQuery({ name: 'enableAI', required: false, type: Boolean, description: 'Enable AI extraction' })
  @ApiQuery({ name: 'enableCompanyAnalysis', required: false, type: Boolean, description: 'Enable company analysis' })
  @ApiQuery({ name: 'enableDuplicateDetection', required: false, type: Boolean, description: 'Enable duplicate detection' })
  @ApiQuery({ name: 'force', required: false, type: Boolean, description: 'Force re-scraping' })
  async scrapeMultipleSites(
    @Query('sites') sites?: string,
    @Query('limit') limit?: string,
    @Query('enableAI') enableAI?: string,
    @Query('enableCompanyAnalysis') enableCompanyAnalysis?: string,
    @Query('enableDuplicateDetection') enableDuplicateDetection?: string,
    @Query('force') force?: string,
  ) {
    const sitesArray = sites ? sites.split(',').map(s => s.trim()) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    const enableAIFlag = enableAI !== 'false';
    const enableCompanyAnalysisFlag = enableCompanyAnalysis !== 'false';
    const enableDuplicateDetectionFlag = enableDuplicateDetection !== 'false';
    const forceFlag = force === 'true';

    this.logger.log(`Multi-site scraping triggered: sites=[${sitesArray?.join(',') || 'all'}], limit=${limitNum}, AI=${enableAIFlag}, company=${enableCompanyAnalysisFlag}, duplicates=${enableDuplicateDetectionFlag}, force=${forceFlag}`);
    
    try {
      const result = await this.scraperService.scrapeAllSites({
        sites: sitesArray,
        limit: limitNum,
        enableAiExtraction: enableAIFlag,
        enableCompanyAnalysis: enableCompanyAnalysisFlag,
        enableDuplicateDetection: enableDuplicateDetectionFlag,
        force: forceFlag,
      });
      
      return {
        success: true,
        message: `Multi-site scraping completed. Found ${result.totalJobsFound} jobs, created ${result.newVacancies} new vacancies`,
        data: result,
      };
    } catch (error) {
      this.logger.error('Failed to trigger multi-site scraping:', error);
      throw error;
    }
  }

  @Post('sites/:siteName/scrape')
  @ApiOperation({ summary: 'Scrape jobs from a specific site' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of jobs' })
  @ApiQuery({ name: 'enableAI', required: false, type: Boolean, description: 'Enable AI extraction' })
  @ApiQuery({ name: 'enableCompanyAnalysis', required: false, type: Boolean, description: 'Enable company analysis' })
  @ApiQuery({ name: 'force', required: false, type: Boolean, description: 'Force re-scraping' })
  async scrapeSingleSite(
    @Param('siteName') siteName: string,
    @Query('limit') limit?: string,
    @Query('enableAI') enableAI?: string,
    @Query('enableCompanyAnalysis') enableCompanyAnalysis?: string,
    @Query('force') force?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    const enableAIFlag = enableAI !== 'false';
    const enableCompanyAnalysisFlag = enableCompanyAnalysis !== 'false';
    const forceFlag = force === 'true';

    this.logger.log(`Single site scraping triggered: site=${siteName}, limit=${limitNum}, AI=${enableAIFlag}, company=${enableCompanyAnalysisFlag}, force=${forceFlag}`);
    
    try {
      const result = await this.scraperService.scrapeSite(siteName, {
        limit: limitNum,
        enableAiExtraction: enableAIFlag,
        enableCompanyAnalysis: enableCompanyAnalysisFlag,
        force: forceFlag,
      });
      
      return {
        success: true,
        message: `${siteName} scraping completed. Found ${result.totalJobsFound} jobs, created ${result.newVacancies} new vacancies`,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to scrape ${siteName}:`, error);
      throw error;
    }
  }

  @Post('jobs/check-duplicates')
  @ApiOperation({ summary: 'Check for duplicates of a job listing' })
  @ApiBody({
    description: 'Job listing data to check for duplicates',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        company: { type: 'string' },
        location: { type: 'string' },
        url: { type: 'string' },
        originalJobId: { type: 'string' },
        sourceSite: { type: 'string' },
        technologies: { type: 'array', items: { type: 'string' } },
        postedDate: { type: 'string', format: 'date-time' },
      },
      required: ['title', 'company', 'sourceSite'],
    },
  })
  async checkDuplicates(@Body() jobListing: any) {
    this.logger.log(`Checking for duplicates: ${jobListing.title} at ${jobListing.company}`);
    
    try {
      // Convert to proper format
      const jobData = {
        ...jobListing,
        postedDate: jobListing.postedDate ? new Date(jobListing.postedDate) : new Date(),
        workModel: jobListing.workModel || 'not_specified',
        technologies: jobListing.technologies || [],
      };

      const exactMatch = await this.duplicateDetector.findExactMatch(jobData);
      const duplicates = exactMatch ? [] : await this.duplicateDetector.findDuplicates(jobData);
      
      return {
        success: true,
        data: {
          hasExactMatch: !!exactMatch,
          exactMatchId: exactMatch,
          potentialDuplicates: duplicates,
          duplicateCount: duplicates.length,
        },
      };
    } catch (error) {
      this.logger.error('Failed to check duplicates:', error);
      throw error;
    }
  }

  @Public()
  @Get('stats')
  @ApiOperation({ summary: 'Get enhanced scraping statistics' })
  @ApiResponse({ status: 200, description: 'Enhanced scraping statistics' })
  async getEnhancedStats() {
    this.logger.log('Fetching enhanced scraping statistics');
    
    try {
      const [scrapingStats, scraperStats] = await Promise.all([
        this.scraperService.getScrapingStats(),
        this.scraperService.getScraperStats(),
      ]);

      return {
        success: true,
        data: {
          ...scrapingStats,
          scrapers: scraperStats,
          availableScrapers: this.scraperService.getAvailableScrapers(),
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch enhanced stats:', error);
      throw error;
    }
  }

  @Public()
  @Get('scrapers')
  @ApiOperation({ summary: 'Get information about available scrapers' })
  @ApiResponse({ status: 200, description: 'Available scrapers information' })
  async getAvailableScrapers() {
    this.logger.log('Fetching available scrapers information');
    
    try {
      const scrapers = this.scraperService.getAvailableScrapers();
      const stats = this.scraperService.getScraperStats();

      return {
        success: true,
        data: {
          scrapers,
          stats,
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch scrapers info:', error);
      throw error;
    }
  }

  @Post('jobs/:jobUrl/details')
  @ApiOperation({ summary: 'Fetch job details using appropriate scraper' })
  @ApiQuery({ name: 'companyName', required: false, type: String, description: 'Company name hint' })
  async fetchJobDetails(
    @Param('jobUrl') jobUrl: string,
    @Query('companyName') companyName?: string,
  ) {
    this.logger.log(`Fetching job details from: ${jobUrl}`);
    
    try {
      const details = await this.scraperFactory.fetchJobDetails(decodeURIComponent(jobUrl), companyName);
      
      return {
        success: true,
        data: details,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch job details from ${jobUrl}:`, error);
      throw error;
    }
  }

  // === Legacy Endpoints (for backward compatibility) ===

  @Post('dev-bg/manual')
  @ApiOperation({ summary: 'Legacy: Manual dev.bg scraping (use POST /scrape instead)' })
  async legacyManualDevBgScraping() {
    this.logger.log('Legacy manual dev.bg scraping triggered');
    
    try {
      const jobId = await this.scraperScheduler.manualScrapeDevBg('api-v2-legacy');
      return {
        success: true,
        message: 'Dev.bg scraping job queued successfully (legacy mode)',
        jobId,
      };
    } catch (error) {
      this.logger.error('Failed to trigger legacy manual scraping:', error);
      throw error;
    }
  }

  @Public()
  @Post('dev-bg/test')
  @ApiOperation({ summary: 'Legacy: Test dev.bg scraping (use POST /sites/dev.bg/scrape instead)' })
  async legacyTestDevBgScraping(
    @Query('limit') limit?: string,
    @Query('force') force?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 1;
    const forceFlag = force === 'true';
    
    this.logger.log(`Legacy test dev.bg scraping: limit=${limitNum}, force=${forceFlag}`);
    
    try {
      const result = await this.scraperService.scrapeSite('dev.bg', {
        limit: limitNum,
        enableAiExtraction: true,
        enableCompanyAnalysis: true,
        enableDuplicateDetection: true,
        force: forceFlag,
      });
      
      return {
        success: true,
        message: `Legacy test scraping completed with ${limitNum} vacancy limit, force: ${forceFlag}`,
        data: {
          totalJobsFound: result.totalJobsFound,
          newVacancies: result.newVacancies,
          updatedVacancies: result.updatedVacancies,
          newCompanies: result.newCompanies,
          duplicatesFound: result.duplicatesDetected,
          errors: result.errors,
          duration: result.duration,
        },
      };
    } catch (error) {
      this.logger.error('Failed to trigger legacy test scraping:', error);
      throw error;
    }
  }
}