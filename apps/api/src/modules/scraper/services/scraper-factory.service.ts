import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScraperRegistryService } from './scraper-registry.service';
import { DuplicateDetectorService } from './duplicate-detector.service';
import { CompanyMatcherService } from './company-matcher.service';
import { 
  IJobScraper, 
  JobListing, 
  ScraperOptions, 
  ScrapingResult 
} from '../interfaces/job-scraper.interface';

export interface MultiSiteScrapingOptions extends ScraperOptions {
  sites?: string[]; // Specific sites to scrape, defaults to all enabled
  enableDuplicateDetection?: boolean;
  enableCompanyMatching?: boolean;
}

export interface MultiSiteScrapingResult {
  totalJobs: number;
  newJobs: number;
  duplicatesFound: number;
  companiesMatched: number;
  siteResults: Record<string, ScrapingResult>;
  errors: string[];
  duration: number;
}

/**
 * Factory service that orchestrates scraping across multiple job sites
 * Handles duplicate detection and company matching
 */
@Injectable()
export class ScraperFactoryService {
  private readonly logger = new Logger(ScraperFactoryService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly scraperRegistry: ScraperRegistryService,
    private readonly duplicateDetector: DuplicateDetectorService,
    private readonly companyMatcher: CompanyMatcherService,
  ) {}

  /**
   * Scrape jobs from multiple sites with deduplication
   */
  async scrapeMultipleSites(options: MultiSiteScrapingOptions = {}): Promise<MultiSiteScrapingResult> {
    const startTime = Date.now();
    const {
      sites,
      enableDuplicateDetection = true,
      enableCompanyMatching = true,
      ...scraperOptions
    } = options;

    this.logger.log('Starting multi-site scraping process');

    const result: MultiSiteScrapingResult = {
      totalJobs: 0,
      newJobs: 0,
      duplicatesFound: 0,
      companiesMatched: 0,
      siteResults: {},
      errors: [],
      duration: 0,
    };

    // Determine which sites to scrape
    const sitesToScrape = sites || this.scraperRegistry.getEnabledSiteNames();
    this.logger.log(`Scraping sites: ${sitesToScrape.join(', ')}`);

    // Scrape each site
    for (const siteName of sitesToScrape) {
      try {
        this.logger.log(`Starting scrape for site: ${siteName}`);
        
        const siteResult = await this.scrapeSingleSite(siteName, scraperOptions);
        result.siteResults[siteName] = siteResult;
        result.totalJobs += siteResult.totalFound;

        if (siteResult.errors.length > 0) {
          result.errors.push(...siteResult.errors.map(error => `${siteName}: ${error}`));
        }

        this.logger.log(`Completed scrape for ${siteName}: ${siteResult.totalFound} jobs found`);

        // Process jobs with duplicate detection and company matching
        if (siteResult.jobs.length > 0) {
          const processed = await this.processJobListings(
            siteResult.jobs,
            siteName,
            { enableDuplicateDetection, enableCompanyMatching }
          );
          
          result.newJobs += processed.newJobs;
          result.duplicatesFound += processed.duplicatesFound;
          result.companiesMatched += processed.companiesMatched;
        }

        // Add delay between sites to be respectful
        if (sitesToScrape.indexOf(siteName) < sitesToScrape.length - 1) {
          await this.delay(2000); // 2 second delay between sites
        }

      } catch (error) {
        this.logger.error(`Error scraping site ${siteName}:`, error.message);
        result.errors.push(`${siteName}: ${error.message}`);
      }
    }

    result.duration = Date.now() - startTime;
    
    this.logger.log(`Multi-site scraping completed. Total: ${result.totalJobs} jobs, New: ${result.newJobs} jobs, Duplicates: ${result.duplicatesFound}, Duration: ${result.duration}ms`);
    
    return result;
  }

  /**
   * Scrape a single site
   */
  async scrapeSingleSite(siteName: string, options: ScraperOptions): Promise<ScrapingResult> {
    const scraper = this.scraperRegistry.getScraper(siteName);
    if (!scraper) {
      throw new Error(`No scraper available for site: ${siteName}`);
    }

    return await scraper.scrapeJobs(options);
  }

