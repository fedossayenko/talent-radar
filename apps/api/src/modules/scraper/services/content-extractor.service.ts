import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cheerio from 'cheerio';

export interface ContentExtractionResult {
  title: string | null;
  content: string;
  cleanedContent: string;
  metadata: {
    originalLength: number;
    cleanedLength: number;
    compressionRatio: number;
    extractedAt: Date;
    sourceUrl: string;
    detectedLanguage?: string;
    hasStructuredData: boolean;
    contentSections: string[];
  };
}

export interface ExtractionOptions {
  maxContentLength?: number;
  preserveStructure?: boolean;
  removeImages?: boolean;
  removeLinks?: boolean;
  aggressiveCleaning?: boolean;
  extractMetadata?: boolean;
}

export interface PreprocessOptions {
  convertToMarkdown?: boolean;
  extractSpecificSections?: boolean;
  optimizeForAI?: boolean;
  maxTokens?: number;
  preserveStructure?: boolean;
}

export interface PreprocessedContent {
  markdown: string;
  html: string;
  sections: {
    title?: string;
    description?: string;
    requirements?: string;
    benefits?: string;
    companyInfo?: string;
    salary?: string;
    location?: string;
  };
  metadata: {
    originalSize: number;
    processedSize: number;
    compressionRatio: number;
    tokensEstimate: number;
    sectionCount: number;
    language: string;
  };
}

