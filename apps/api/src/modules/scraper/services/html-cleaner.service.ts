import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

export interface CleaningProfile {
  name: string;
  description: string;
  selectors: {
    remove: string[];
    preserve: string[];
    contentContainers: string[];
  };
  textProcessing: {
    removePatterns: RegExp[];
    maxLength: number;
    minLength: number;
  };
}

export interface CleaningResult {
  originalLength: number;
  cleanedLength: number;
  appliedProfile: string;
  processingTime: number;
  removedElements: string[];
  preservedElements: string[];
}

@Injectable()
export class HtmlCleanerService {
  private readonly logger = new Logger(HtmlCleanerService.name);

  // Simplified cleaning profiles - reduced from 3 to 2 with consolidated selectors
  private readonly cleaningProfiles: Record<string, CleaningProfile> = {
    'standard': {
      name: 'Standard',
      description: 'Balanced cleaning for job vacancy and general content',
      selectors: {
        remove: [
          // Core noise elements (consolidated from 30+ selectors to 12)
          'nav', 'header', 'footer', 'aside', 'script', 'style', 'noscript', 'iframe',
          '.sidebar', '.menu', '.navigation', '.breadcrumb',
          '.social', '.share', '.follow', '.subscribe', '[class*="social"]',
          '.ad', '.ads', '.advertisement', '.sponsored', '[class*="ad-"]', '[class*="promo"]',
          '.comments', '.reviews', '[class*="comment"]', '[class*="review"]',
          '.cookie', '.popup', '.modal', '.overlay', '[class*="cookie"]',
          'form:not(.application-form)', 'button:not(.apply-button)', 'input:not([type="hidden"])',
        ],
        preserve: [
          // Essential content elements (consolidated from 15+ selectors to 8)
          'main', 'article', '.content', '.main-content', '[role="main"]',
          '.job-description', '.job-details', '.job-requirements', '.responsibilities',
          '.company-info', '.salary', '.compensation', '.benefits',
        ],
        contentContainers: [
          'main', 'article', '.content', '.main-content', 'body',
        ],
      },
      textProcessing: {
        removePatterns: [
          // Consolidated noise patterns (reduced from 10+ to 4 essential patterns)
          /privacy policy|cookie policy|terms of service|we use cookies|accept.*cookies/gi,
          /follow us|share this|subscribe.*newsletter|join.*mailing list/gi,
          /click here|read more|view all|show more|load more/gi,
          /home\s*[>|]\s*|breadcrumb|skip to|go to/gi,
        ],
        maxLength: 15000,
        minLength: 100,
      },
    },

    'aggressive': {
      name: 'Aggressive', 
      description: 'Maximum cleaning for AI processing with minimal noise',
      selectors: {
        remove: [
          // Extensive cleaning (simplified from complex patterns)
          'nav', 'header', 'footer', 'aside', 'form', 'script', 'style', 'noscript',
          'iframe', 'object', 'embed', 'video', 'audio', 'button', 'input', 'select', 'textarea',
          '.sidebar', '.menu', '.social', '.ad', '.ads', '.comments', '.cookie', '.popup',
        ],
        preserve: [
          'main', 'article', 'p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li',
        ],
        contentContainers: [
          'main', 'article', '.content', 'body',
        ],
      },
      textProcessing: {
        removePatterns: [
          // Essential noise removal only
          /©.*?\d{4}|copyright.*?\d{4}|all rights reserved/gi,
          /powered by|built with|click here|read more/gi,
        ],
        maxLength: 10000,
        minLength: 50,
      },
    },
  };

