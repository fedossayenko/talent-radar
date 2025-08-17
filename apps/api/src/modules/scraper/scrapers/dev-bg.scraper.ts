import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as cheerio from 'cheerio';

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

@Injectable()
export class DevBgScraper {
  private readonly logger = new Logger(DevBgScraper.name);
  private readonly baseUrl: string;
  private readonly apiUrl: string;
  private readonly requestTimeout: number;
  private readonly requestDelay: number;
  private readonly maxPages: number;
  private readonly userAgent: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('scraper.devBg.baseUrl', 'https://dev.bg');
    this.apiUrl = this.configService.get<string>('scraper.devBg.apiUrl', 'https://dev.bg/company/jobs/java/');
    this.requestTimeout = this.configService.get<number>('scraper.devBg.requestTimeout', 30000);
    this.requestDelay = this.configService.get<number>('scraper.devBg.requestDelay', 2000);
    this.maxPages = this.configService.get<number>('scraper.devBg.maxPages', 10);
    this.userAgent = this.configService.get<string>('scraper.devBg.userAgent', 'TalentRadar/1.0 (Job Aggregator)');
  }

  async scrapeJavaJobs(options: DevBgScraperOptions = {}): Promise<DevBgJobListing[]> {
    const { page = 1 } = options;
    
    this.logger.log(`Starting to scrape Java jobs from dev.bg - Page ${page}`);
    
    try {
      // Construct URL with pagination
      const url = page === 1 ? this.apiUrl : `${this.apiUrl}page/${page}/`;
      
      this.logger.log(`Fetching HTML from: ${url}`);
      
      // Fetch HTML page directly
      const response = await axios.get(url, {
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

      if (!response.data) {
        this.logger.warn(`No HTML data received from dev.bg for page ${page}`);
        return [];
      }

      return this.parseJobsFromHtml(response.data, page);

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
        
        // Add delay to be respectful to the server
        await this.delay(this.requestDelay);
        
      } catch (error) {
        this.logger.error(`Error scraping page ${currentPage}:`, error.message);
        break;
      }
    }

    this.logger.log(`Completed scraping dev.bg. Total jobs found: ${allJobs.length}`);
    return allJobs;
  }

  private parseJobsFromHtml(htmlTemplate: string, page: number): DevBgJobListing[] {
    const jobs: DevBgJobListing[] = [];
    
    try {
      // Load HTML into Cheerio
      const $ = cheerio.load(htmlTemplate);
      
      // Find all job listings using the correct selector
      const jobElements = $('.job-list-item');
      
      this.logger.log(`Found ${jobElements.length} job listings in HTML for page ${page}`);

      jobElements.each((index, element) => {
        try {
          const job = this.parseJobFromElement($, element);
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

  private parseJobFromElement($: cheerio.CheerioAPI, element: any): DevBgJobListing | null {
    try {
      const $element = $(element);
      
      // Extract job title from h6.job-title (no link inside)
      const titleElement = $element.find('h6.job-title, .job-title');
      const title = titleElement.text().trim();

      // Extract company name from .company-name
      const companyElement = $element.find('.company-name');
      const company = companyElement.text().trim();

      // Extract job URL from the overlay link
      const linkElement = $element.find('a.overlay-link, a[href*="jobads"]');
      const url = linkElement.attr('href') || '';

      // Extract location and work model from .badge elements
      const badgeElements = $element.find('.badge');
      let location = 'Bulgaria';
      let workModel = 'on-site'; // default
      
      // Parse the first badge which contains location and work model
      if (badgeElements.length > 0) {
        const badgeText = badgeElements.first().text().trim();
        
        // Extract location (first line before work model indicators)
        const lines = badgeText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        if (lines.length > 0) {
          location = lines[0]; // First line is the location
        }
        
        // Determine work model from badge text
        const badgeTextLower = badgeText.toLowerCase();
        if (badgeTextLower.includes('remote') || badgeTextLower.includes('дистанционно')) {
          workModel = 'remote';
        } else if (badgeTextLower.includes('hybrid') || badgeTextLower.includes('хибридно')) {
          workModel = 'hybrid';
        }
      }
      
      // Translate Bulgarian locations to English
      location = this.translateLocation(location);

      // Extract technologies from img title attributes in tech-stack
      const technologies = this.extractTechnologiesFromElement($element);

      // Extract salary if available - look for salary indicators
      let salaryRange: string | undefined;
      const salaryElement = $element.find('.salary, .price, [class*="salary"]');
      if (salaryElement.length > 0) {
        salaryRange = salaryElement.text().trim();
      }

      // Extract posted date - look for time elements or date indicators
      let postedDate = new Date();
      const timeElement = $element.find('time');
      if (timeElement.length > 0) {
        const datetime = timeElement.attr('datetime');
        if (datetime) {
          postedDate = new Date(datetime);
        }
      } else {
        // Look for Bulgarian date patterns
        const dateText = $element.text();
        const bulgariandateMatch = dateText.match(/(\d{1,2})\s+(януари|февруари|март|април|май|юни|юли|август|септември|октомври|ноември|декември)/i);
        if (bulgariandateMatch) {
          postedDate = this.parseBulgarianDate(bulgariandateMatch[0]);
        }
      }

      if (!title || !company) {
        this.logger.warn('Skipping job listing: missing title or company');
        return null;
      }

      return {
        title: this.translateText(title),
        company: this.translateText(company),
        location,
        workModel,
        technologies,
        salaryRange,
        postedDate,
        url,
        description: '', // Will be populated when fetching individual job details
        requirements: '', // Will be populated when fetching individual job details
      };

    } catch (error) {
      this.logger.error('Error parsing job element:', error.message);
      return null;
    }
  }

  private extractTechnologiesFromElement($element: cheerio.Cheerio<any>): string[] {
    const technologies: string[] = [];
    
    // Look for technology icons with title attributes
    const techImages = $element.find('img[title]');
    techImages.each((index, _img) => {
      const title = techImages.eq(index).attr('title');
      if (title) {
        const tech = title.toLowerCase().trim();
        if (tech && !technologies.includes(tech)) {
          technologies.push(tech);
        }
      }
    });
    
    // Look for technology text patterns in job content
    const jobText = $element.text().toLowerCase();
    const techPatterns = [
      /java/gi,
      /spring/gi,
      /hibernate/gi,
      /maven/gi,
      /gradle/gi,
      /mysql/gi,
      /postgresql/gi,
      /docker/gi,
      /kubernetes/gi,
      /aws/gi,
      /git/gi,
      /jenkins/gi,
      /junit/gi,
      /rest/gi,
      /api/gi,
      /microservices/gi,
    ];

    for (const pattern of techPatterns) {
      const matches = jobText.match(pattern);
      if (matches) {
        const tech = matches[0].toLowerCase();
        if (!technologies.includes(tech)) {
          technologies.push(tech);
        }
      }
    }

    return technologies;
  }

  private parseBulgarianDate(dateStr: string): Date {
    const monthMap: Record<string, number> = {
      'януари': 0, 'февруари': 1, 'март': 2, 'април': 3,
      'май': 4, 'юни': 5, 'юли': 6, 'август': 7,
      'септември': 8, 'октомври': 9, 'ноември': 10, 'декември': 11
    };

    const match = dateStr.match(/(\d{1,2})\s+(януари|февруари|март|април|май|юни|юли|август|септември|октомври|ноември|декември)/i);
    if (match) {
      const day = parseInt(match[1], 10);
      const monthName = match[2].toLowerCase();
      const month = monthMap[monthName];
      const year = new Date().getFullYear(); // Use current year
      
      if (month !== undefined) {
        return new Date(year, month, day);
      }
    }
    
    return new Date(); // fallback to current date
  }

  private translateLocation(location: string): string {
    const locationMap: Record<string, string> = {
      'София': 'Sofia',
      'Пловдив': 'Plovdiv',
      'Варна': 'Varna',
      'Бургас': 'Burgas',
      'Русе': 'Ruse',
      'Стара Загора': 'Stara Zagora',
      'Плевен': 'Pleven',
      'Дистанционно': 'Remote',
      'Хибридно': 'Hybrid',
      'Fully Remote': 'Remote',
    };

    return locationMap[location] || location;
  }

  private translateWorkModel(workModel: string): string {
    const workModelMap: Record<string, string> = {
      'Дистанционно': 'remote',
      'Хибридно': 'hybrid',
      'В офиса': 'on-site',
      'Remote': 'remote',
      'Hybrid': 'hybrid',
      'On-site': 'on-site',
    };

    return workModelMap[workModel] || 'full-time';
  }

  private translateText(text: string): string {
    // Basic translation for common job-related terms
    const translations: Record<string, string> = {
      'Разработчик': 'Developer',
      'Програмист': 'Programmer',
      'Инженер': 'Engineer',
      'Старши': 'Senior',
      'Младши': 'Junior',
      'Лидер': 'Lead',
      'Архитект': 'Architect',
      'Бекенд': 'Backend',
      'Фронтенд': 'Frontend',
      'Фулстак': 'Full-stack',
    };

    let translatedText = text;
    for (const [bulgarian, english] of Object.entries(translations)) {
      translatedText = translatedText.replace(new RegExp(bulgarian, 'gi'), english);
    }

    return translatedText;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async fetchJobDetails(jobUrl: string): Promise<{ description: string; requirements: string }> {
    try {
      this.logger.log(`Fetching job details from: ${jobUrl}`);
      
      const response = await axios.get(jobUrl, {
        headers: {
          'User-Agent': this.userAgent,
        },
        timeout: this.requestTimeout / 2, // Use half timeout for individual job requests
      });

      // Parse the job description and requirements from the full job page
      const html = response.data;
      
      // Extract job description
      const descriptionMatch = html.match(/<div[^>]*class="[^"]*job-description[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      const description = descriptionMatch?.[1]?.replace(/<[^>]*>/g, '').trim() || '';

      // Extract requirements
      const requirementsMatch = html.match(/<div[^>]*class="[^"]*job-requirements[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      const requirements = requirementsMatch?.[1]?.replace(/<[^>]*>/g, '').trim() || '';

      return {
        description: this.translateText(description),
        requirements: this.translateText(requirements),
      };

    } catch (error) {
      this.logger.warn(`Failed to fetch job details from ${jobUrl}:`, error.message);
      return {
        description: '',
        requirements: '',
      };
    }
  }
}