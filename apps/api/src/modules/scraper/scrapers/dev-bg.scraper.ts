import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { TranslationService } from '../services/translation.service';
import { JobParserService } from '../services/job-parser.service';
import { TechPatternService } from '../services/tech-pattern.service';

export interface DevBgJobListing {
  title: string;
  company: string;
  location: string;
  workModel: string;
  technologies: string[];
  salaryRange?: string;
  postedDate: Date;
  url: string;
  description?: string;
  requirements?: string;
}

export interface DevBgScraperOptions {
  page?: number;
  limit?: number;
  keywords?: string[];
}

/**
 * Simplified DevBgScraper that orchestrates scraping using specialized services
 * Focuses on coordination rather than implementation details
 */
@Injectable()
export class DevBgScraper {
  private readonly logger = new Logger(DevBgScraper.name);
  private readonly baseUrl: string;
  private readonly apiUrl: string;
  private readonly requestTimeout: number;
  private readonly requestDelay: number;
  private readonly maxPages: number;
  private readonly userAgent: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly translationService: TranslationService,
    private readonly jobParserService: JobParserService,
    private readonly techPatternService: TechPatternService,
  ) {
    this.baseUrl = this.configService.get<string>('scraper.devBg.baseUrl', 'https://dev.bg');
    this.apiUrl = this.configService.get<string>('scraper.devBg.apiUrl', 'https://dev.bg/company/jobs/java/');
    this.requestTimeout = this.configService.get<number>('scraper.devBg.requestTimeout', 30000);
    this.requestDelay = this.configService.get<number>('scraper.devBg.requestDelay', 2000);
    this.maxPages = this.configService.get<number>('scraper.devBg.maxPages', 10);
    this.userAgent = this.configService.get<string>('scraper.devBg.userAgent', 'TalentRadar/1.0 (Job Aggregator)');
  }

  async scrapeJavaJobs(options: DevBgScraperOptions = {}): Promise<DevBgJobListing[]> {
    const { page = 1, limit } = options;
    
    this.logger.log(`Starting to scrape Java jobs from dev.bg - Page ${page}${limit ? ` (limit: ${limit})` : ''}`);
    
    try {
      const url = page === 1 ? this.apiUrl : `${this.apiUrl}page/${page}/`;
      this.logger.log(`Fetching HTML from: ${url}`);
      
      const response = await this.fetchPage(url);
      if (!response.data) {
        this.logger.warn(`No HTML data received from dev.bg for page ${page}`);
        return [];
      }

      const jobs = this.parseJobsFromHtml(response.data, page);
      
      // Apply limit if specified
      if (limit && jobs.length > limit) {
        this.logger.log(`Limiting results to ${limit} jobs (found ${jobs.length})`);
        return jobs.slice(0, limit);
      }
      
      return jobs;

    } catch (error) {
      this.logger.error(`Failed to scrape dev.bg jobs for page ${page}:`, error.message);
      throw error;
    }
  }

  async scrapeAllJavaJobs(): Promise<DevBgJobListing[]> {
    const allJobs: DevBgJobListing[] = [];
    let currentPage = 1;
    
    this.logger.log('Starting complete scrape of Java jobs from dev.bg');

    while (currentPage <= this.maxPages) {
      try {
        const jobs = await this.scrapeJavaJobs({ page: currentPage });
        
        if (jobs.length === 0) {
          this.logger.log(`No more jobs found at page ${currentPage}, stopping scrape`);
          break;
        }

        allJobs.push(...jobs);
        this.logger.log(`Scraped ${jobs.length} jobs from page ${currentPage}, total: ${allJobs.length}`);
        
        currentPage++;
        await this.delay(this.requestDelay);
        
      } catch (error) {
        this.logger.error(`Error scraping page ${currentPage}:`, error.message);
        break;
      }
    }

    this.logger.log(`Completed scraping dev.bg. Total jobs found: ${allJobs.length}`);
    return allJobs;
  }

  async fetchJobDetails(jobUrl: string, companyName?: string): Promise<{ 
    description: string; 
    requirements: string; 
    rawHtml?: string;
    companyProfileUrl?: string;
    companyWebsite?: string;
    salaryInfo?: { min?: number; max?: number; currency?: string };
  }> {
    try {
      this.logger.log(`Fetching job details from: ${jobUrl}`);
      
      const response = await axios.get(jobUrl, {
        headers: { 'User-Agent': this.userAgent },
        timeout: this.requestTimeout / 2,
      });

      const jobDetails = this.jobParserService.parseJobDetailsFromHtml(response.data);
      const companyUrls = this.jobParserService.extractCompanyUrls(response.data, companyName);
      const salaryInfo = this.extractSalaryFromContent(response.data);
      
      return {
        description: this.translationService.translateJobTerms(jobDetails.description),
        requirements: this.translationService.translateJobTerms(jobDetails.requirements),
        rawHtml: response.data,
        companyProfileUrl: companyUrls.profileUrl,
        companyWebsite: companyUrls.website,
        salaryInfo,
      };

    } catch (error) {
      this.logger.warn(`Failed to fetch job details from ${jobUrl}:`, error.message);
      return { description: '', requirements: '' };
    }
  }

  private extractSalaryFromContent(html: string): { min?: number; max?: number; currency?: string } | undefined {
    try {
      // Remove HTML tags to get plain text
      const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
      
      // Salary patterns for Bulgarian job sites (handle both comma and space separators)
      const patterns = [
        // "4 500 - 9 500 лв" or "4,500 - 9,500 BGN net monthly"
        /(\d+[\s,\d]*)\s*[-–]\s*(\d+[\s,\d]*)\s*(BGN|лв|лева)\s*(net|gross|netto|brutto|месечно|monthly)?/gi,
        // "Net Monthly: 4500-9500 BGN" 
        /(net|gross|netto|brutto|месечно|monthly)?\s*:?\s*(\d+[\s,\d]*)\s*[-–]\s*(\d+[\s,\d]*)\s*(BGN|лв|лева)/gi,
        // "От 5000 до 8000 лв"
        /от\s+(\d+[\s,\d]*)\s+до\s+(\d+[\s,\d]*)\s*(лв|лева|BGN)/gi,
        // "Up to 9500 BGN"
        /up\s+to\s+(\d+[\s,\d]*)\s*(BGN|лв|лева)/gi,
        // "до 9500 лв"
        /до\s+(\d+[\s,\d]*)\s*(лв|лева|BGN)/gi,
      ];

      for (const pattern of patterns) {
        const match = pattern.exec(text);
        if (match) {
          let salaryMin: number | undefined;
          let salaryMax: number | undefined;
          let currency = 'BGN';

          // Different pattern structures
          if (match[1] && match[2] && match[3]) {
            // Range pattern: min - max currency
            salaryMin = parseInt(match[1].replace(/[\s,]/g, ''));
            salaryMax = parseInt(match[2].replace(/[\s,]/g, ''));
            
            // Normalize currency
            if (match[3].toLowerCase().includes('лв') || match[3].toLowerCase().includes('лева')) {
              currency = 'BGN';
            } else {
              currency = match[3].toUpperCase();
            }
          } else if (match[2] && match[3] && match[4]) {
            // Range pattern with prefix: prefix min - max currency
            salaryMin = parseInt(match[2].replace(/[\s,]/g, ''));
            salaryMax = parseInt(match[3].replace(/[\s,]/g, ''));
            currency = match[4].includes('лв') ? 'BGN' : match[4].toUpperCase();
          } else if (match[1] && match[2]) {
            // Single value pattern: up to X currency
            if (text.toLowerCase().includes('up to') || text.toLowerCase().includes('до')) {
              salaryMax = parseInt(match[1].replace(/[\s,]/g, ''));
              currency = match[2].includes('лв') ? 'BGN' : match[2].toUpperCase();
            }
          }

          if (salaryMin || salaryMax) {
            this.logger.log(`Extracted salary: ${salaryMin || 'N/A'} - ${salaryMax || 'N/A'} ${currency}`);
            return { min: salaryMin, max: salaryMax, currency };
          }
        }
      }

      return undefined;
    } catch (error) {
      this.logger.warn('Error extracting salary information:', error.message);
      return undefined;
    }
  }

  private async fetchPage(url: string) {
    return axios.get(url, {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: this.requestTimeout,
    });
  }

  private parseJobsFromHtml(htmlTemplate: string, page: number): DevBgJobListing[] {
    const jobs: DevBgJobListing[] = [];
    
    try {
      const $ = cheerio.load(htmlTemplate);
      const jobElements = $('.job-list-item');
      
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

  private processJobElement($: cheerio.CheerioAPI, element: any): DevBgJobListing | null {
    // Parse raw data using JobParserService
    const rawJobData = this.jobParserService.parseJobFromElement($, element);
    if (!rawJobData) {
      return null;
    }

    // Extract location and work model from badge text
    const location = this.translationService.parseLocationFromBadge(rawJobData.badgeText);
    const workModel = this.translationService.parseWorkModelFromBadge(rawJobData.badgeText);

    // Extract technologies from multiple sources
    const imageTechs = this.techPatternService.extractTechnologiesFromImageTitles(rawJobData.techImageTitles);
    const textTechs = this.techPatternService.extractTechnologiesFromText(rawJobData.fullJobText);
    const technologies = this.techPatternService.combineTechnologies(textTechs, imageTechs);

    // Determine posted date
    const postedDate = this.determinePostedDate(rawJobData);

    return {
      title: this.translationService.translateJobTerms(rawJobData.title),
      company: this.translationService.translateJobTerms(rawJobData.company),
      location,
      workModel,
      technologies,
      salaryRange: rawJobData.salaryRange,
      postedDate,
      url: rawJobData.url,
      description: '',
      requirements: '',
    };
  }

  private determinePostedDate(rawJobData: any): Date {
    if (rawJobData.timeElement?.datetime) {
      return new Date(rawJobData.timeElement.datetime);
    }

    // Look for Bulgarian date patterns in the job text
    const bulgariandateStr = this.jobParserService.findBulgarianDateInText(rawJobData.fullJobText);
    if (bulgariandateStr) {
      return this.translationService.parseBulgarianDate(bulgariandateStr);
    }

    return new Date(); // fallback to current date
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}