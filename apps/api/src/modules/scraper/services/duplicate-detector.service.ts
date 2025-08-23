import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { JobListing } from '../interfaces/job-scraper.interface';

interface DuplicateMatch {
  existingId: string;
  matchScore: number;
  matchReasons: string[];
  shouldMerge: boolean;
}

interface SimilarityScore {
  title: number;
  company: number;
  location: number;
  overall: number;
}

/**
 * Service for detecting duplicate job listings across different sites
 * Uses multiple signals to identify the same job posted on different platforms
 */
@Injectable()
export class DuplicateDetectorService {
  private readonly logger = new Logger(DuplicateDetectorService.name);

  // Thresholds for duplicate detection
  private readonly EXACT_MATCH_THRESHOLD = 0.95;
  private readonly FUZZY_MATCH_THRESHOLD = 0.80;
  private readonly MIN_MATCH_THRESHOLD = 0.70;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find potential duplicates for a job listing across all sites
   */
  async findDuplicates(jobListing: JobListing): Promise<DuplicateMatch[]> {
    this.logger.debug(`Searching for duplicates of: ${jobListing.title} at ${jobListing.company}`);

    const candidates = await this.findCandidateJobs(jobListing);
    const matches: DuplicateMatch[] = [];

    for (const candidate of candidates) {
      const matchScore = this.calculateSimilarityScore(jobListing, candidate);
      
      if (matchScore.overall >= this.MIN_MATCH_THRESHOLD) {
        const matchReasons = this.getMatchReasons(jobListing, candidate, matchScore);
        
        matches.push({
          existingId: candidate.id,
          matchScore: matchScore.overall,
          matchReasons,
          shouldMerge: matchScore.overall >= this.FUZZY_MATCH_THRESHOLD,
        });
      }
    }

    // Sort by match score (highest first)
    matches.sort((a, b) => b.matchScore - a.matchScore);

    this.logger.debug(`Found ${matches.length} potential duplicates`);
    return matches;
  }

  /**
   * Check if a job listing already exists (exact match by external IDs or URL)
   */
  async findExactMatch(jobListing: JobListing): Promise<string | null> {
    // First check by source URL (most reliable)
    if (jobListing.url) {
      const byUrl = await this.prisma.vacancy.findFirst({
        where: { sourceUrl: jobListing.url },
        select: { id: true },
      });
      
      if (byUrl) {
        this.logger.debug(`Found exact match by URL: ${byUrl.id}`);
        return byUrl.id;
      }
    }

    // Check by external ID in externalIds JSON field
    if (jobListing.originalJobId && jobListing.sourceSite) {
      const byExternalId = await this.prisma.vacancy.findFirst({
        where: {
          externalIds: {
            path: [jobListing.sourceSite],
            equals: jobListing.originalJobId,
          },
        },
        select: { id: true },
      });
      
      if (byExternalId) {
        this.logger.debug(`Found exact match by external ID: ${byExternalId.id}`);
        return byExternalId.id;
      }
    }

    return null;
  }

