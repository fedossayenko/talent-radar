import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cheerio from 'cheerio';
import { BaseScraper } from './base.scraper';
import {
  JobListing,
  ScraperOptions,
  ScrapingResult,
  JobDetails,
} from '../interfaces/job-scraper.interface';

/**
 * Jobs.bg job scraper implementation
 * Bulgarian job site with different structure than dev.bg
 */
@Injectable()
export class JobsBgScraper extends BaseScraper {
  private readonly baseUrl: string;
  private readonly searchUrl: string;
  private readonly maxPages: number;

  constructor(configService: ConfigService) {
    super(configService, 'jobs.bg');
    
    this.baseUrl = this.configService.get<string>('scraper.jobsBg.baseUrl', 'https://www.jobs.bg');
    this.searchUrl = this.configService.get<string>('scraper.jobsBg.searchUrl', 'https://www.jobs.bg/en/front_job_search.php');
    this.maxPages = this.configService.get<number>('scraper.jobsBg.maxPages', 10);
  }

  async scrapeJobs(options: ScraperOptions = {}): Promise<ScrapingResult> {
    const { page = 1, limit, keywords = ['Java'], location, experienceLevel } = options;
    const startTime = Date.now();
    
    this.logger.log(`Starting to scrape jobs from jobs.bg - Page ${page}${limit ? ` (limit: ${limit})` : ''}`);
    
    try {
      const url = this.buildSearchUrl(page, keywords, location, experienceLevel);
      this.logger.log(`Fetching HTML from: ${url}`);
      
      const response = await this.makeRequest(url);
      if (!response.data) {
        this.logger.warn(`No HTML data received from jobs.bg for page ${page}`);
        return this.createEmptyResult(page, startTime, url);
      }

      const jobs = await this.parseJobsFromHtml(response.data, page);
      
      // Apply limit if specified
      const limitedJobs = limit && jobs.length > limit ? jobs.slice(0, limit) : jobs;
      
      if (limit && jobs.length > limit) {
        this.logger.log(`Limiting results to ${limit} jobs (found ${jobs.length})`);
      }
      
      // Check if there are more pages
      const hasNextPage = this.hasNextPage(response.data, page);
      
      return {
        jobs: limitedJobs,
        totalFound: limitedJobs.length,
        page,
        hasNextPage,
        errors: [],
        metadata: {
          processingTime: Date.now() - startTime,
          sourceUrl: url,
          requestCount: 1,
        },
      };

    } catch (error) {
      this.logger.error(`Failed to scrape jobs.bg jobs for page ${page}:`, error.message);
      return {
        jobs: [],
        totalFound: 0,
        page,
        hasNextPage: false,
        errors: [error.message],
        metadata: {
          processingTime: Date.now() - startTime,
          sourceUrl: this.searchUrl,
          requestCount: 1,
        },
      };
    }
  }

  async fetchJobDetails(jobUrl: string, _companyName?: string): Promise<JobDetails> {
    try {
      this.logger.log(`Fetching job details from: ${jobUrl}`);
      
      const response = await this.makeRequest(jobUrl);
      
      return this.parseJobDetailsFromHtml(response.data, jobUrl);

    } catch (error) {
      this.logger.warn(`Failed to fetch job details from ${jobUrl}:`, error.message);
      return { 
        description: '', 
        requirements: '',
        rawHtml: '',
      };
    }
  }

  getSiteConfig() {
    return {
      name: 'jobs.bg',
      baseUrl: this.baseUrl,
      supportedLocations: ['София', 'Пловдив', 'Варна', 'Бургас', 'Стара Загора', 'Remote'],
      supportedCategories: ['Java', 'JavaScript', 'Python', 'C#', '.NET', 'PHP', 'React', 'Angular'],
    };
  }

  canHandle(url: string): boolean {
    return url.includes('jobs.bg');
  }

