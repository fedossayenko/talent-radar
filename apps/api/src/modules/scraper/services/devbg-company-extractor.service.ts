import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

export interface DevBgCompanyData {
  // Basic company information
  name: string | null;
  description: string | null;
  website: string | null;
  logo: string | null;
  
  // Company metrics
  employees: {
    global: number | null;
    bulgaria: number | null;
    it: number | null;
  };
  
  // Location information
  locations: {
    headquarters: string | null;
    offices: string[];
  };
  
  // Company details
  founded: number | null;
  industry: string | null;
  companySize: string | null; // startup, small, medium, large, enterprise
  
  // Job information
  jobOpenings: number;
  
  // Technology and culture
  technologies: string[];
  benefits: string[];
  values: string[];
  awards: string[];
  
  // Social and web presence
  socialLinks: {
    facebook: string | null;
    linkedin: string | null;
    instagram: string | null;
    youtube: string | null;
    twitter: string | null;
    github: string | null;
  };
  
  // Work environment
  workModel: string | null; // remote, hybrid, office
  workingHours: string | null; // flexible, standard, etc.
  
  // Additional structured data
  contactInfo: {
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  
  // Meta information
  extractionMetadata: {
    extractedAt: Date;
    sourceUrl: string;
    dataCompleteness: number; // 0-100 percentage
    structuredDataFound: boolean;
  };
}

/**
 * Service for extracting structured data from dev.bg company pages
 * Optimized for token efficiency by pre-processing HTML into structured JSON
 */
@Injectable()
export class DevBgCompanyExtractor {
  private readonly logger = new Logger(DevBgCompanyExtractor.name);

  /**
   * Extract structured company data from dev.bg HTML content
   */
  async extractCompanyData(html: string, sourceUrl: string): Promise<DevBgCompanyData> {
    const $ = cheerio.load(html);
    const extractedAt = new Date();
    
    this.logger.log(`Extracting structured data from dev.bg page: ${sourceUrl}`);

    const data: DevBgCompanyData = {
      name: this.extractCompanyName($),
      description: this.extractDescription($),
      website: this.extractWebsite($),
      logo: this.extractLogo($),
      
      employees: this.extractEmployeeMetrics($),
      locations: this.extractLocations($),
      
      founded: this.extractFoundedYear($),
      industry: this.extractIndustry($),
      companySize: this.extractCompanySize($),
      
      jobOpenings: this.extractJobOpenings($),
      
      technologies: this.extractTechnologies($),
      benefits: this.extractBenefits($),
      values: this.extractValues($),
      awards: this.extractAwards($),
      
      socialLinks: this.extractSocialLinks($),
      
      workModel: this.extractWorkModel($),
      workingHours: this.extractWorkingHours($),
      
      contactInfo: this.extractContactInfo($),
      
      extractionMetadata: {
        extractedAt,
        sourceUrl,
        dataCompleteness: 0, // Will be calculated
        structuredDataFound: false, // Will be determined
      },
    };

    // Calculate data completeness and update metadata
    data.extractionMetadata.dataCompleteness = this.calculateDataCompleteness(data);
    data.extractionMetadata.structuredDataFound = this.hasStructuredData(data);

    this.logger.log(`Data extraction completed. Completeness: ${data.extractionMetadata.dataCompleteness}%`);
    
    return data;
  }

  /**
   * Extract company name from various possible locations
   */
  private extractCompanyName($: cheerio.CheerioAPI): string | null {
    // Try multiple selectors for company name
    const selectors = [
      'h1.company-name',
      '.company-header h1',
      '.page-title',
      'h1',
      '.brand-name',
      '.company-title'
    ];

    for (const selector of selectors) {
      const name = $(selector).first().text().trim();
      if (name && !name.toLowerCase().includes('dev.bg')) {
        return name;
      }
    }

    // Fallback to title tag
    const title = $('title').text().trim();
    if (title) {
      // Remove "- dev.bg" suffix and similar patterns
      return title.replace(/\s*[-|–]\s*(dev\.bg|DEV\.BG).*$/i, '').trim() || null;
    }

    return null;
  }

