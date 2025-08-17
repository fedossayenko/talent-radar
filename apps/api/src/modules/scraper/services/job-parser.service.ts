import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { DateUtils } from '../utils/date.utils';

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

  constructor(private readonly dateUtils: DateUtils) {}

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
    return this.dateUtils.findBulgarianDateString(text);
  }
}