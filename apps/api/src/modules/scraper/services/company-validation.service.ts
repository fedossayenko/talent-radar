import { Injectable, Logger } from '@nestjs/common';

/**
 * Service for validating company data extracted from various sources
 * Prevents job board names from being incorrectly identified as company names
 */
@Injectable()
export class CompanyValidationService {
  private readonly logger = new Logger(CompanyValidationService.name);

  private readonly jobBoardNames = [
    'DEV.BG',
    'dev.bg',
    'Indeed',
    'LinkedIn',
    'Glassdoor',
    'Jobs.bg',
    'AngelList',
    'Stack Overflow',
    'JobBoardFinder',
    'CareerBuilder',
    'Monster',
    'ZipRecruiter',
    'SimplyHired',
    'Dice',
    'IT Jobs',
    'JobServe'
  ];

  private readonly jobBoardDomains = [
    'dev.bg',
    'indeed.com',
    'linkedin.com',
    'glassdoor.com',
    'jobs.bg',
    'angel.co',
    'stackoverflow.com',
    'jobboardfinder.com',
    'careerbuilder.com',
    'monster.com',
    'ziprecruiter.com',
    'simplyhired.com',
    'dice.com',
    'itjobs.bg'
  ];

  /**
   * Validates if a company name is legitimate (not a job board name)
   */
  isValidCompanyName(companyName: string | null | undefined): boolean {
    if (!companyName || companyName.trim() === '') {
      return false;
    }

    const normalizedName = companyName.toLowerCase().trim();

    // Check if name matches known job board names
    const isJobBoard = this.jobBoardNames.some(jobBoard => 
      normalizedName.includes(jobBoard.toLowerCase()) || 
      jobBoard.toLowerCase().includes(normalizedName)
    );

    if (isJobBoard) {
      this.logger.warn(`Rejected job board name as company: ${companyName}`);
      return false;
    }

    return true;
  }

  /**
   * Validates if a company URL is legitimate (not a job board or aggregator)
   */
  isValidCompanyUrl(url: string | null | undefined): boolean {
    if (!url || url.trim() === '') {
      return false;
    }

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      // Check if hostname matches known job board domains
      const isJobBoardDomain = this.jobBoardDomains.some(domain =>
        hostname.includes(domain) || domain.includes(hostname)
      );

      if (isJobBoardDomain) {
        this.logger.warn(`Rejected job board URL as company website: ${url}`);
        return false;
      }

      // Check for generic company URLs that don't contain company identifiers
      const pathPattern = /\/company\/[a-zA-Z0-9\-_]+/;
      if (hostname.includes('dev.bg') && !pathPattern.test(urlObj.pathname)) {
        this.logger.warn(`Rejected generic dev.bg company URL: ${url}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.warn(`Invalid URL format: ${url}`);
      return false;
    }
  }

  /**
   * Determines if a company name should be updated based on validation rules
   */
  shouldUpdateCompanyName(existingName: string | null | undefined, newName: string): boolean {
    // Don't update if the new name is not valid
    if (!this.isValidCompanyName(newName)) {
      return false;
    }

    // Update if existing name is empty or null
    if (!existingName || existingName.trim() === '') {
      return true;
    }

    // Replace existing name if it's a job board name
    if (!this.isValidCompanyName(existingName)) {
      this.logger.log(`Replacing invalid company name "${existingName}" with "${newName}"`);
      return true;
    }

    // Don't overwrite existing valid company names
    this.logger.log(`Keeping existing company name "${existingName}" instead of "${newName}"`);
    return false;
  }

  /**
   * Sanitizes company data by removing invalid entries
   */
  sanitizeCompanyData(data: {
    name?: string;
    website?: string;
    [key: string]: any;
  }): {
    name?: string;
    website?: string;
    [key: string]: any;
  } {
    const sanitized = { ...data };

    // Remove invalid company name
    if (data.name && !this.isValidCompanyName(data.name)) {
      delete sanitized.name;
    }

    // Remove invalid website URL
    if (data.website && !this.isValidCompanyUrl(data.website)) {
      delete sanitized.website;
    }

    return sanitized;
  }

  /**
   * Adds a new job board name to the blacklist (for runtime updates)
   */
  addJobBoardName(name: string): void {
    if (!this.jobBoardNames.includes(name)) {
      this.jobBoardNames.push(name);
      this.logger.log(`Added job board name to blacklist: ${name}`);
    }
  }

  /**
   * Adds a new job board domain to the blacklist (for runtime updates)
   */
  addJobBoardDomain(domain: string): void {
    if (!this.jobBoardDomains.includes(domain)) {
      this.jobBoardDomains.push(domain);
      this.logger.log(`Added job board domain to blacklist: ${domain}`);
    }
  }
}