  /**
   * Extract company description
   */
  private extractDescription($: cheerio.CheerioAPI): string | null {
    const selectors = [
      '.company-description',
      '.about-company',
      '.company-info .description',
      '.company-details p',
      '.about-text',
      '[data-testid="company-description"]'
    ];

    for (const selector of selectors) {
      const description = $(selector).first().text().trim();
      if (description && description.length > 20) {
        return description;
      }
    }

    return null;
  }

  /**
   * Extract company website URL
   */
  private extractWebsite($: cheerio.CheerioAPI): string | null {
    // Look for website links that are not dev.bg, social media, or job boards
    const excludePatterns = [
      'dev.bg',
      'linkedin.com',
      'facebook.com',
      'twitter.com',
      'instagram.com',
      'youtube.com',
      'jobs.bg',
      'indeed.com',
      'glassdoor.com',
      'jobboardfinder.com'
    ];

    const websiteLinks = $('a[href^="http"]');
    
    for (let i = 0; i < websiteLinks.length; i++) {
      const link = $(websiteLinks[i]);
      const href = link.attr('href');
      const linkText = link.text().toLowerCase();
      
      if (href) {
        const isExcluded = excludePatterns.some(pattern => href.includes(pattern));
        const looksLikeWebsite = linkText.includes('website') || 
                                linkText.includes('site') || 
                                href.match(/\.(com|bg|org|net|io|eu)$/);
        
        if (!isExcluded && (looksLikeWebsite || href.length < 100)) {
          return href;
        }
      }
    }

    return null;
  }

  /**
   * Extract company logo URL
   */
  private extractLogo($: cheerio.CheerioAPI): string | null {
    const logoSelectors = [
      '.company-logo img',
      '.logo img',
      '.brand-logo img',
      'img[alt*="logo"]'
    ];

    for (const selector of logoSelectors) {
      const src = $(selector).first().attr('src');
      if (src && (src.startsWith('http') || src.startsWith('//'))) {
        return src.startsWith('//') ? `https:${src}` : src;
      }
    }

    return null;
  }

  /**
   * Extract employee metrics from the page
   */
  private extractEmployeeMetrics($: cheerio.CheerioAPI): DevBgCompanyData['employees'] {
    const employees = {
      global: null as number | null,
      bulgaria: null as number | null,
      it: null as number | null,
    };

    // Look for employee count patterns in text
    const pageText = $.text();
    
    // Global employees patterns
    const globalPatterns = [
      /Global[^:]*:\s*(\d+[\d,]*)/i,
      /Worldwide[^:]*:\s*(\d+[\d,]*)/i,
      /Total employees[^:]*:\s*(\d+[\d,]*)/i,
      /(\d+[\d,]*)\+?\s*employees? globally/i
    ];

    // Bulgarian employees patterns
    const bulgarianPatterns = [
      /Bulgaria[^:]*:\s*(\d+[\d,]*)/i,
      /Bulgarian[^:]*:\s*(\d+[\d,]*)/i,
      /(\d+[\d,]*)\+?\s*employees? in Bulgaria/i,
      /Sofia[^:]*:\s*(\d+[\d,]*)/i
    ];

    // IT employees patterns
    const itPatterns = [
      /IT[^:]*:\s*(\d+[\d,]*)/i,
      /Tech[^:]*:\s*(\d+[\d,]*)/i,
      /Engineering[^:]*:\s*(\d+[\d,]*)/i,
      /(\d+[\d,]*)\+?\s*(IT|tech|engineering) employees?/i
    ];

    // Extract global employee count
    for (const pattern of globalPatterns) {
      const match = pageText.match(pattern);
      if (match) {
        employees.global = parseInt(match[1].replace(/,/g, ''), 10);
        break;
      }
    }

    // Extract Bulgarian employee count
    for (const pattern of bulgarianPatterns) {
      const match = pageText.match(pattern);
      if (match) {
        employees.bulgaria = parseInt(match[1].replace(/,/g, ''), 10);
        break;
      }
    }

    // Extract IT employee count
    for (const pattern of itPatterns) {
      const match = pageText.match(pattern);
      if (match) {
        employees.it = parseInt(match[1].replace(/,/g, ''), 10);
        break;
      }
    }

    return employees;
  }

