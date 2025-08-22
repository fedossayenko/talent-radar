import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

export interface RawJobData {
  title: string;
  company: string;
  url: string;
  badgeText: string;
  salaryRange?: string;
  timeElement?: {
    datetime?: string;
    text: string;
  };
  techImageTitles: string[];
  fullJobText: string;
}

/**
 * Service responsible for parsing HTML elements into structured job data
 * Focuses solely on extraction without business logic or translations
 */
@Injectable()
export class JobParserService {
  private readonly logger = new Logger(JobParserService.name);

  /**
   * Parses a job element from the DOM into raw structured data
   */
  parseJobFromElement($: cheerio.CheerioAPI, element: any): RawJobData | null {
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

      // Extract badge text (contains location and work model)
      const badgeElements = $element.find('.badge');
      const badgeText = badgeElements.length > 0 ? badgeElements.first().text().trim() : '';

      // Extract salary if available - look for salary indicators
      const salaryElement = $element.find('.salary, .price, [class*="salary"]');
      const salaryRange = salaryElement.length > 0 ? salaryElement.text().trim() : undefined;

      // Extract time element for posted date
      const timeElement = $element.find('time');
      const timeData = timeElement.length > 0 ? {
        datetime: timeElement.attr('datetime'),
        text: timeElement.text().trim(),
      } : undefined;

      // Extract technology icons with title attributes
      const techImageTitles = this.extractTechImageTitles($element);

      // Get full text content for tech pattern matching
      const fullJobText = $element.text().toLowerCase();

      if (!title || !company) {
        this.logger.warn('Skipping job listing: missing title or company');
        return null;
      }

      return {
        title,
        company,
        url,
        badgeText,
        salaryRange,
        timeElement: timeData,
        techImageTitles,
        fullJobText,
      };

    } catch (error) {
      this.logger.error('Error parsing job element:', error.message);
      return null;
    }
  }

  /**
   * Extracts technology titles from image elements
   */
  private extractTechImageTitles($element: cheerio.Cheerio<any>): string[] {
    const techTitles: string[] = [];
    
    // Look for technology icons with title attributes
    const techImages = $element.find('img[title]');
    techImages.each((index) => {
      const title = techImages.eq(index).attr('title');
      if (title) {
        const tech = title.toLowerCase().trim();
        if (tech && !techTitles.includes(tech)) {
          techTitles.push(tech);
        }
      }
    });
    
    return techTitles;
  }

  /**
   * Parses job details page to extract description and requirements
   */
  parseJobDetailsFromHtml(html: string): { description: string; requirements: string } {
    try {
      // Extract job description using regex
      const descriptionMatch = html.match(/<div[^>]*class="[^"]*job-description[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      const description = descriptionMatch?.[1]?.replace(/<[^>]*>/g, '').trim() || '';

      // Extract requirements using regex
      const requirementsMatch = html.match(/<div[^>]*class="[^"]*job-requirements[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      const requirements = requirementsMatch?.[1]?.replace(/<[^>]*>/g, '').trim() || '';

      return { description, requirements };
    } catch (error) {
      this.logger.error('Error parsing job details HTML:', error.message);
      return { description: '', requirements: '' };
    }
  }

  /**
   * Searches for Bulgarian date patterns in text content
   */
  findBulgarianDateInText(text: string): string | null {
    const bulgariandateMatch = text.match(/(\d{1,2})\s+(януари|февруари|март|април|май|юни|юли|август|септември|октомври|ноември|декември)/i);
    return bulgariandateMatch ? bulgariandateMatch[0] : null;
  }

  /**
   * Extracts company URLs from job details page HTML
   */
  extractCompanyUrls(html: string): { profileUrl?: string; website?: string } {
    try {
      const $ = cheerio.load(html);
      
      // Look for dev.bg company profile URL
      // These are typically found in company name links or dedicated company sections
      let profileUrl: string | undefined;
      
      // Check for company profile links (usually /company/ URLs with specific company name)
      const companyLinks = $('a[href*="/company/"]');
      companyLinks.each((_, element) => {
        const href = $(element).attr('href');
        if (href && href.includes('/company/') && !profileUrl) {
          // Only accept company URLs with specific company identifiers (not generic /company/)
          const companyUrlPattern = /\/company\/[a-zA-Z0-9\-_]+/;
          if (companyUrlPattern.test(href) && !href.endsWith('/company/')) {
            profileUrl = href.startsWith('http') ? href : `https://dev.bg${href}`;
          }
        }
      });
      
      // Look for external company website links
      let website: string | undefined;
      let websiteWithKeyword: string | undefined; // Priority for links with website keywords
      
      // Common patterns for company websites
      const websitePatterns = [
        'a[href*="www."]',
        'a[href^="http"][href*=".com"]',
        'a[href^="http"][href*=".bg"]',
        'a[href^="https://"]',
        'a.company-website',
        'a.external-link',
        '.company-info a[href^="http"]'
      ];
      
      for (const pattern of websitePatterns) {
        const links = $(pattern);
        links.each((_, element) => {
          const href = $(element).attr('href');
          const linkText = $(element).text().toLowerCase();
          
          // Skip dev.bg URLs, social media, and job board aggregators
          if (href && 
              !href.includes('dev.bg') && 
              !href.includes('linkedin.com') &&
              !href.includes('facebook.com') &&
              !href.includes('twitter.com') &&
              !href.includes('jobs.bg') &&
              !href.includes('jobboardfinder.com') &&
              !href.includes('indeed.com') &&
              !href.includes('glassdoor.com')) {
            
            // Check if this is a valid website URL
            if (href.match(/^https?:\/\/[a-zA-Z0-9\-_.]+\.(com|bg|org|net|io)/) ||
                href.match(/^https?:\/\/(www\.)?[a-zA-Z0-9\-_.]+\.[a-zA-Z]{2,}$/)) {
              
              // Prioritize links with website-related text
              if (linkText.includes('website') || linkText.includes('сайт')) {
                websiteWithKeyword = href;
              } else if (!website) {
                // Only set as fallback if we haven't found any website yet
                website = href;
              }
            }
          }
        });
        
        // If we found a link with website keyword, use that and stop looking
        if (websiteWithKeyword) {
          website = websiteWithKeyword;
          break;
        }
      }
      
      // Also check for URLs in text content as fallback
      if (!website) {
        const urlMatches = html.match(/https?:\/\/(www\.)?[a-zA-Z0-9\-_.]+\.[a-zA-Z]{2,}[^\s<>"']*/g);
        if (urlMatches) {
          for (const url of urlMatches) {
            if (!url.includes('dev.bg') && 
                !url.includes('linkedin.com') &&
                !url.includes('facebook.com') &&
                !url.includes('jobboardfinder.com') &&
                !url.includes('indeed.com') &&
                !url.includes('glassdoor.com') &&
                url.match(/\.(com|bg|org|net|io|eu)/)) {
              website = url;
              break;
            }
          }
        }
      }
      
      this.logger.log(`Extracted company URLs - Profile: ${profileUrl}, Website: ${website}`);
      
      return {
        profileUrl,
        website
      };
      
    } catch (error) {
      this.logger.error('Error extracting company URLs:', error.message);
      return {};
    }
  }
}