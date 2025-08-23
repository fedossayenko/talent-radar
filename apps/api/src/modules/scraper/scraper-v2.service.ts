import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/database/prisma.service';
import { VacancyService } from '../vacancy/vacancy.service';
import { CompanyService } from '../company/company.service';
import { ScraperFactoryService } from './services/scraper-factory.service';
import { DuplicateDetectorService } from './services/duplicate-detector.service';
import { CompanyMatcherService } from './services/company-matcher.service';
import { 
  ScraperOptions, 
  JobListing 
} from './interfaces/job-scraper.interface';

export interface EnhancedScrapingOptions extends ScraperOptions {
  sites?: string[]; // Specific sites to scrape
  enableAiExtraction?: boolean;
  enableCompanyAnalysis?: boolean;
  enableDuplicateDetection?: boolean;
  force?: boolean;
}

export interface EnhancedScrapingResult {
  totalJobsFound: number;
  newVacancies: number;
  updatedVacancies: number;
  newCompanies: number;
  duplicatesDetected: number;
  companiesMatched: number;
  sitesScraped: string[];
  siteResults: Record<string, any>;
  errors: string[];
  duration: number;
}

export interface ScrapingStats {
  totalVacancies: number;
  activeVacancies: number;
  totalCompanies: number;
  siteCounts: Record<string, number>;
  lastScrapedAt: string | null;
}

/**
 * Enhanced scraper service that supports multiple job sites
 * with intelligent duplicate detection and company matching
 */
@Injectable()
export class ScraperServiceV2 {
  private readonly logger = new Logger(ScraperServiceV2.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly scraperFactory: ScraperFactoryService,
    private readonly duplicateDetector: DuplicateDetectorService,
    private readonly companyMatcher: CompanyMatcherService,
    private readonly vacancyService: VacancyService,
    private readonly companyService: CompanyService,
    private readonly prisma: PrismaService,
    @InjectQueue('scraper') private readonly scraperQueue: Queue,
  ) {
    this.logger.log('Enhanced ScraperService initialized');
  }

  /**
   * Scrape jobs from all enabled sites or specific sites
   */
  async scrapeAllSites(options: EnhancedScrapingOptions = {}): Promise<EnhancedScrapingResult> {
    const { 
      sites,
      enableAiExtraction = true, 
      enableCompanyAnalysis = true,
      enableDuplicateDetection = true,
      force = false,
      ...scraperOptions 
    } = options;

    const startTime = Date.now();
    this.logger.log(`Starting enhanced scraping process for sites: ${sites?.join(', ') || 'all enabled'}`);

    const result: EnhancedScrapingResult = {
      totalJobsFound: 0,
      newVacancies: 0,
      updatedVacancies: 0,
      newCompanies: 0,
      duplicatesDetected: 0,
      companiesMatched: 0,
      sitesScraped: [],
      siteResults: {},
      errors: [],
      duration: 0,
    };

    try {
      // Use factory to scrape multiple sites
      const multiSiteResult = await this.scraperFactory.scrapeMultipleSites({
        ...scraperOptions,
        sites,
        enableDuplicateDetection,
        enableCompanyMatching: true, // Always enable for consistency
      });

      // Process the results
      result.totalJobsFound = multiSiteResult.totalJobs;
      result.duplicatesDetected = multiSiteResult.duplicatesFound;
      result.companiesMatched = multiSiteResult.companiesMatched;
      result.sitesScraped = Object.keys(multiSiteResult.siteResults);
      result.siteResults = multiSiteResult.siteResults;
      result.errors = multiSiteResult.errors;

      // Process each site's jobs for database storage
      for (const [siteName, siteResult] of Object.entries(multiSiteResult.siteResults)) {
        if (siteResult.jobs && siteResult.jobs.length > 0) {
          const processed = await this.processJobsFromSite(
            siteResult.jobs,
            siteName,
            { enableAiExtraction, enableCompanyAnalysis, enableDuplicateDetection, force }
          );

          result.newVacancies += processed.newVacancies;
          result.updatedVacancies += processed.updatedVacancies;
          result.newCompanies += processed.newCompanies;
        }
      }

    } catch (error) {
      this.logger.error('Failed to scrape multiple sites:', error);
      result.errors.push(`Scraping failed: ${error.message}`);
    }

    result.duration = Date.now() - startTime;
    
    this.logger.log(`Enhanced scraping completed in ${result.duration}ms. ` +
      `Found: ${result.totalJobsFound}, New: ${result.newVacancies}, ` +
      `Updated: ${result.updatedVacancies}, Duplicates: ${result.duplicatesDetected}`);

    return result;
  }