  /**
   * Clean HTML using a specific profile
   */
  async cleanHtml(
    html: string,
    profileName: string = 'standard',
    customOptions?: Partial<CleaningProfile>
  ): Promise<{ cleanedHtml: string; cleanedText: string; result: CleaningResult }> {
    const startTime = Date.now();
    
    this.logger.debug(`Cleaning HTML with profile: ${profileName}`, {
      originalLength: html.length,
    });

    const profile = this.getCleaningProfile(profileName, customOptions);
    const $ = cheerio.load(html);
    
    const removedElements: string[] = [];
    const preservedElements: string[] = [];

    try {
      // Remove unwanted elements
      profile.selectors.remove.forEach(selector => {
        const elements = $(selector);
        elements.each((_, element) => {
          removedElements.push($(element).prop('tagName') || selector);
        });
        elements.remove();
      });

      // Mark preserved elements (for tracking)
      profile.selectors.preserve.forEach(selector => {
        $(selector).each((_, element) => {
          preservedElements.push($(element).prop('tagName') || selector);
        });
      });

      // Extract and clean text content
      const extractedText = this.extractTextContent($, profile);
      const cleanedText = this.processTextContent(extractedText, profile);

      const cleanedHtml = $.html();
      const processingTime = Date.now() - startTime;

      const result: CleaningResult = {
        originalLength: html.length,
        cleanedLength: cleanedHtml.length,
        removedElements: [...new Set(removedElements)],
        preservedElements: [...new Set(preservedElements)],
        appliedProfile: profileName,
        processingTime,
      };

      this.logger.debug(`HTML cleaning completed`, {
        profile: profileName,
        compressionRatio: result.cleanedLength / result.originalLength,
        processingTime,
        removedElementTypes: result.removedElements.length,
      });

      return {
        cleanedHtml,
        cleanedText,
        result,
      };

    } catch (error) {
      this.logger.error(`Failed to clean HTML with profile ${profileName}:`, error);
      
      // Return fallback result
      const fallbackText = this.extractTextFallback(html);
      return {
        cleanedHtml: html,
        cleanedText: fallbackText,
        result: {
          originalLength: html.length,
          cleanedLength: html.length,
          removedElements: [],
          preservedElements: [],
          appliedProfile: 'fallback',
          processingTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Get cleaning profile with optional customizations
   */
  private getCleaningProfile(name: string, customOptions?: Partial<CleaningProfile>): CleaningProfile {
    const baseProfile = this.cleaningProfiles[name];
    if (!baseProfile) {
      this.logger.warn(`Unknown cleaning profile: ${name}, using standard profile`);
      return this.cleaningProfiles['standard'];
    }

    if (!customOptions) {
      return baseProfile;
    }

    // Merge custom options with base profile
    return {
      ...baseProfile,
      ...customOptions,
      selectors: {
        ...baseProfile.selectors,
        ...customOptions.selectors,
      },
      textProcessing: {
        ...baseProfile.textProcessing,
        ...customOptions.textProcessing,
      },
    };
  }

  /**
   * Extract text content using profile-specific strategies
   */
  private extractTextContent($: cheerio.CheerioAPI, profile: CleaningProfile): string {
    // Try content containers first
    for (const selector of profile.selectors.contentContainers) {
      const container = $(selector).first();
      if (container.length) {
        const text = container.text().trim();
        if (text.length >= profile.textProcessing.minLength) {
          return text;
        }
      }
    }

    // Fallback to body text
    return $('body').text().trim();
  }

  /**
   * Process text content according to profile rules
   */
  private processTextContent(text: string, profile: CleaningProfile): string {
    let processed = text;

    // Apply removal patterns
    profile.textProcessing.removePatterns.forEach(pattern => {
      processed = processed.replace(pattern, ' ');
    });

    // Normalize whitespace
    processed = processed.replace(/\s+/g, ' ').trim();

    // Apply length constraints
    if (processed.length > profile.textProcessing.maxLength) {
      const truncated = processed.substring(0, profile.textProcessing.maxLength);
      const lastSpace = truncated.lastIndexOf(' ');
      processed = lastSpace > profile.textProcessing.maxLength * 0.8 
        ? truncated.substring(0, lastSpace) 
        : truncated;
      processed += '...';
    }

    return processed;
  }

  /**
   * Fallback text extraction
   */
  private extractTextFallback(html: string): string {
    try {
      return html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    } catch {
      this.logger.warn('Fallback text extraction failed');
      return '';
    }
  }


  /**
   * Get available cleaning profiles
   */
  getAvailableProfiles(): string[] {
    return Object.keys(this.cleaningProfiles);
  }

  /**
   * Get profile details
   */
  getProfileDetails(name: string): CleaningProfile | null {
    return this.cleaningProfiles[name] || null;
  }


}
