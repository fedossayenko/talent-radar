import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cheerio from 'cheerio';
import { promises as fs } from 'fs';
import { join } from 'path';
import { BaseScraper } from './base.scraper';
import {
  JobListing,
  ScraperOptions,
  ScrapingResult,
  JobDetails,
} from '../interfaces/job-scraper.interface';
import { StealthBrowserEngineService } from '../services/stealth-browser-engine.service';

/**
 * Jobs.bg job scraper implementation
 * Bulgarian job site with different structure than dev.bg
 */
@Injectable()
export class JobsBgScraper extends BaseScraper {
  private readonly baseUrl: string;
  private readonly searchUrl: string;
  private readonly maxPages: number;

  constructor(
    configService: ConfigService,
    private readonly stealthBrowserEngine: StealthBrowserEngineService
  ) {
    super(configService, 'jobs.bg', stealthBrowserEngine);
    
    this.baseUrl = this.configService.get<string>('scraper.sites.jobsBg.baseUrl', 'https://www.jobs.bg');
    this.searchUrl = this.configService.get<string>('scraper.sites.jobsBg.searchUrl', 'https://www.jobs.bg/en/front_job_search.php');
    this.maxPages = this.configService.get<number>('scraper.sites.jobsBg.maxPages', 10);
    
    this.logger.log('JobsBgScraper initialized successfully');
  }