  private buildSearchUrl(page: number, keywords: string[], location?: string, experienceLevel?: string): string {
    const params = new URLSearchParams();
    
    // Add categories - using Java category 56 based on user's example
    if (keywords.includes('Java')) {
      params.append('categories[0]', '56');
    }
    
    // Add technologies with indexed format
    keywords.forEach((keyword, index) => {
      params.append(`techs[${index}]`, keyword);
    });
    
    // Add location if specified
    if (location) {
      params.append('location', location);
    }
    
    // Add experience level if specified
    if (experienceLevel) {
      params.append('experience', experienceLevel);
    }
    
    // Add page if not first page
    if (page > 1) {
      params.append('page', page.toString());
    }
    
    return `${this.searchUrl}?${params.toString()}`;
  }

  private async parseJobsFromHtml(html: string, page: number): Promise<JobListing[]> {
    const jobs: JobListing[] = [];
    
    try {
      const $ = cheerio.load(html);
      
      // Jobs.bg uses .job-item containers based on actual site structure
      const jobElements = $('.job-item');
      
      this.logger.log(`Found ${jobElements.length} job listings in HTML for page ${page}`);

      jobElements.each((index, element) => {
        try {
          const job = this.processJobElement($, element);
          if (job) {
            jobs.push(job);
          }
        } catch (error) {
          this.logger.warn(`Failed to parse job listing ${index + 1}:`, error.message);
        }
      });

    } catch (error) {
      this.logger.error('Failed to parse jobs from HTML:', error.message);
    }

    return jobs;
  }

  private processJobElement($: cheerio.CheerioAPI, element: any): JobListing | null {
    try {
      // Actual jobs.bg selectors based on HTML structure analysis
      const titleElement = $(element).find('.job-title a');
      const companyElement = $(element).find('.company-name');
      const locationElement = $(element).find('.company-location, .location');
      const linkElement = $(element).find('.job-title a').first();
      const dateElement = $(element).find('.date');
      const salaryElement = $(element).find('.salary');
      const workTypeElement = $(element).find('.work-type');
      
      const title = titleElement.text().trim();
      const company = companyElement.text().trim();
      const location = locationElement.first().text().trim();
      const link = linkElement.attr('href');
      const dateText = dateElement.text().trim();
      const salaryText = salaryElement.text().trim();
      const workTypeText = workTypeElement.text().trim();
      
      if (!title || !company || !link) {
        return null;
      }
      
      // Build full URL if relative
      const fullUrl = link.startsWith('http') ? link : `${this.baseUrl}${link}`;
      
      // Extract technologies from specific tech elements and job text
      const techElements = $(element).find('.tech');
      const technologies: string[] = [];
      techElements.each((i, techEl) => {
        const tech = $(techEl).text().trim();
        if (tech) technologies.push(tech);
      });
      
      // Fallback: extract from job text if no tech elements found
      if (technologies.length === 0) {
        const jobText = $(element).text();
        technologies.push(...this.extractTechnologies(jobText));
      }
      
      return {
        title,
        company: this.normalizeCompanyName(company),
        location: location || 'Sofia', // Default to Sofia
        workModel: this.determineWorkModelFromText(workTypeText, $(element).text()),
        technologies,
        postedDate: this.parsePostedDate(dateText),
        salaryRange: salaryText || undefined,
        url: fullUrl,
        originalJobId: this.extractJobId(fullUrl),
        sourceSite: 'jobs.bg',
        description: $(element).find('.job-description').text().trim() || '',
        requirements: '',
        experienceLevel: this.determineExperienceLevel(title, $(element).text()),
        employmentType: 'full-time', // Default
      };
      
    } catch (error) {
      this.logger.warn('Error processing job element:', error.message);
      return null;
    }
  }