  /**
   * Merge job listings from different sites
   */
  async mergeJobListings(primaryId: string, jobListing: JobListing): Promise<void> {
    this.logger.log(`Merging job listing from ${jobListing.sourceSite} into existing job ${primaryId}`);

    // Get the existing job
    const existingJob = await this.prisma.vacancy.findUnique({
      where: { id: primaryId },
      include: { company: true },
    });

    if (!existingJob) {
      throw new Error(`Job ${primaryId} not found for merging`);
    }

    // Prepare the update data
    const updateData: any = {
      // Update last seen date
      updatedAt: new Date(),
    };

    // Merge external IDs
    const externalIds = (existingJob.externalIds as any) || {};
    if (jobListing.originalJobId && jobListing.sourceSite) {
      externalIds[jobListing.sourceSite] = jobListing.originalJobId;
      updateData.externalIds = externalIds;
    }

    // Merge scraped sites tracking
    const scrapedSites = (existingJob.scrapedSites as any) || {};
    scrapedSites[jobListing.sourceSite] = {
      lastSeenAt: new Date().toISOString(),
      url: jobListing.url,
      originalId: jobListing.originalJobId,
    };
    updateData.scrapedSites = scrapedSites;

    // If the new listing has better/more complete information, update fields
    if (jobListing.description && !existingJob.description) {
      updateData.description = jobListing.description;
    }

    // Merge technologies (keep unique)
    if (jobListing.technologies && jobListing.technologies.length > 0) {
      const existingTechs = (existingJob.technologies as string[]) || [];
      const mergedTechs = Array.from(new Set([...existingTechs, ...jobListing.technologies]));
      updateData.technologies = mergedTechs;
    }

    // Update salary if new information is better
    if (jobListing.salaryRange && !existingJob.salaryMin && !existingJob.salaryMax) {
      // Parse salary from range if available
      const salaryInfo = this.parseSalaryRange(jobListing.salaryRange);
      if (salaryInfo) {
        updateData.salaryMin = salaryInfo.min;
        updateData.salaryMax = salaryInfo.max;
        updateData.currency = salaryInfo.currency;
      }
    }

    // Update the job
    await this.prisma.vacancy.update({
      where: { id: primaryId },
      data: updateData,
    });

    this.logger.log(`Successfully merged job listing from ${jobListing.sourceSite}`);
  }

  private async findCandidateJobs(jobListing: JobListing): Promise<any[]> {
    // Find jobs with similar titles from the same company
    const companyMatches = await this.prisma.vacancy.findMany({
      where: {
        company: {
          name: {
            contains: jobListing.company,
            mode: 'insensitive',
          },
        },
        // Only look at jobs from last 30 days to avoid very old duplicates
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        company: {
          select: { name: true, website: true },
        },
      },
      take: 50, // Limit to avoid performance issues
    });

    // Also find jobs with very similar titles regardless of company
    // (in case company names are different on different sites)
    const titleWords = jobListing.title.toLowerCase().split(' ').filter(word => word.length > 2);
    const titleMatches = titleWords.length > 0 ? await this.prisma.vacancy.findMany({
      where: {
        title: {
          contains: titleWords[0], // Use first significant word
          mode: 'insensitive',
        },
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        company: {
          select: { name: true, website: true },
        },
      },
      take: 30,
    }) : [];

    // Combine and deduplicate
    const allCandidates = [...companyMatches, ...titleMatches];
    const uniqueCandidates = allCandidates.filter(
      (candidate, index, array) => array.findIndex(c => c.id === candidate.id) === index
    );

    return uniqueCandidates;
  }

  private calculateSimilarityScore(newJob: JobListing, existingJob: any): SimilarityScore {
    const titleSimilarity = this.stringSimilarity(newJob.title, existingJob.title);
    const companySimilarity = this.stringSimilarity(newJob.company, existingJob.company.name);
    const locationSimilarity = this.stringSimilarity(newJob.location || '', existingJob.location || '');

    // Technology overlap bonus
    let techBonus = 0;
    if (newJob.technologies && existingJob.technologies) {
      const newTechs = new Set(newJob.technologies.map(t => t.toLowerCase()));
      const existingTechs = new Set((existingJob.technologies as string[]).map(t => t.toLowerCase()));
      
      const intersection = new Set([...newTechs].filter(x => existingTechs.has(x)));
      const union = new Set([...newTechs, ...existingTechs]);
      
      if (union.size > 0) {
        techBonus = intersection.size / union.size * 0.2; // Up to 20% bonus
      }
    }

    // Posted date proximity bonus (jobs posted around the same time are more likely to be duplicates)
    let dateBonus = 0;
    if (newJob.postedDate && existingJob.postedAt) {
      const timeDiff = Math.abs(newJob.postedDate.getTime() - new Date(existingJob.postedAt).getTime());
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
      
      if (daysDiff <= 1) dateBonus = 0.1; // 10% bonus for same day
      else if (daysDiff <= 7) dateBonus = 0.05; // 5% bonus for same week
    }

    const overall = (titleSimilarity * 0.4 + companySimilarity * 0.4 + locationSimilarity * 0.2) + techBonus + dateBonus;

    return {
      title: titleSimilarity,
      company: companySimilarity,
      location: locationSimilarity,
      overall: Math.min(overall, 1.0), // Cap at 100%
    };
  }