  /**
   * Scrape a specific site (for backwards compatibility)
   */
  async scrapeSite(siteName: string, options: EnhancedScrapingOptions = {}): Promise<EnhancedScrapingResult> {
    return this.scrapeAllSites({
      ...options,
      sites: [siteName],
    });
  }

  /**
   * Legacy method for dev.bg scraping (backwards compatibility)
   */
  async scrapeDevBg(options: EnhancedScrapingOptions = {}): Promise<EnhancedScrapingResult> {
    return this.scrapeSite('dev.bg', options);
  }

  /**
   * Process jobs from a specific site
   */
  private async processJobsFromSite(
    jobs: JobListing[], 
    siteName: string,
    options: {
      enableAiExtraction: boolean;
      enableCompanyAnalysis: boolean;
      enableDuplicateDetection: boolean;
      force: boolean;
    }
  ): Promise<{
    newVacancies: number;
    updatedVacancies: number;
    newCompanies: number;
  }> {
    let newVacancies = 0;
    let updatedVacancies = 0;
    let newCompanies = 0;

    for (const jobListing of jobs) {
      try {
        // Find or create company with intelligent matching
        const companyResult = await this.companyMatcher.findOrCreateCompany({
          name: jobListing.company,
          website: jobListing.companyWebsite,
          location: jobListing.location,
          industry: jobListing.industry,
        });

        if (companyResult.isNew) {
          newCompanies++;
        }

        // Handle duplicate detection if enabled
        let vacancyId: string | null = null;
        let isNewVacancy = true;

        if (options.enableDuplicateDetection) {
          // Check for exact matches first
          const exactMatchId = await this.duplicateDetector.findExactMatch(jobListing);
          
          if (exactMatchId) {
            // Update existing vacancy
            await this.duplicateDetector.mergeJobListings(exactMatchId, jobListing);
            vacancyId = exactMatchId;
            isNewVacancy = false;
            updatedVacancies++;
          } else {
            // Check for fuzzy matches
            const duplicates = await this.duplicateDetector.findDuplicates(jobListing);
            const bestMatch = duplicates.find(d => d.shouldMerge);
            
            if (bestMatch) {
              await this.duplicateDetector.mergeJobListings(bestMatch.existingId, jobListing);
              vacancyId = bestMatch.existingId;
              isNewVacancy = false;
              updatedVacancies++;
            }
          }
        }

        // Create new vacancy if not a duplicate
        if (isNewVacancy) {
          const vacancyData = this.convertJobListingToVacancyData(jobListing, companyResult.id);
          const newVacancy = await this.vacancyService.create(vacancyData);
          vacancyId = newVacancy.id;
          newVacancies++;
        }

        // Queue AI extraction if enabled and we have content
        if (options.enableAiExtraction && vacancyId && jobListing.url) {
          try {
            const scraper = this.scraperFactory.getScraperForUrl(jobListing.url);
            if (scraper) {
              const jobDetails = await scraper.fetchJobDetails(jobListing.url, jobListing.company);
              if (jobDetails.rawHtml) {
                await this.queueAiExtraction(vacancyId, jobDetails.rawHtml, jobListing.url);
              }
            }
          } catch (error) {
            this.logger.warn(`Failed to fetch job details for AI extraction: ${error.message}`);
          }
        }

        // Queue company analysis if enabled
        if (options.enableCompanyAnalysis && jobListing.companyWebsite) {
          await this.queueCompanyAnalysis(companyResult.id, siteName, jobListing.companyWebsite);
        }

      } catch (error) {
        this.logger.error(`Error processing job listing: ${jobListing.title}`, error);
      }
    }

    return { newVacancies, updatedVacancies, newCompanies };
  }

