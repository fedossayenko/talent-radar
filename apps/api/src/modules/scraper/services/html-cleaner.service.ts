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
    preservePatterns: RegExp[];
    maxLength: number;
    minLength: number;
  };
}

export interface CleaningResult {
  originalLength: number;
  cleanedLength: number;
  removedElements: string[];
  preservedElements: string[];
  appliedProfile: string;
  processingTime: number;
}

@Injectable()
export class HtmlCleanerService {
  private readonly logger = new Logger(HtmlCleanerService.name);

  // Predefined cleaning profiles for different types of content
  private readonly cleaningProfiles: Record<string, CleaningProfile> = {
    'job-vacancy': {
      name: 'Job Vacancy',
      description: 'Optimized for job vacancy and career-related content',
      selectors: {
        remove: [
          // Navigation and UI elements
          'nav', 'header', 'footer', 'aside', '.sidebar',
          '.navigation', '.menu', '.breadcrumb',
          
          // Social and sharing
          '.social', '.share', '.follow', '.subscribe',
          '[class*="social"]', '[class*="share"]', '[class*="follow"]',
          
          // Ads and tracking
          '.ad', '.ads', '.advertisement', '.sponsored',
          '[class*="ad-"]', '[class*="ads-"]', '[class*="promo"]',
          'script', 'noscript', 'iframe',
          
          // Forms and interactive elements (except job application forms)
          'form:not(.application-form):not(.job-application)',
          'input:not([type="hidden"])', 'button:not(.apply-button)',
          'select', 'textarea',
          
          // Comments and user content
          '.comments', '.reviews', '.testimonials',
          '[class*="comment"]', '[class*="review"]',
          
          // Related/recommended content
          '.related', '.recommended', '.suggested',
          '[class*="related"]', '[class*="recommended"]',
          
          // Cookie notices and popups
          '.cookie', '.popup', '.modal', '.overlay',
          '[class*="cookie"]', '[class*="popup"]', '[class*="modal"]',
        ],
        preserve: [
          // Job-specific content
          '.job-description', '.job-details', '.job-requirements',
          '.position-details', '.vacancy-description', '.role-description',
          '.responsibilities', '.qualifications', '.benefits',
          
          // Company information
          '.company-info', '.company-description', '.about-company',
          
          // Salary and compensation
          '.salary', '.compensation', '.benefits', '.perks',
          '[class*="salary"]', '[class*="compensation"]',
          
          // Application instructions
          '.how-to-apply', '.application-process', '.apply-instructions',
        ],
        contentContainers: [
          'main', 'article', '.content', '.main-content',
          '.job-content', '.vacancy-content', '.position-content',
          '[role="main"]', '[class*="description"]',
        ],
      },
      textProcessing: {
        removePatterns: [
          // Privacy and legal text
          /privacy policy|cookie policy|terms of service|gdpr compliance/gi,
          /we use cookies|accept.*cookies|cookie.*preferences/gi,
          
          // Navigation text
          /home\s*[>\|]\s*|breadcrumb|skip to|go to/gi,
          
          // Social media calls-to-action
          /follow us|like us|share this|tweet this|connect with us/gi,
          
          // Newsletter signups
          /subscribe.*newsletter|join.*mailing list|get.*updates/gi,
          
          // Generic website noise
          /click here|read more|view all|show more|load more/gi,
        ],
        preservePatterns: [
          // Job-specific terms should be preserved
          /job|position|role|career|employment|salary|benefits|requirements|qualifications|experience|skills/gi,
          /responsible for|duties include|we offer|you will|candidate should/gi,
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
          'nav', 'header', 'footer', 'aside', 'form', 'script', 'style',
          'noscript', 'iframe', 'object', 'embed', 'video', 'audio',
          '.sidebar', '.menu', '.navigation', '.breadcrumb',
          '.social', '.share', '.follow', '.subscribe', '.newsletter',
          '.ad', '.ads', '.advertisement', '.sponsored', '.promo',
          '.comments', '.reviews', '.related', '.recommended',
          '.cookie', '.popup', '.modal', '.overlay', '.banner',
          'button', 'input', 'select', 'textarea',
        ],
        preserve: [
          'main', 'article', '.content', '.main-content', 'p', 'h1', 'h2', 'h3',
          'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
        ],
        contentContainers: [
          'main', 'article', '.content', '.main-content', 'body',
        ],
      },
      textProcessing: {
        removePatterns: [
          /©.*?\d{4}|copyright.*?\d{4}/gi,
          /all rights reserved/gi,
          /powered by|built with|created by/gi,
          /\d+\s*(views?|shares?|likes?|comments?)/gi,
          /click here|read more|view all|show more/gi,
        ],
        preservePatterns: [],
        maxLength: 10000,
        minLength: 50,
      },
    },

    'conservative': {
      name: 'Conservative',
      description: 'Minimal cleaning preserving most content structure',
      selectors: {
        remove: [
          'script', 'style', 'noscript',
          '.ad', '.ads', '.advertisement',
          '[class*="cookie"]', '[class*="popup"]',
        ],
        preserve: [
          'main', 'article', 'section', 'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'table', 'tr', 'td', 'th',
        ],
        contentContainers: [
          'body', 'main', 'article', '.content',
        ],
      },
      textProcessing: {
        removePatterns: [
          /^\s*$/, // Empty lines only
        ],
        preservePatterns: [],
        maxLength: 50000,
        minLength: 20,
      },
    },
  };