  /**
   * Extract office locations
   */
  private extractLocations($: cheerio.CheerioAPI): DevBgCompanyData['locations'] {
    const locations = {
      headquarters: null as string | null,
      offices: [] as string[],
    };

    // Look for location information
    const locationSelectors = [
      '.location',
      '.address',
      '.office-location',
      '.headquarters',
      '.offices'
    ];

    const locationText = locationSelectors
      .map(selector => $(selector).text().trim())
      .filter(Boolean)
      .join(' ');

    // Extract headquarters
    const hqPatterns = [
      /Headquarters[^:]*:\s*([^,\n]+)/i,
      /HQ[^:]*:\s*([^,\n]+)/i,
      /Head office[^:]*:\s*([^,\n]+)/i
    ];

    for (const pattern of hqPatterns) {
      const match = locationText.match(pattern);
      if (match) {
        locations.headquarters = match[1].trim();
        break;
      }
    }

    // Extract office locations (common Bulgarian cities)
    const bulgarianCities = ['Sofia', 'Plovdiv', 'Varna', 'Burgas', 'Stara Zagora', 'Pleven', 'Ruse'];
    const pageText = $.text();
    
    for (const city of bulgarianCities) {
      if (pageText.includes(city) && !locations.offices.includes(city)) {
        locations.offices.push(city);
      }
    }

    return locations;
  }

  /**
   * Extract founding year
   */
  private extractFoundedYear($: cheerio.CheerioAPI): number | null {
    const pageText = $.text();
    const foundedPatterns = [
      /Founded[^:]*:\s*(\d{4})/i,
      /Established[^:]*:\s*(\d{4})/i,
      /Since[^:]*:\s*(\d{4})/i,
      /(\d{4})\s*-\s*present/i,
      /Founded in (\d{4})/i
    ];

    for (const pattern of foundedPatterns) {
      const match = pageText.match(pattern);
      if (match) {
        const year = parseInt(match[1], 10);
        if (year >= 1900 && year <= new Date().getFullYear()) {
          return year;
        }
      }
    }

    return null;
  }

  /**
   * Extract industry information
   */
  private extractIndustry($: cheerio.CheerioAPI): string | null {
    const industrySelectors = [
      '.industry',
      '.sector',
      '.business-type',
      '.category'
    ];

    for (const selector of industrySelectors) {
      const industry = $(selector).first().text().trim();
      if (industry) {
        return industry;
      }
    }

    // Look for industry keywords in description
    const description = $.text().toLowerCase();
    const industryKeywords = {
      'fintech': 'Financial Technology',
      'finance': 'Financial Services',
      'banking': 'Banking',
      'software': 'Software Development',
      'technology': 'Technology',
      'consulting': 'Consulting',
      'e-commerce': 'E-commerce',
      'gaming': 'Gaming',
      'healthcare': 'Healthcare',
      'logistics': 'Logistics',
      'education': 'Education',
      'media': 'Media & Entertainment'
    };

    for (const [keyword, industry] of Object.entries(industryKeywords)) {
      if (description.includes(keyword)) {
        return industry;
      }
    }

    return null;
  }

  /**
   * Extract company size category
   */
  private extractCompanySize($: cheerio.CheerioAPI): string | null {
    const pageText = $.text().toLowerCase();
    
    // Look for size indicators
    if (pageText.includes('startup') || pageText.includes('1-10')) return 'startup';
    if (pageText.includes('small') || pageText.includes('11-50')) return 'small';
    if (pageText.includes('medium') || pageText.includes('51-200')) return 'medium';
    if (pageText.includes('large') || pageText.includes('201-500')) return 'large';
    if (pageText.includes('enterprise') || pageText.includes('500+') || pageText.includes('1000+')) return 'enterprise';

    return null;
  }