  async scrapeJobs(options: ScraperOptions = {}): Promise<ScrapingResult> {
    const { page = 1, limit, keywords = ['Java'], location, experienceLevel } = options;
    const startTime = Date.now();
    
    this.logger.log(`Starting to scrape jobs from jobs.bg - Page ${page}${limit ? ` (limit: ${limit})` : ''}`);
    
    try {
      const url = this.buildSearchUrl(page, keywords, location, experienceLevel);
      this.logger.log(`Fetching HTML from: ${url}`);
      
      // Use stealth browser with enhanced DataDome bypass techniques
      const response = await this.fetchWithStealthBrowser(url, { infiniteScroll: true, warmup: true });
      
      // Save raw HTML response to file for debugging
      if (response.html) {
        await this.saveResponseToFile(response.html, page);
      }
      
      if (!response.success || !response.html) {
        this.logger.warn(`Failed to fetch HTML from jobs.bg for page ${page}: ${response.error || 'No content'}`);
        return this.createEmptyResult(page, startTime, url);
      }

      // Check for DataDome protection before parsing
      if (this.isCaptchaOrBlocked(response.html)) {
        return {
          jobs: [],
          totalFound: 0,
          page,
          hasNextPage: false,
          errors: ['Jobs.bg is blocking automated access with DataDome protection. Consider using proxy rotation or manual access.'],
          metadata: {
            processingTime: Date.now() - startTime,
            sourceUrl: url,
            requestCount: 1,
          },
        };
      }

      const jobs = await this.parseJobsFromHtml(response.html, page);
      
      // Apply limit if specified
      const limitedJobs = limit && jobs.length > limit ? jobs.slice(0, limit) : jobs;
      
      if (limit && jobs.length > limit) {
        this.logger.log(`Limiting results to ${limit} jobs (found ${jobs.length})`);
      }
      
      // Check if there are more pages
      const hasNextPage = this.hasNextPage(response.html, page);
      
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
      
      // Use browser automation for job details as well
      const response = await this.fetchPage(jobUrl, { forceBrowser: true });
      
      if (!response.success || !response.html) {
        this.logger.warn(`Failed to fetch job details from ${jobUrl}: ${response.error || 'No content'}`);
        return { 
          description: '', 
          requirements: '',
          rawHtml: '',
        };
      }
      
      return this.parseJobDetailsFromHtml(response.html, jobUrl);

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
      
      // Check for CAPTCHA or anti-bot protection
      if (this.isCaptchaOrBlocked(html)) {
        this.logger.warn('Jobs.bg is showing CAPTCHA or anti-bot protection');
        return jobs; // Return empty array with warning logged
      }
      
      // Try multiple selectors for job listings
      const selectors = [
        'li .mdc-card',           // Primary selector
        '.job-item .mdc-card',    // Alternative 1
        '[data-job] .mdc-card',   // Alternative 2
        '.mdc-card[href]',        // Alternative 3
      ];
      
      let jobElements = $();
      for (const selector of selectors) {
        jobElements = $(selector);
        if (jobElements.length > 0) {
          this.logger.debug(`Found ${jobElements.length} jobs using selector: ${selector}`);
          break;
        }
      }
      
      if (jobElements.length === 0) {
        this.logger.warn('No job listings found with any selector - possible structure change or blocking');
      }
      
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
      // Updated selectors based on actual jobs.bg HTML structure
      const titleElement = $(element).find('.card-title span').last();
      const companyElement = $(element).find('.card-logo-info .secondary-text');
      const cardInfoElement = $(element).find('.card-info');
      const linkElement = $(element).find('.card-title').closest('a');
      const dateElement = $(element).find('.card-date');
      
      const title = titleElement.text().trim();
      const company = companyElement.text().trim();
      const link = linkElement.attr('href');
      const dateText = dateElement.first().contents().filter(function() {
        return this.nodeType === 3; // Text node
      }).text().trim();
      
      if (!title || !company || !link) {
        this.logger.debug(`Missing required fields - Title: "${title}", Company: "${company}", Link: "${link}"`);
        return null;
      }
      
      // Extract job metadata from card-info
      const cardInfoText = cardInfoElement.text();
      const locationMatch = cardInfoText.match(/location_on\s*([^;]+)/);
      const location = locationMatch ? locationMatch[1].trim() : 'Sofia';
      
      // Use base class method for work model normalization
      const workModel = this.normalizeWorkModel(cardInfoText);
      
      // Use base class method for experience level normalization  
      const experienceLevel = this.normalizeExperienceLevel(cardInfoText);
      
      // Build full URL if relative
      const fullUrl = link.startsWith('http') ? link : `${this.baseUrl}${link}`;
      
      // Extract technologies from skill images
      const technologies: string[] = [];
      $(element).find('.skill img').each((i, img) => {
        const tech = $(img).attr('alt');
        if (tech && tech.toLowerCase() !== 'english') {
          technologies.push(tech.toLowerCase());
        }
      });
      
      // Fallback: extract from job text if no tech elements found
      if (technologies.length === 0) {
        const jobText = $(element).text();
        technologies.push(...this.extractTechnologies(jobText));
      }
      
      return {
        title,
        company: this.normalizeCompanyName(company),
        location,
        workModel,
        technologies,
        postedDate: this.parsePostedDate(dateText),
        salaryRange: undefined, // Not typically shown in job listings
        url: fullUrl,
        originalJobId: this.extractJobId(fullUrl),
        sourceSite: 'jobs.bg',
        description: '', // Will be filled when fetching job details
        requirements: '',
        experienceLevel,
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

  /**
   * Enhanced DataDome and anti-bot protection detection
   */
  private isCaptchaOrBlocked(html: string): boolean {
    const indicators = [
      // DataDome specific
      'captcha-delivery.com',
      'datadome',
      'dd_cookie_test',
      'Challenge solved',
      
      // Generic bot protection
      'Please complete the security check',
      'Access Denied',
      'captcha',
      'hcaptcha',
      'recaptcha',
      'Please verify you are a human',
      'Security Check',
      'Bot Protection',
      
      // CloudFlare
      'cloudflare',
      'cf-ray',
      'Please wait while we check your browser',
      
      // Generic blocking indicators
      'blocked',
      'forbidden',
      'rate limit',
    ];
    
    const htmlLower = html.toLowerCase();
    const hasIndicator = indicators.some(indicator => htmlLower.includes(indicator));
    
    // Additional checks for minimal content (possible blocking)
    const hasMinimalContent = html.length < 1000 && !htmlLower.includes('mdc-card');
    
    return hasIndicator || hasMinimalContent;
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

  /**
   * Fetch page using stealth browser with enhanced evasion
   */
  private async fetchWithStealthBrowser(url: string, options?: { infiniteScroll?: boolean, warmup?: boolean }) {
    try {
      // Get stealth browser session
      const session = await this.stealthBrowserEngine.getSession({
        siteName: 'jobs.bg',
        headless: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        loadImages: false,
        timeout: 45000,
      });

      // Use stealth browser with warm-up and behavior simulation
      return await this.stealthBrowserEngine.fetchPageWithWarmup(url, session, options);
      
    } catch (error) {
      this.logger.error(`Stealth browser fetch failed: ${error.message}`);
      return {
        html: '',
        finalUrl: url,
        status: 0,
        headers: {},
        success: false,
        error: error.message,
        loadTime: 0,
        cookies: [],
      };
    }
  }

  /**
   * Save raw HTML response to file for debugging
   */
  private async saveResponseToFile(html: string, page: number): Promise<string> {
    try {
      const debugDir = './debug-responses';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `jobs-bg-page-${page}-${timestamp}.html`;
      const filepath = join(debugDir, filename);
      
      // Ensure debug directory exists
      await fs.mkdir(debugDir, { recursive: true });
      
      // Save HTML content
      await fs.writeFile(filepath, html, 'utf-8');
      
      const absolutePath = join(process.cwd(), filepath);
      this.logger.log(`HTML response saved to: ${absolutePath}`);
      
      return absolutePath;
    } catch (error) {
      this.logger.warn(`Failed to save HTML response:`, error.message);
      return '';
    }
  }
}