  /**
   * Clean HTML using a specific profile
   */
  async cleanHtml(
    html: string,
    profileName: string = 'job-vacancy',
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
      this.logger.warn(`Unknown cleaning profile: ${name}, using job-vacancy profile`);
      return this.cleaningProfiles['job-vacancy'];
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
    } catch (error) {
      this.logger.warn('Fallback text extraction failed');
      return '';
    }
  }

  /**
   * Create a custom cleaning profile
   */
  createCustomProfile(
    name: string,
    baseProfile: string = 'job-vacancy',
    customizations: Partial<CleaningProfile>
  ): void {
    const base = this.cleaningProfiles[baseProfile];
    if (!base) {
      throw new Error(`Base profile ${baseProfile} not found`);
    }

    this.cleaningProfiles[name] = {
      ...base,
      ...customizations,
      name,
    };

    this.logger.log(`Created custom cleaning profile: ${name}`);
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

  /**
   * Analyze HTML structure for profile recommendation
   */
  analyzeAndRecommendProfile(html: string): {
    recommendedProfile: string;
    confidence: number;
    analysis: {
      hasJobKeywords: boolean;
      hasFormElements: boolean;
      hasComments: boolean;
      hasNavigation: boolean;
      contentDensity: number;
    };
  } {
    const $ = cheerio.load(html);
    const text = $('body').text().toLowerCase();

    // Analyze content characteristics
    const analysis = {
      hasJobKeywords: /\b(job|position|role|career|employment|salary|benefits|apply|candidate|experience|skills|qualifications|responsibilities|duties)\b/g.test(text),
      hasFormElements: $('form, input, button, select, textarea').length > 5,
      hasComments: $('.comment, .review, [class*="comment"], [class*="review"]').length > 0,
      hasNavigation: $('nav, .navigation, .menu, .breadcrumb').length > 0,
      contentDensity: $('p').length / Math.max($('div').length, 1),
    };

    // Determine recommendation
    let recommendedProfile = 'conservative';
    let confidence = 0.5;

    if (analysis.hasJobKeywords) {
      recommendedProfile = 'job-vacancy';
      confidence = 0.8;
    } else if (analysis.hasFormElements || analysis.hasComments || analysis.hasNavigation) {
      recommendedProfile = 'aggressive';
      confidence = 0.7;
    }

    return {
      recommendedProfile,
      confidence,
      analysis,
    };
  }

  /**
   * Batch clean multiple HTML documents
   */
  async batchClean(
    htmlDocuments: Array<{ id: string; html: string; url?: string }>,
    profileName: string = 'job-vacancy'
  ): Promise<Array<{
    id: string;
    url?: string;
    cleanedHtml: string;
    cleanedText: string;
    result: CleaningResult;
  }>> {
    this.logger.log(`Starting batch cleaning of ${htmlDocuments.length} documents`);

    const results = await Promise.allSettled(
      htmlDocuments.map(async (doc) => {
        const cleaned = await this.cleanHtml(doc.html, profileName);
        return {
          id: doc.id,
          url: doc.url,
          ...cleaned,
        };
      })
    );

    const successful = results
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value);

    const failed = results.filter(result => result.status === 'rejected').length;

    this.logger.log(`Batch cleaning completed`, {
      total: htmlDocuments.length,
      successful: successful.length,
      failed,
    });

    return successful;
  }
}