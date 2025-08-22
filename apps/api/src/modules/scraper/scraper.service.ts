import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { DevBgScraper, DevBgJobListing } from './scrapers/dev-bg.scraper';
import { VacancyService } from '../vacancy/vacancy.service';
import { CompanyService } from '../company/company.service';
import { CompanySourceService } from '../company/company-source.service';
import { CompanyProfileScraper } from './services/company-profile.scraper';
import { PrismaService } from '../../common/database/prisma.service';
import { AiExtractionJobData } from './processors/scraper.processor';
import * as crypto from 'crypto';

export interface ScrapingResult {
  totalJobsFound: number;
  newVacancies: number;
  updatedVacancies: number;
  newCompanies: number;
  errors: string[];
  duration: number;
}

export interface ScrapingOptions {
  limit?: number;
  enableAiExtraction?: boolean;
  enableCompanyAnalysis?: boolean;
}

export interface CompanyAnalysisJobData {
  companyId: string;
  sourceSite: string;
  sourceUrl: string;
  content?: string;
  analysisType: 'profile' | 'website';
  priority: number;
  maxRetries?: number;
}

export interface ScrapingStats {
  totalVacancies: number;
  activeVacancies: number;
  companiesFromDevBg: number;
  lastScrapedAt: string | null;
}

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly devBgScraper: DevBgScraper,
    private readonly vacancyService: VacancyService,
    private readonly companyService: CompanyService,
    private readonly companySourceService: CompanySourceService,
    private readonly companyProfileScraper: CompanyProfileScraper,
    private readonly prisma: PrismaService,
    @InjectQueue('scraper') private readonly scraperQueue: Queue,
  ) {
    this.logger.log('ScraperService initialized');
  }

  async scrapeDevBg(options: ScrapingOptions = {}): Promise<ScrapingResult> {
    let { limit, enableAiExtraction = true, enableCompanyAnalysis = true } = options;
    
    // If no explicit limit is provided, use the configured maxVacancies
    if (!limit) {
      const maxVacancies = this.configService.get<number>('scraper.jobProcessing.maxVacancies', 0);
      if (maxVacancies > 0) {
        limit = maxVacancies;
        this.logger.log(`Using configured vacancy limit: ${limit} vacancies`);
      }
    }
    
    const startTime = Date.now();
    this.logger.log(`Starting dev.bg scraping process${limit ? ` (limit: ${limit} vacancies)` : ''} (AI: ${enableAiExtraction}, Company: ${enableCompanyAnalysis})`);

    const result: ScrapingResult = {
      totalJobsFound: 0,
      newVacancies: 0,
      updatedVacancies: 0,
      newCompanies: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Scrape all Java jobs from dev.bg
      const jobListings = await this.devBgScraper.scrapeAllJavaJobs();
      result.totalJobsFound = jobListings.length;

      this.logger.log(`Found ${jobListings.length} job listings from dev.bg`);

      // Apply limit if specified
      const jobsToProcess = limit ? jobListings.slice(0, limit) : jobListings;
      if (limit && jobListings.length > limit) {
        this.logger.log(`Processing only ${limit} out of ${jobListings.length} jobs due to limit`);
      }

      // Process each job listing
      for (const jobListing of jobsToProcess) {
        try {
          await this.processJobListing(jobListing, result, enableAiExtraction, enableCompanyAnalysis);
        } catch (error) {
          this.logger.error(`Failed to process job listing: ${jobListing.title}`, error);
          result.errors.push(`Failed to process ${jobListing.title}: ${error.message}`);
        }
      }

    } catch (error) {
      this.logger.error('Failed to scrape dev.bg:', error);
      result.errors.push(`Scraping failed: ${error.message}`);
    }

    result.duration = Date.now() - startTime;
    
    this.logger.log(`Dev.bg scraping completed in ${result.duration}ms`, {
      totalJobsFound: result.totalJobsFound,
      newVacancies: result.newVacancies,
      updatedVacancies: result.updatedVacancies,
      newCompanies: result.newCompanies,
      errors: result.errors.length,
    });

    return result;
  }

  private async processJobListing(jobListing: DevBgJobListing, result: ScrapingResult, enableAiExtraction: boolean = true, enableCompanyAnalysis: boolean = true): Promise<void> {
    try {
      // Find or create company
      const company = await this.companyService.findOrCreate({
        name: jobListing.company,
        location: jobListing.location,
        industry: 'Technology',
      });

      if (!company.id) {
        result.newCompanies++;
      }

      // Fetch additional job details if URL is available
      let description = jobListing.description || '';
      let rawHtml = '';
      let companyProfileUrl: string | undefined;
      let companyWebsite: string | undefined;

      if (jobListing.url) {
        try {
          const jobDetails = await this.devBgScraper.fetchJobDetails(jobListing.url);
          description = jobDetails.description || description;
          rawHtml = jobDetails.rawHtml || '';
          companyProfileUrl = jobDetails.companyProfileUrl;
          companyWebsite = jobDetails.companyWebsite;
          // Note: requirements from job details are not currently used, 
          // using technologies from job listing instead
        } catch (error) {
          this.logger.warn(`Failed to fetch job details for ${jobListing.url}:`, error.message);
        }
      }

      // Prepare vacancy data
      const vacancyData = {
        title: jobListing.title,
        description,
        requirements: JSON.stringify(jobListing.technologies),
        location: jobListing.location,
        salaryMin: this.parseSalaryMin(jobListing.salaryRange),
        salaryMax: this.parseSalaryMax(jobListing.salaryRange),
        experienceLevel: this.extractExperienceLevel(jobListing.title),
        employmentType: this.mapWorkModelToEmploymentType(jobListing.workModel),
        companyId: company.id,
        sourceUrl: jobListing.url,
        sourceSite: 'dev.bg',
        status: 'active',
        postedAt: jobListing.postedDate,
      };

      // Check if vacancy already exists
      const existingVacancy = await this.findExistingVacancy(
        jobListing.title,
        company.id,
        jobListing.url
      );

      let vacancyId: string;
      if (existingVacancy) {
        // Update existing vacancy
        await this.vacancyService.update(existingVacancy.id, {
          ...vacancyData,
          status: 'active', // Reactivate if it was inactive
        });
        vacancyId = existingVacancy.id;
        result.updatedVacancies++;
        this.logger.log(`Updated existing vacancy: ${jobListing.title} at ${company.name}`);
      } else {
        // Create new vacancy
        const newVacancyResponse = await this.vacancyService.create(vacancyData);
        vacancyId = newVacancyResponse.data.id;
        result.newVacancies++;
        this.logger.log(`Created new vacancy: ${jobListing.title} at ${company.name}`);
      }

      // Queue AI extraction job if enabled and we have content
      this.logger.log(`AI extraction check: enabled=${enableAiExtraction}, hasUrl=${!!jobListing.url}, rawHtmlLength=${rawHtml.length}, descriptionLength=${description.length}`);
      if (enableAiExtraction && jobListing.url) {
        // Use raw HTML for AI extraction, fallback to description or basic job data
        const contentForAi = rawHtml || description || `${jobListing.title}\nCompany: ${jobListing.company}\nLocation: ${jobListing.location}\nTechnologies: ${(jobListing.technologies || []).join(', ')}`;
        
        this.logger.log(`Attempting to queue AI extraction for vacancy ${vacancyId} with content length: ${contentForAi.length}`);
        await this.queueAiExtraction(vacancyId, contentForAi, jobListing.url);
      } else {
        this.logger.log(`Skipping AI extraction for vacancy ${vacancyId}: enableAiExtraction=${enableAiExtraction}, hasUrl=${!!jobListing.url}`);
      }

      // Process company URLs and queue company analysis if enabled
      if (enableCompanyAnalysis && (companyProfileUrl || companyWebsite)) {
        this.logger.log(`Company analysis check: enabled=${enableCompanyAnalysis}, profileUrl=${!!companyProfileUrl}, website=${!!companyWebsite}`);
        await this.processCompanyUrls(company.id, companyProfileUrl, companyWebsite);
      } else {
        this.logger.log(`Skipping company analysis: enabled=${enableCompanyAnalysis}, profileUrl=${!!companyProfileUrl}, website=${!!companyWebsite}`);
      }

    } catch (error) {
      this.logger.error(`Error processing job listing: ${jobListing.title}`, error);
      throw error;
    }
  }

  private async findExistingVacancy(title: string, companyId: string, sourceUrl?: string) {
    // First try to find by source URL if available
    if (sourceUrl) {
      const vacancyByUrl = await this.prisma.vacancy.findFirst({
        where: { sourceUrl },
      });
      if (vacancyByUrl) return vacancyByUrl;
    }

    // Fallback to finding by title and company
    return await this.prisma.vacancy.findFirst({
      where: {
        title: {
          equals: title,
        },
        companyId,
      },
    });
  }

  private parseSalaryMin(salaryRange?: string): number | null {
    if (!salaryRange) return null;

    const match = salaryRange.match(/(\d+)/);
    return match ? parseInt(match[1], 10) * 100 : null; // Convert to cents
  }

  private parseSalaryMax(salaryRange?: string): number | null {
    if (!salaryRange) return null;

    const matches = salaryRange.match(/(\d+)/g);
    if (matches && matches.length > 1) {
      return parseInt(matches[1], 10) * 100; // Convert to cents
    }
    return this.parseSalaryMin(salaryRange);
  }

  private extractExperienceLevel(title: string): string {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('senior') || titleLower.includes('lead') || titleLower.includes('principal')) {
      return 'senior';
    }
    if (titleLower.includes('junior') || titleLower.includes('graduate') || titleLower.includes('entry')) {
      return 'junior';
    }
    if (titleLower.includes('mid') || titleLower.includes('intermediate')) {
      return 'mid';
    }
    
    return 'mid'; // Default to mid-level
  }

  private mapWorkModelToEmploymentType(workModel: string): string {
    const workModelMap: Record<string, string> = {
      'remote': 'full-time',
      'hybrid': 'full-time',
      'on-site': 'full-time',
      'part-time': 'part-time',
      'contract': 'contract',
      'internship': 'internship',
    };

    return workModelMap[workModel.toLowerCase()] || 'full-time';
  }

  async getScrapingStats(): Promise<ScrapingStats> {
    // Get statistics about scraped data
    return {
      totalVacancies: await this.prisma.vacancy.count({
        where: { sourceSite: 'dev.bg' },
      }),
      activeVacancies: await this.prisma.vacancy.count({
        where: { sourceSite: 'dev.bg', status: 'active' },
      }),
      companiesFromDevBg: await this.prisma.company.count({
        where: {
          vacancies: {
            some: { sourceSite: 'dev.bg' },
          },
        },
      }),
      lastScrapedAt: await this.getLastScrapedDate(),
    };
  }

  private async getLastScrapedDate(): Promise<string | null> {
    const lastVacancy = await this.prisma.vacancy.findFirst({
      where: { sourceSite: 'dev.bg' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    return lastVacancy?.createdAt?.toISOString() || null;
  }

  private async queueAiExtraction(vacancyId: string, content: string, sourceUrl: string): Promise<void> {
    try {
      
      // Create content hash for caching
      const contentHash = crypto.createHash('sha256').update(content).digest('hex');

      const aiExtractionData: AiExtractionJobData = {
        vacancyId,
        contentHash,
        content,
        sourceUrl,
        priority: 5, // Medium priority
        maxRetries: 2,
      };

      await this.scraperQueue.add('ai-extraction', aiExtractionData, {
        priority: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      });

      this.logger.log(`Queued AI extraction job for vacancy ${vacancyId}`);
    } catch (error) {
      this.logger.error(`Failed to queue AI extraction for vacancy ${vacancyId}:`, error);
    }
  }

  /**
   * Process company URLs and queue analysis jobs if needed
   */
  private async processCompanyUrls(companyId: string, companyProfileUrl?: string, companyWebsite?: string): Promise<void> {
    try {
      // Process dev.bg company profile URL if available
      if (companyProfileUrl) {
        await this.processCompanySource(companyId, 'dev.bg', companyProfileUrl, 'profile');
      }

      // Process company website URL if available
      if (companyWebsite) {
        await this.processCompanySource(companyId, 'company_website', companyWebsite, 'website');
      }

    } catch (error) {
      this.logger.error(`Failed to process company URLs for company ${companyId}:`, error);
    }
  }

  /**
   * Process a single company source and queue analysis if needed
   */
  private async processCompanySource(
    companyId: string,
    sourceSite: string,
    sourceUrl: string,
    analysisType: 'profile' | 'website'
  ): Promise<void> {
    try {
      // Check if we should scrape this company source
      const cacheCheck = await this.companySourceService.shouldScrapeCompanySource(
        companyId,
        sourceSite,
        sourceUrl
      );

      this.logger.log(`Company source check for ${sourceSite}: ${cacheCheck.reason}`);

      if (cacheCheck.shouldScrape) {
        // Validate the company URL first
        const validation = await this.companyProfileScraper.validateCompanyUrl(sourceUrl);
        
        if (validation.isValid) {
          // Queue company analysis job
          await this.queueCompanyAnalysis(companyId, sourceSite, sourceUrl, analysisType);
        } else {
          this.logger.warn(`Invalid company URL for ${sourceSite}: ${sourceUrl} - ${validation.error}`);
          // Mark source as invalid in the database
          await this.companySourceService.markSourceAsInvalid(companyId, sourceSite, validation.error);
        }
      }

    } catch (error) {
      this.logger.error(`Failed to process company source ${sourceSite} for company ${companyId}:`, error);
    }
  }

  /**
   * Queue company analysis job
   */
  private async queueCompanyAnalysis(
    companyId: string,
    sourceSite: string,
    sourceUrl: string,
    analysisType: 'profile' | 'website'
  ): Promise<void> {
    try {
      
      const companyAnalysisData: CompanyAnalysisJobData = {
        companyId,
        sourceSite,
        sourceUrl,
        analysisType,
        priority: 3, // Lower priority than vacancy extraction
        maxRetries: 2,
      };

      await this.scraperQueue.add('company-analysis', companyAnalysisData, {
        priority: 3,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000, // Longer delay for company analysis
        },
        removeOnComplete: 50,
        removeOnFail: 25,
      });

      this.logger.log(`Queued company analysis job for ${analysisType}: ${sourceUrl}`);
    } catch (error) {
      this.logger.error(`Failed to queue company analysis for ${sourceSite}:`, error);
    }
  }
}