  /**
   * Get scraper by site name
   */
  getScraper(siteName: string): IJobScraper | null {
    return this.scraperRegistry.getScraper(siteName);
  }

  /**
   * Get scraper for URL
   */
  getScraperForUrl(url: string): IJobScraper | null {
    return this.scraperRegistry.getScraperForUrl(url);
  }

  /**
   * Fetch job details using appropriate scraper
   */
  async fetchJobDetails(jobUrl: string, companyName?: string): Promise<any> {
    const scraper = this.scraperRegistry.getScraperForUrl(jobUrl);
    if (!scraper) {
      throw new Error(`No scraper available for URL: ${jobUrl}`);
    }

    return await scraper.fetchJobDetails(jobUrl, companyName);
  }

  /**
   * Process job listings with duplicate detection and company matching
   */
  private async processJobListings(
    jobs: JobListing[],
    siteName: string,
    options: { enableDuplicateDetection: boolean; enableCompanyMatching: boolean }
  ): Promise<{
    newJobs: number;
    duplicatesFound: number;
    companiesMatched: number;
  }> {
    let newJobs = 0;
    let duplicatesFound = 0;
    let companiesMatched = 0;

    for (const job of jobs) {
      try {
        // Handle company matching first
        let companyId: string;
        
        if (options.enableCompanyMatching) {
          const companyResult = await this.companyMatcher.findOrCreateCompany({
            name: job.company,
            website: job.companyWebsite,
            location: job.location,
            industry: job.industry,
          });
          
          companyId = companyResult.id;
          if (!companyResult.isNew) {
            companiesMatched++;
          }
        } else {
          // Fallback: simple company creation without matching
          // This would need to be implemented in your existing company service
          throw new Error('Company matching is required for job processing');
        }

        // Handle duplicate detection
        if (options.enableDuplicateDetection) {
          const exactMatch = await this.duplicateDetector.findExactMatch(job);
          
          if (exactMatch) {
            // Update existing job with new site information
            await this.duplicateDetector.mergeJobListings(exactMatch, job);
            duplicatesFound++;
            continue;
          }

          const duplicates = await this.duplicateDetector.findDuplicates(job);
          const bestMatch = duplicates.find(d => d.shouldMerge);
          
          if (bestMatch) {
            // Merge with existing job
            await this.duplicateDetector.mergeJobListings(bestMatch.existingId, job);
            duplicatesFound++;
            continue;
          }
        }

        // Create new job if no duplicates found
        // const newJobData = this.convertJobListingToVacancyData(job, companyId);
        // This would call your existing vacancy service to create the job
        // await this.vacancyService.create(newJobData);
        
        newJobs++;
        
      } catch (error) {
        this.logger.error(`Error processing job ${job.title} from ${siteName}:`, error.message);
      }
    }

    return { newJobs, duplicatesFound, companiesMatched };
  }

  /**
   * Convert JobListing to database format
   */
  private convertJobListingToVacancyData(job: JobListing, companyId: string): any {
    return {
      title: job.title,
      description: job.description || '',
      requirements: job.requirements ? [job.requirements] : [],
      responsibilities: job.responsibilities || [],
      location: job.location,
      experienceLevel: job.experienceLevel || 'not_specified',
      employmentType: job.employmentType || 'full-time',
      workModel: job.workModel || 'not_specified',
      companyId,
      sourceUrl: job.url,
      sourceSite: job.sourceSite,
      originalJobId: job.originalJobId,
      status: 'active',
      postedAt: job.postedDate,
      technologies: job.technologies || [],
      benefits: job.benefits || [],
      // Set external IDs for cross-site tracking
      externalIds: job.originalJobId && job.sourceSite ? {
        [job.sourceSite]: job.originalJobId
      } : null,
      // Set scraped sites tracking
      scrapedSites: {
        [job.sourceSite]: {
          lastSeenAt: new Date().toISOString(),
          url: job.url,
          originalId: job.originalJobId,
        }
      },
    };
  }

  /**
   * Get available scrapers info
   */
  getAvailableScrapers(): Record<string, any> {
    return this.scraperRegistry.getAllScraperConfigs();
  }

  /**
   * Get scraper statistics
   */
  getStats(): any {
    return this.scraperRegistry.getStats();
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}