  /**
   * Extract current job openings count
   */
  private extractJobOpenings($: cheerio.CheerioAPI): number {
    // Look for job count indicators
    const jobSelectors = [
      '.job-count',
      '.open-positions',
      '.vacancies-count',
      '.jobs-available'
    ];

    for (const selector of jobSelectors) {
      const text = $(selector).text();
      const match = text.match(/(\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }

    // Count job listing links if present
    const jobLinks = $('a[href*="/job/"], a[href*="/vacancy/"]');
    if (jobLinks.length > 0) {
      return jobLinks.length;
    }

    return 0;
  }

  /**
   * Extract technologies used by the company
   */
  private extractTechnologies($: cheerio.CheerioAPI): string[] {
    const technologies: Set<string> = new Set();

    // Look for technology sections
    const techSelectors = [
      '.technologies li',
      '.tech-stack li',
      '.skills li',
      '.tools li',
      '.programming-languages li'
    ];

    for (const selector of techSelectors) {
      $(selector).each((_, element) => {
        const tech = $(element).text().trim();
        if (tech && tech.length > 1) {
          technologies.add(tech);
        }
      });
    }

    // Look for common tech keywords in text
    const pageText = $.text();
    const commonTechs = [
      'JavaScript', 'Java', 'Python', 'C#', 'C++', 'Go', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin',
      'React', 'Angular', 'Vue.js', 'Node.js', 'Express', 'Spring', 'Django', 'Flask', '.NET',
      'AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'Jenkins', 'Git', 'GitLab',
      'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'ElasticSearch', 'Kafka', 'RabbitMQ',
      'Linux', 'Ubuntu', 'CentOS', 'Windows', 'MacOS'
    ];

    for (const tech of commonTechs) {
      if (pageText.includes(tech) && technologies.size < 20) {
        technologies.add(tech);
      }
    }

    return Array.from(technologies);
  }

  /**
   * Extract employee benefits
   */
  private extractBenefits($: cheerio.CheerioAPI): string[] {
    const benefits: Set<string> = new Set();

    // Look for benefits sections
    const benefitSelectors = [
      '.benefits li',
      '.perks li',
      '.company-benefits li',
      '.advantages li',
      '.why-work-here li'
    ];

    for (const selector of benefitSelectors) {
      $(selector).each((_, element) => {
        const benefit = $(element).text().trim();
        if (benefit && benefit.length > 3) {
          benefits.add(benefit);
        }
      });
    }

    // Look for common benefit keywords
    const pageText = $.text().toLowerCase();
    const commonBenefits = [
      'health insurance', 'dental insurance', 'life insurance',
      'remote work', 'flexible hours', 'work from home', 'hybrid work',
      'paid time off', 'vacation days', 'annual leave',
      'bonus', 'performance bonus', 'annual bonus',
      'training', 'courses', 'conferences', 'certifications',
      'gym membership', 'fitness', 'sports card',
      'free lunch', 'free breakfast', 'kitchen', 'snacks',
      'parking', 'transport allowance', 'company car',
      'team building', 'team events', 'parties',
      'mentorship', 'career development', 'growth opportunities'
    ];

    for (const benefit of commonBenefits) {
      if (pageText.includes(benefit) && benefits.size < 15) {
        benefits.add(benefit);
      }
    }

    return Array.from(benefits);
  }

  /**
   * Extract company values
   */
  private extractValues($: cheerio.CheerioAPI): string[] {
    const values: Set<string> = new Set();

    // Look for values sections
    const valueSelectors = [
      '.values li',
      '.principles li',
      '.culture li',
      '.beliefs li',
      '.company-values li'
    ];

    for (const selector of valueSelectors) {
      $(selector).each((_, element) => {
        const value = $(element).text().trim();
        if (value && value.length > 3 && value.length < 100) {
          values.add(value);
        }
      });
    }

    return Array.from(values);
  }

  /**
   * Extract awards and recognitions
   */
  private extractAwards($: cheerio.CheerioAPI): string[] {
    const awards: Set<string> = new Set();

    // Look for awards sections
    const awardSelectors = [
      '.awards li',
      '.recognition li',
      '.achievements li',
      '.certifications li'
    ];

    for (const selector of awardSelectors) {
      $(selector).each((_, element) => {
        const award = $(element).text().trim();
        if (award && award.length > 5) {
          awards.add(award);
        }
      });
    }

    // Look for award keywords in text
    const pageText = $.text();
    const awardPatterns = [
      /Best Employer[^.]+/gi,
      /Award[^.]+\d{4}/gi,
      /Certified[^.]+/gi,
      /Winner[^.]+/gi,
      /Recognized[^.]+/gi
    ];

    for (const pattern of awardPatterns) {
      const matches = pageText.match(pattern);
      if (matches) {
        matches.forEach(match => {
          if (match.length < 200 && awards.size < 10) {
            awards.add(match.trim());
          }
        });
      }
    }

    return Array.from(awards);
  }

  /**
   * Extract social media links
   */
  private extractSocialLinks($: cheerio.CheerioAPI): DevBgCompanyData['socialLinks'] {
    const socialLinks = {
      facebook: null as string | null,
      linkedin: null as string | null,
      instagram: null as string | null,
      youtube: null as string | null,
      twitter: null as string | null,
      github: null as string | null,
    };

    const links = $('a[href^="http"]');
    
    links.each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        if (href.includes('facebook.com') && !socialLinks.facebook) {
          socialLinks.facebook = href;
        } else if (href.includes('linkedin.com') && !socialLinks.linkedin) {
          socialLinks.linkedin = href;
        } else if (href.includes('instagram.com') && !socialLinks.instagram) {
          socialLinks.instagram = href;
        } else if (href.includes('youtube.com') && !socialLinks.youtube) {
          socialLinks.youtube = href;
        } else if (href.includes('twitter.com') && !socialLinks.twitter) {
          socialLinks.twitter = href;
        } else if (href.includes('github.com') && !socialLinks.github) {
          socialLinks.github = href;
        }
      }
    });