  private convertJobListingToVacancyData(job: JobListing, companyId: string): any {
    // Parse salary information if available
    let salaryMin: number | undefined;
    let salaryMax: number | undefined;
    let currency: string | undefined;

    if (job.salaryRange) {
      const salaryInfo = this.parseSalaryRange(job.salaryRange);
      if (salaryInfo) {
        salaryMin = salaryInfo.min;
        salaryMax = salaryInfo.max;
        currency = salaryInfo.currency;
      }
    }

    return {
      title: job.title,
      description: job.description || '',
      requirements: job.requirements ? [job.requirements] : [],
      responsibilities: job.responsibilities || [],
      location: job.location,
      salaryMin,
      salaryMax,
      currency,
      experienceLevel: job.experienceLevel || 'not_specified',
      employmentType: job.employmentType || 'full-time',
      workModel: job.workModel || 'not_specified',
      companyId,
      sourceUrl: job.url,
      sourceSite: job.sourceSite,
      originalJobId: job.originalJobId,
      status: 'active',
      postedAt: job.postedDate,
      technologies: job.technologies,
      benefits: job.benefits,
      industry: job.industry,
      // Cross-site tracking fields
      externalIds: job.originalJobId && job.sourceSite ? {
        [job.sourceSite]: job.originalJobId
      } : null,
      scrapedSites: {
        [job.sourceSite]: {
          lastSeenAt: new Date().toISOString(),
          url: job.url,
          originalId: job.originalJobId,
        }
      },
    };
  }

  private parseSalaryRange(salaryRange: string): { min?: number; max?: number; currency?: string } | null {
    if (!salaryRange) return null;
    
    // Simple regex to extract salary range
    const match = salaryRange.match(/(\d+[\d,\s]*)\s*[-–]\s*(\d+[\d,\s]*)\s*([A-Z]{3}|лв|лева)?/);
    if (match) {
      return {
        min: parseInt(match[1].replace(/[\s,]/g, ''), 10),
        max: parseInt(match[2].replace(/[\s,]/g, ''), 10),
        currency: match[3]?.includes('лв') ? 'BGN' : match[3] || 'BGN',
      };
    }
    
    return null;
  }

  private async queueAiExtraction(vacancyId: string, content: string, sourceUrl: string): Promise<void> {
    try {
      const crypto = await import('crypto');
      const contentHash = crypto.createHash('sha256').update(content).digest('hex');

      const aiExtractionData = {
        vacancyId,
        contentHash,
        content,
        sourceUrl,
        priority: 5,
        maxRetries: 2,
      };

      await this.scraperQueue.add('ai-extraction', aiExtractionData, {
        priority: 5,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 10,
        removeOnFail: 5,
      });

      this.logger.debug(`Queued AI extraction for vacancy ${vacancyId}`);
    } catch (error) {
      this.logger.error(`Failed to queue AI extraction: ${error.message}`);
    }
  }

  private async queueCompanyAnalysis(companyId: string, sourceSite: string, sourceUrl: string): Promise<void> {
    try {
      const companyAnalysisData = {
        companyId,
        sourceSite,
        sourceUrl,
        analysisType: 'website' as const,
        priority: 3,
        maxRetries: 2,
      };

      await this.scraperQueue.add('company-analysis', companyAnalysisData, {
        priority: 3,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 10,
        removeOnFail: 5,
      });

      this.logger.debug(`Queued company analysis for company ${companyId}`);
    } catch (error) {
      this.logger.error(`Failed to queue company analysis: ${error.message}`);
    }
  }

  /**
   * Get enhanced scraping statistics
   */
  async getScrapingStats(): Promise<ScrapingStats> {
    const [
      totalVacancies,
      activeVacancies,
      totalCompanies,
      lastScrapedVacancy
    ] = await Promise.all([
      this.prisma.vacancy.count(),
      this.prisma.vacancy.count({ where: { status: 'active' } }),
      this.prisma.company.count(),
      this.prisma.vacancy.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    // Get counts by source site
    const siteCountsRaw = await this.prisma.vacancy.groupBy({
      by: ['sourceSite'],
      _count: { id: true },
      where: { sourceSite: { not: null } },
    });

    const siteCounts: Record<string, number> = {};
    for (const item of siteCountsRaw) {
      if (item.sourceSite) {
        siteCounts[item.sourceSite] = item._count.id;
      }
    }

    return {
      totalVacancies,
      activeVacancies,
      totalCompanies,
      siteCounts,
      lastScrapedAt: lastScrapedVacancy?.createdAt?.toISOString() || null,
    };
  }

  /**
   * Get available scrapers information
   */
  getAvailableScrapers(): Record<string, any> {
    return this.scraperFactory.getAvailableScrapers();
  }

  /**
   * Get scraper factory statistics
   */
  getScraperStats(): any {
    return this.scraperFactory.getStats();
  }
}