  private stringSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1.0;
    
    // Use Jaro-Winkler similarity for better fuzzy matching
    return this.jaroWinkler(s1, s2);
  }

  private jaroWinkler(s1: string, s2: string): number {
    const jaro = this.jaro(s1, s2);
    
    if (jaro < 0.7) return jaro;
    
    // Calculate common prefix length (up to 4 characters)
    let prefixLength = 0;
    for (let i = 0; i < Math.min(s1.length, s2.length, 4); i++) {
      if (s1[i] === s2[i]) {
        prefixLength++;
      } else {
        break;
      }
    }
    
    return jaro + (prefixLength * 0.1 * (1 - jaro));
  }

  private jaro(s1: string, s2: string): number {
    if (s1.length === 0 && s2.length === 0) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0.0;
    
    const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
    if (matchWindow < 0) return 0.0;
    
    const s1Matches = new Array(s1.length).fill(false);
    const s2Matches = new Array(s2.length).fill(false);
    
    let matches = 0;
    let transpositions = 0;
    
    // Find matches
    for (let i = 0; i < s1.length; i++) {
      const start = Math.max(0, i - matchWindow);
      const end = Math.min(i + matchWindow + 1, s2.length);
      
      for (let j = start; j < end; j++) {
        if (s2Matches[j] || s1[i] !== s2[j]) continue;
        
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches++;
        break;
      }
    }
    
    if (matches === 0) return 0.0;
    
    // Count transpositions
    let k = 0;
    for (let i = 0; i < s1.length; i++) {
      if (!s1Matches[i]) continue;
      
      while (!s2Matches[k]) k++;
      
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }
    
    return (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3.0;
  }

  private getMatchReasons(newJob: JobListing, existingJob: any, scores: SimilarityScore): string[] {
    const reasons: string[] = [];
    
    if (scores.title > 0.9) reasons.push('Very similar job titles');
    else if (scores.title > 0.7) reasons.push('Similar job titles');
    
    if (scores.company > 0.9) reasons.push('Same company');
    else if (scores.company > 0.7) reasons.push('Similar company names');
    
    if (scores.location > 0.8) reasons.push('Same location');
    
    // Check for common technologies
    if (newJob.technologies && existingJob.technologies) {
      const commonTechs = newJob.technologies.filter(tech => 
        (existingJob.technologies as string[]).some(existingTech => 
          tech.toLowerCase() === existingTech.toLowerCase()
        )
      );
      
      if (commonTechs.length >= 3) {
        reasons.push(`Many common technologies (${commonTechs.slice(0, 3).join(', ')})`);
      } else if (commonTechs.length > 0) {
        reasons.push(`Common technologies (${commonTechs.join(', ')})`);
      }
    }
    
    // Check posted date proximity
    if (newJob.postedDate && existingJob.postedAt) {
      const daysDiff = Math.abs(newJob.postedDate.getTime() - new Date(existingJob.postedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff <= 1) reasons.push('Posted on same day');
      else if (daysDiff <= 7) reasons.push('Posted within same week');
    }
    
    return reasons;
  }

  private parseSalaryRange(salaryRange: string): { min?: number; max?: number; currency?: string } | null {
    if (!salaryRange) return null;
    
    // Simple regex to extract salary range
    const match = salaryRange.match(/(\d+[\d,\s]*)\s*[-–]\s*(\d+[\d,\s]*)\s*([A-Z]{3}|лв|лева)?/);
    if (match) {
      return {
        min: parseInt(match[1].replace(/[\s,]/g, ''), 10),
        max: parseInt(match[2].replace(/[\s,]/g, ''), 10),
        currency: match[3]?.includes('лв') ? 'BGN' : match[3] || 'BGN',
      };
    }
    
    return null;
  }
}