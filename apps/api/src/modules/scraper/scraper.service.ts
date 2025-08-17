import { Injectable, Logger } from '@nestjs/common';
import { DevBgScraper, DevBgJobListing } from './scrapers/dev-bg.scraper';
import { VacancyService } from '../vacancy/vacancy.service';
import { CompanyService } from '../company/company.service';
import { PrismaService } from '../../common/database/prisma.service';

export interface ScrapingResult {
  totalJobsFound: number;
  newVacancies: number;
  updatedVacancies: number;
  newCompanies: number;
  errors: string[];
  duration: number;
}

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    private readonly devBgScraper: DevBgScraper,
    private readonly vacancyService: VacancyService,
    private readonly companyService: CompanyService,
    private readonly prisma: PrismaService,
  ) {
    this.logger.log('ScraperService initialized');
  }

  async scrapeDevBg(): Promise<ScrapingResult> {
    const startTime = Date.now();
    this.logger.log('Starting dev.bg scraping process');

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

      // Process each job listing
      for (const jobListing of jobListings) {
        try {
          await this.processJobListing(jobListing, result);
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

  private async processJobListing(jobListing: DevBgJobListing, result: ScrapingResult): Promise<void> {
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

      if (jobListing.url) {
        try {
          const jobDetails = await this.devBgScraper.fetchJobDetails(jobListing.url);
          description = jobDetails.description || description;
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

      if (existingVacancy) {
        // Update existing vacancy
        await this.vacancyService.update(existingVacancy.id, {
          ...vacancyData,
          status: 'active', // Reactivate if it was inactive
        });
        result.updatedVacancies++;
        this.logger.log(`Updated existing vacancy: ${jobListing.title} at ${company.name}`);
      } else {
        // Create new vacancy
        await this.vacancyService.create(vacancyData);
        result.newVacancies++;
        this.logger.log(`Created new vacancy: ${jobListing.title} at ${company.name}`);
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

  async getScrapingStats(): Promise<any> {
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

  private async getLastScrapedDate(): Promise<Date | null> {
    const lastVacancy = await this.prisma.vacancy.findFirst({
      where: { sourceSite: 'dev.bg' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    return lastVacancy?.createdAt || null;
  }
}