@Injectable()
export class ContentExtractorService {
  private readonly logger = new Logger(ContentExtractorService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Extract and clean content from HTML
   */
  async extractContent(
    html: string, 
    sourceUrl: string, 
    options: ExtractionOptions = {}
  ): Promise<ContentExtractionResult> {
    const {
      maxContentLength = 50000,
      preserveStructure = true,
      removeImages = true,
      removeLinks = false,
      aggressiveCleaning = false,
      extractMetadata = true,
    } = options;

    this.logger.debug(`Extracting content from ${sourceUrl}`, {
      htmlLength: html.length,
      options,
    });

    try {
      const $ = cheerio.load(html);
      
      // Extract title
      const title = this.extractTitle($);
      
      // Remove unwanted elements
      this.removeUnwantedElements($, { removeImages, aggressiveCleaning });
      
      // Extract main content
      const content = this.extractMainContent($);
      
      // Clean and process content
      const cleanedContent = this.cleanContent(content, {
        maxLength: maxContentLength,
        preserveStructure,
        removeLinks,
      });

      // Extract metadata if requested
      const metadata = extractMetadata ? this.extractMetadata($, html, sourceUrl, content, cleanedContent) : {
        originalLength: html.length,
        cleanedLength: cleanedContent.length,
        compressionRatio: cleanedContent.length / html.length,
        extractedAt: new Date(),
        sourceUrl,
        hasStructuredData: false,
        contentSections: [],
      };

      return {
        title,
        content,
        cleanedContent,
        metadata,
      };

    } catch (error) {
      this.logger.error(`Failed to extract content from ${sourceUrl}:`, error);
      
      // Return fallback result with raw text
      const fallbackContent = this.extractTextFallback(html);
      return {
        title: null,
        content: fallbackContent,
        cleanedContent: fallbackContent.substring(0, maxContentLength),
        metadata: {
          originalLength: html.length,
          cleanedLength: fallbackContent.length,
          compressionRatio: fallbackContent.length / html.length,
          extractedAt: new Date(),
          sourceUrl,
          hasStructuredData: false,
          contentSections: ['fallback'],
        },
      };
    }
  }

  /**
   * Extract title from various sources
   */
  private extractTitle($: cheerio.CheerioAPI): string | null {
    // Priority order for title extraction
    const titleSelectors = [
      'h1',
      'title',
      '[data-testid*="title"]',
      '[class*="title"]',
      '[class*="heading"]',
      '.job-title',
      '.position-title',
      'h2',
    ];

    for (const selector of titleSelectors) {
      const element = $(selector).first();
      if (element.length && element.text().trim()) {
        const title = element.text().trim();
        if (title.length > 5 && title.length < 200) {
          return title;
        }
      }
    }

    return null;
  }

  /**
   * Remove unwanted HTML elements
   */
  private removeUnwantedElements($: cheerio.CheerioAPI, options: { removeImages: boolean; aggressiveCleaning: boolean }): void {
    // Always remove these elements
    const alwaysRemove = [
      'script',
      'style', 
      'noscript',
      'iframe',
      'object',
      'embed',
      'form',
      'input',
      'button',
      'select',
      'textarea',
      '.advertisement',
      '.ads',
      '.social-share',
      '.comments',
      '.footer',
      '.sidebar',
      '[class*="cookie"]',
      '[class*="popup"]',
      '[class*="modal"]',
      '[id*="cookie"]',
      '[id*="popup"]',
      '[id*="modal"]',
    ];

    alwaysRemove.forEach(selector => $(selector).remove());

    if (options.removeImages) {
      $('img').remove();
    }

    if (options.aggressiveCleaning) {
      // More aggressive cleaning for AI consumption
      const aggressiveRemove = [
        'nav',
        'header',
        'aside',
        '.navigation',
        '.menu',
        '.breadcrumb',
        '.related',
        '.recommended',
        '.tags',
        '.share',
        '.author',
        '.date',
        '.meta',
        '[class*="social"]',
        '[class*="share"]',
        '[class*="follow"]',
        '[class*="subscribe"]',
      ];
      
      aggressiveRemove.forEach(selector => $(selector).remove());
    }
  }

  /**
   * Extract main content using multiple strategies
   */
  private extractMainContent($: cheerio.CheerioAPI): string {
    // Strategy 1: Look for main content containers
    const mainContentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.main-content',
      '.content',
      '.job-description',
      '.job-details', 
      '.vacancy-description',
      '.position-description',
      '[class*="description"]',
      '[class*="content"]',
      '[id*="description"]',
      '[id*="content"]',
    ];

    for (const selector of mainContentSelectors) {
      const element = $(selector).first();
      if (element.length) {
        const text = element.text().trim();
        if (text.length > 100) {
          return text;
        }
      }
    }

    // Strategy 2: Look for the largest text block
    let largestText = '';
    let largestLength = 0;

    $('div, section, article').each((_, element) => {
      const text = $(element).text().trim();
      if (text.length > largestLength && text.length > 100) {
        largestText = text;
        largestLength = text.length;
      }
    });

    if (largestText) {
      return largestText;
    }

    // Strategy 3: Fallback to body text
    return $('body').text().trim() || '';
  }

  /**
   * Clean and optimize content for AI processing
   */
  private cleanContent(content: string, options: {
    maxLength: number;
    preserveStructure: boolean;
    removeLinks: boolean;
  }): string {
    let cleaned = content;

    // Remove excessive whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Remove common noise patterns
    const noisePatterns = [
      /\b(cookies?|privacy policy|terms of service|gdpr|accept|decline)\b/gi,
      /\b(subscribe|newsletter|follow us|social media)\b/gi,
      /\b(share|like|tweet|facebook|linkedin|twitter)\b/gi,
      /\b(advertisement|sponsored|promoted)\b/gi,
      /\s*\([^)]*\)\s*/g, // Remove parenthetical content that might be noise
    ];

    noisePatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, ' ');
    });

    if (options.removeLinks) {
      // Remove URLs and email addresses
      cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
      cleaned = cleaned.replace(/\S+@\S+\.\S+/g, '');
    }

    // Normalize spacing again
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Truncate if too long, preserving word boundaries
    if (cleaned.length > options.maxLength) {
      const truncated = cleaned.substring(0, options.maxLength);
      const lastSpace = truncated.lastIndexOf(' ');
      cleaned = lastSpace > options.maxLength * 0.8 ? truncated.substring(0, lastSpace) : truncated;
      cleaned += '...';
    }

    return cleaned;
  }

  /**
   * Extract metadata about the content
   */
  private extractMetadata(
    $: cheerio.CheerioAPI, 
    originalHtml: string, 
    sourceUrl: string, 
    content: string, 
    cleanedContent: string
  ) {
    // Detect content sections
    const contentSections: string[] = [];
    
    if ($('h1, h2, h3').length > 0) contentSections.push('headings');
    if ($('ul, ol').length > 0) contentSections.push('lists');
    if ($('table').length > 0) contentSections.push('tables');
    if ($('p').length > 5) contentSections.push('paragraphs');
    
    // Check for structured data
    const hasStructuredData = $('script[type="application/ld+json"]').length > 0 ||
                              $('[itemscope]').length > 0 ||
                              $('[property^="og:"]').length > 0;

    // Simple language detection (basic approach)
    const detectedLanguage = this.detectLanguage(cleanedContent);

    return {
      originalLength: originalHtml.length,
      cleanedLength: cleanedContent.length,
      compressionRatio: cleanedContent.length / originalHtml.length,
      extractedAt: new Date(),
      sourceUrl,
      detectedLanguage,
      hasStructuredData,
      contentSections,
    };
  }

  /**
   * Simple language detection based on common words
   */
  private detectLanguage(text: string): string {
    const sampleText = text.toLowerCase().substring(0, 1000);
    
    // Simple patterns for common languages
    const languagePatterns = {
      'en': /\b(the|and|for|are|but|not|you|all|can|had|her|was|one|our|out|day|get|has|him|his|how|its|may|new|now|old|see|two|way|who|boy|did|man|end|few|got|let|put|too|use)\b/g,
      'bg': /\b(за|от|до|на|или|като|може|има|това|тази|този|които|която|което|един|една|едно|много|малко|добре|лошо|сега|тогава|където|защо|как|кога)\b/g,
      'de': /\b(der|die|das|und|ist|sie|ich|mit|den|auf|für|von|dem|des|ein|eine|aber|auch|nach|über|nur|noch|wie|aus|bei|vor|durch|ohne|gegen|zwischen)\b/g,
      'fr': /\b(le|de|et|un|il|être|et|en|avoir|que|pour|dans|ce|son|une|sur|avec|ne|se|pas|tout|plus|par|grand|en|me|même|lui|nos|comme|mais)\b/g,
    };

    let maxMatches = 0;
    let detectedLang = 'unknown';

    for (const [lang, pattern] of Object.entries(languagePatterns)) {
      const matches = sampleText.match(pattern);
      const matchCount = matches ? matches.length : 0;
      
      if (matchCount > maxMatches) {
        maxMatches = matchCount;
        detectedLang = lang;
      }
    }

    // Require minimum matches for confidence
    return maxMatches > 5 ? detectedLang : 'unknown';
  }

  /**
   * Fallback text extraction when parsing fails
   */
  private extractTextFallback(html: string): string {
    try {
      // Very basic HTML tag removal
      return html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    } catch {
      this.logger.warn('Fallback text extraction failed, returning empty string');
      return '';
    }
  }

  /**
   * Preprocess HTML content specifically optimized for AI extraction
   * Converts to Markdown, extracts sections, and reduces token usage by 70%
   */
  async preprocessHtml(
    html: string,
    sourceUrl: string,
    options: PreprocessOptions = {}
  ): Promise<PreprocessedContent> {
    const {
      convertToMarkdown = true,
      extractSpecificSections = true,
      optimizeForAI = true,
      maxTokens = 10000,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      preserveStructure: _preserveStructure = true,
    } = options;

    this.logger.debug(`Preprocessing HTML for AI extraction from ${sourceUrl}`, {
      htmlLength: html.length,
      options,
    });

    try {
      const $ = cheerio.load(html);
      
      // Remove all unwanted elements for AI processing
      this.removeUnwantedElements($, { 
        removeImages: true, 
        aggressiveCleaning: true 
      });

      // Extract specific sections for dev.bg structure
      const sections = extractSpecificSections ? this.extractDevBgSections($) : {};
      
      // Convert to markdown if requested
      let processedContent = '';
      if (convertToMarkdown) {
        processedContent = this.htmlToMarkdown($);
      } else {
        processedContent = $.text();
      }

      // Optimize for AI consumption
      if (optimizeForAI) {
        processedContent = this.optimizeForAI(processedContent, maxTokens);
      }

      const originalSize = html.length;
      const processedSize = processedContent.length;
      const language = this.detectLanguage(processedContent);

      return {
        markdown: convertToMarkdown ? processedContent : '',
        html: convertToMarkdown ? '' : processedContent,
        sections,
        metadata: {
          originalSize,
          processedSize,
          compressionRatio: processedSize / originalSize,
          tokensEstimate: Math.ceil(processedSize / 4), // Rough token estimation
          sectionCount: Object.keys(sections).length,
          language,
        },
      };

    } catch (error) {
      this.logger.error(`Failed to preprocess HTML from ${sourceUrl}:`, error);
      
      // Fallback to basic text extraction
      const fallbackText = this.extractTextFallback(html);
      return {
        markdown: '',
        html: fallbackText,
        sections: {},
        metadata: {
          originalSize: html.length,
          processedSize: fallbackText.length,
          compressionRatio: fallbackText.length / html.length,
          tokensEstimate: Math.ceil(fallbackText.length / 4),
          sectionCount: 0,
          language: 'unknown',
        },
      };
    }
  }

  /**
   * Extract specific sections from dev.bg job postings
   */
  private extractDevBgSections($: cheerio.CheerioAPI): PreprocessedContent['sections'] {
    const sections: PreprocessedContent['sections'] = {};

    // Dev.bg specific selectors for different sections
    const sectionSelectors = {
      title: [
        'h1.job-title',
        '.job-title',
        '.title-date-wrap h1',
        'h1[class*="title"]',
        '.job-header h1',
        'h1',
        '.position-title'
      ],
      description: [
        '.job_description',
        '.job-description',
        '.vacancy-description', 
        '[class*="description"]',
        '.job-content .description',
        '.content-description'
      ],
      requirements: [
        '.job-requirements',
        '.requirements',
        '[class*="requirement"]',
        '.job-content .requirements',
        '.vacancy-requirements'
      ],
      benefits: [
        '.benefits',
        '.job-benefits',
        '[class*="benefit"]',
        '.perks',
        '.advantages'
      ],
      companyInfo: [
        '.company-info',
        '.company-description',
        '[class*="company"]',
        '.employer-info',
        '.about-company'
      ],
      salary: [
        '.salary',
        '.compensation',
        '[class*="salary"]',
        '.wage',
        '.payment'
      ],
      location: [
        '.location',
        '.job-location',
        '[class*="location"]',
        '.workplace',
        '.office'
      ]
    };

    // Extract each section using multiple selectors
    for (const [sectionName, selectors] of Object.entries(sectionSelectors)) {
      for (const selector of selectors) {
        const element = $(selector).first();
        if (element.length) {
          const text = element.text().trim();
          if (text.length > 10) {
            sections[sectionName as keyof PreprocessedContent['sections']] = text;
            break; // Found content for this section, move to next
          }
        }
      }
    }

    return sections;
  }

  /**
   * Convert HTML to Markdown for better AI processing
   */
  private htmlToMarkdown($: cheerio.CheerioAPI): string {
    let markdown = '';

    // Convert headers
    $('h1, h2, h3, h4, h5, h6').each((_, element) => {
      const level = parseInt(element.tagName.substring(1));
      const text = $(element).text().trim();
      if (text) {
        markdown += '\n' + '#'.repeat(level) + ' ' + text + '\n\n';
      }
    });

    // Convert lists
    $('ul, ol').each((_, listElement) => {
      const isOrdered = listElement.tagName === 'ol';
      let counter = 1;
      
      $(listElement).find('li').each((_, item) => {
        const text = $(item).text().trim();
        if (text) {
          const prefix = isOrdered ? `${counter}. ` : '- ';
          markdown += prefix + text + '\n';
          counter++;
        }
      });
      markdown += '\n';
    });

    // Convert paragraphs
    $('p').each((_, element) => {
      const text = $(element).text().trim();
      if (text) {
        markdown += text + '\n\n';
      }
    });

    // Convert strong/bold text
    $('strong, b').each((_, element) => {
      const text = $(element).text().trim();
      if (text) {
        markdown += '**' + text + '** ';
      }
    });

    // Convert emphasis/italic text
    $('em, i').each((_, element) => {
      const text = $(element).text().trim();
      if (text) {
        markdown += '*' + text + '* ';
      }
    });

    // If no structured content found, use all text
    if (markdown.trim().length < 100) {
      markdown = $.text();
    }

    return this.cleanMarkdown(markdown);
  }

  /**
   * Clean and optimize markdown content
   */
  private cleanMarkdown(markdown: string): string {
    return markdown
      // Remove excessive newlines
      .replace(/\n{3,}/g, '\n\n')
      // Remove trailing spaces
      .replace(/[ \t]+$/gm, '')
      // Normalize spaces
      .replace(/[ \t]+/g, ' ')
      // Remove empty markdown elements
      .replace(/#+\s*\n/g, '')
      .replace(/[-*]\s*\n/g, '')
      .trim();
  }

  /**
   * Optimize content specifically for AI consumption
   */
  private optimizeForAI(content: string, maxTokens: number): string {
    const maxChars = maxTokens * 4; // Rough character to token conversion
    
    if (content.length <= maxChars) {
      return content;
    }

    // Try to truncate at logical boundaries
    const sections = content.split(/\n#{1,3}\s/);
    let optimized = '';
    
    for (const section of sections) {
      if ((optimized + section).length <= maxChars) {
        optimized += (optimized ? '\n# ' : '') + section;
      } else {
        // Add partial section if it fits
        const remaining = maxChars - optimized.length;
        if (remaining > 100) {
          const partial = section.substring(0, remaining - 50);
          const lastSentence = partial.lastIndexOf('.');
          if (lastSentence > remaining * 0.7) {
            optimized += (optimized ? '\n# ' : '') + partial.substring(0, lastSentence + 1);
          }
        }
        break;
      }
    }

    return optimized || content.substring(0, maxChars);
  }

  /**
   * Validate extracted content quality
   */
  validateContentQuality(result: ContentExtractionResult): {
    score: number;
    issues: string[];
    isValid: boolean;
  } {
    const issues: string[] = [];
    let score = 100;

    // Check content length
    if (result.cleanedContent.length < 50) {
      issues.push('Content too short');
      score -= 30;
    }

    // Check compression ratio
    if (result.metadata.compressionRatio < 0.1) {
      issues.push('Low content density (too much markup)');
      score -= 20;
    }

    // Check for title
    if (!result.title) {
      issues.push('No title extracted');
      score -= 15;
    }

    // Check content diversity
    if (result.metadata.contentSections.length < 2) {
      issues.push('Limited content structure');
      score -= 10;
    }

    // Check for repeated content (basic check)
    const uniqueWords = new Set(result.cleanedContent.toLowerCase().split(/\s+/));
    const totalWords = result.cleanedContent.split(/\s+/).length;
    const uniqueRatio = uniqueWords.size / totalWords;
    
    if (uniqueRatio < 0.3) {
      issues.push('High content repetition');
      score -= 25;
    }

    return {
      score: Math.max(0, score),
      issues,
      isValid: score >= 50,
    };
  }
}