    return socialLinks;
  }

  /**
   * Extract work model information
   */
  private extractWorkModel($: cheerio.CheerioAPI): string | null {
    const pageText = $.text().toLowerCase();
    
    if (pageText.includes('fully remote') || pageText.includes('100% remote')) {
      return 'remote';
    } else if (pageText.includes('hybrid') || pageText.includes('flexible office')) {
      return 'hybrid';
    } else if (pageText.includes('office-based') || pageText.includes('on-site')) {
      return 'office';
    }

    return null;
  }

  /**
   * Extract working hours information
   */
  private extractWorkingHours($: cheerio.CheerioAPI): string | null {
    const pageText = $.text().toLowerCase();
    
    if (pageText.includes('flexible hours') || pageText.includes('flexible working hours')) {
      return 'flexible';
    } else if (pageText.includes('standard hours') || pageText.includes('9 to 5')) {
      return 'standard';
    } else if (pageText.includes('core hours')) {
      return 'core_hours';
    }

    return null;
  }

  /**
   * Extract contact information
   */
  private extractContactInfo($: cheerio.CheerioAPI): DevBgCompanyData['contactInfo'] {
    const contactInfo = {
      email: null as string | null,
      phone: null as string | null,
      address: null as string | null,
    };

    const pageText = $.text();

    // Extract email
    const emailMatch = pageText.match(/[\w._%+-]+@[\w.-]+\.[A-Z|a-z]{2,}/);
    if (emailMatch) {
      contactInfo.email = emailMatch[0];
    }

    // Extract phone
    const phoneMatch = pageText.match(/\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/);
    if (phoneMatch) {
      contactInfo.phone = phoneMatch[0];
    }

    // Extract address (look for address-like patterns)
    const addressSelectors = ['.address', '.contact-address', '.office-address'];
    for (const selector of addressSelectors) {
      const address = $(selector).first().text().trim();
      if (address && address.length > 10) {
        contactInfo.address = address;
        break;
      }
    }

    return contactInfo;
  }

  /**
   * Calculate data completeness score
   */
  private calculateDataCompleteness(data: DevBgCompanyData): number {
    const fields = [
      data.name,
      data.description,
      data.website,
      data.employees.global,
      data.employees.bulgaria,
      data.founded,
      data.industry,
      data.technologies.length > 0 ? 'technologies' : null,
      data.benefits.length > 0 ? 'benefits' : null,
      data.values.length > 0 ? 'values' : null,
      data.locations.offices.length > 0 ? 'offices' : null,
      data.workModel,
      data.socialLinks.linkedin || data.socialLinks.facebook ? 'social' : null,
    ];

    const nonNullFields = fields.filter(field => field !== null).length;
    return Math.round((nonNullFields / fields.length) * 100);
  }

  /**
   * Check if structured data was found
   */
  private hasStructuredData(data: DevBgCompanyData): boolean {
    return !!(
      data.name ||
      data.employees.global ||
      data.employees.bulgaria ||
      data.technologies.length > 0 ||
      data.benefits.length > 0 ||
      data.jobOpenings > 0
    );
  }
}