  private parseJobDetailsFromHtml(html: string, _jobUrl: string): JobDetails {
    const $ = cheerio.load(html);
    
    // Extract job description and requirements
    const descriptionElement = $('.job-description, .description, .content, .job-content').first();
    const requirementsElement = $('.requirements, .job-requirements').first();
    
    const description = descriptionElement.text().trim();
    const requirements = requirementsElement.text().trim();
    
    // Extract salary information
    const salaryInfo = this.extractSalaryFromContent(html);
    
    // Extract company information
    const companyLinkElement = $('.company-link, .employer-link, a[href*="/company/"]').first();
    const companyWebsite = companyLinkElement.attr('href');
    const companyProfileUrl = companyWebsite?.startsWith('http') ? companyWebsite : `${this.baseUrl}${companyWebsite}`;
    
    // Extract benefits if available
    const benefitsElement = $('.benefits, .perks, .job-benefits');
    const benefits: string[] = [];
    benefitsElement.each((index, element) => {
      const benefitText = $(element).text().trim();
      if (benefitText) {
        benefits.push(benefitText);
      }
    });
    
    // Extract application deadline
    const deadlineElement = $('.deadline, .apply-until, .valid-until');
    const deadlineText = deadlineElement.text().trim();
    let applicationDeadline: Date | undefined;
    if (deadlineText) {
      try {
        applicationDeadline = new Date(deadlineText);
        if (isNaN(applicationDeadline.getTime())) {
          applicationDeadline = undefined;
        }
      } catch {
        applicationDeadline = undefined;
      }
    }
    
    return {
      description,
      requirements,
      benefits,
      rawHtml: html,
      companyProfileUrl,
      companyWebsite: companyProfileUrl,
      salaryInfo,
      applicationDeadline,
    };
  }

  private determineWorkModel(text: string): string {
    const textLower = text.toLowerCase();
    
    if (textLower.includes('remote')) {
      return 'remote';
    }
    
    if (textLower.includes('hybrid')) {
      return 'hybrid';
    }
    
    if (textLower.includes('office') || textLower.includes('on-site')) {
      return 'office';
    }
    
    return 'not_specified';
  }

  private determineWorkModelFromText(workTypeText: string, fallbackText: string): string {
    // First try the specific work type element
    if (workTypeText) {
      const workType = workTypeText.toLowerCase().trim();
      if (workType.includes('remote')) {
        return 'remote';
      }
      if (workType.includes('hybrid')) {
        return 'hybrid';  
      }
      if (workType.includes('office') || workType.includes('on-site')) {
        return 'office';
      }
    }
    
    // Fallback to general text analysis
    return this.determineWorkModel(fallbackText);
  }


  private determineExperienceLevel(title: string, text: string): string {
    const combined = (title + ' ' + text).toLowerCase();
    
    if (combined.includes('senior') || combined.includes('старши')) return 'senior';
    if (combined.includes('junior') || combined.includes('младши')) return 'junior';
    if (combined.includes('lead') || combined.includes('ръководител')) return 'lead';
    if (combined.includes('principal') || combined.includes('главен')) return 'principal';
    if (combined.includes('mid') || combined.includes('middle')) return 'mid';
    if (combined.includes('стаж') || combined.includes('intern')) return 'entry';
    
    return 'not_specified';
  }

  private extractJobId(url: string): string | undefined {
    // Extract job ID from jobs.bg URL patterns
    // e.g., "https://www.jobs.bg/job/8102284" -> "8102284"
    const match = url.match(/\/job\/(\d+)/);
    return match ? match[1] : undefined;
  }

  private hasNextPage(html: string, currentPage: number): boolean {
    const $ = cheerio.load(html);
    
    // Look for pagination elements
    const nextButton = $('.pagination .next, .paging .next, [rel="next"]');
    if (nextButton.length > 0 && !nextButton.hasClass('disabled')) {
      return true;
    }
    
    // Look for page numbers
    const pageNumbers = $('.pagination a, .paging a').toArray().map(el => {
      const pageNum = parseInt($(el).text().trim(), 10);
      return isNaN(pageNum) ? 0 : pageNum;
    });
    
    return pageNumbers.some(num => num > currentPage);
  }

  private createEmptyResult(page: number, startTime: number, url: string): ScrapingResult {
    return {
      jobs: [],
      totalFound: 0,
      page,
      hasNextPage: false,
      errors: [],
      metadata: {
        processingTime: Date.now() - startTime,
        sourceUrl: url,
        requestCount: 1,
      },
    };
  }
}