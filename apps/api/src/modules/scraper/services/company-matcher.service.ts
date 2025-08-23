import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';

interface CompanyMatchResult {
  existingId: string;
  matchScore: number;
  matchReasons: string[];
  shouldMerge: boolean;
}

interface CompanyData {
  name: string;
  website?: string;
  location?: string;
  industry?: string;
  description?: string;
}

/**
 * Service for matching and deduplicating companies across different job sites
 * Handles variations in company names and identifies the same company on different platforms
 */
@Injectable()
export class CompanyMatcherService {
  private readonly logger = new Logger(CompanyMatcherService.name);

  // Common company suffixes to normalize
  private readonly COMPANY_SUFFIXES = [
    'Ltd', 'Limited', 'LLC', 'Inc', 'Incorporated', 'Corp', 'Corporation',
    'GmbH', 'AG', 'SA', 'SRL', 'EOOD', 'OOD', 'AD', 'EAD',
    'Bulgaria', 'BG', 'Europe', 'International', 'Global', 'Worldwide'
  ];

  // Common words that don't affect company identity
  private readonly IGNORE_WORDS = [
    'The', 'Company', 'Group', 'Solutions', 'Services', 'Technologies',
    'Software', 'Systems', 'Consulting', 'Labs', 'Studio', 'Team'
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find or create a company, handling deduplication automatically
   */
  async findOrCreateCompany(companyData: CompanyData): Promise<{ id: string; isNew: boolean }> {
    this.logger.debug(`Finding or creating company: ${companyData.name}`);

    // First check for exact matches
    const exactMatch = await this.findExactMatch(companyData);
    if (exactMatch) {
      this.logger.debug(`Found exact match: ${exactMatch}`);
      return { id: exactMatch, isNew: false };
    }

    // Look for fuzzy matches
    const matches = await this.findSimilarCompanies(companyData);
    const bestMatch = matches.find(match => match.shouldMerge);

    if (bestMatch) {
      this.logger.log(`Merging with existing company ${bestMatch.existingId} (score: ${bestMatch.matchScore.toFixed(2)})`);
      await this.mergeCompanyData(bestMatch.existingId, companyData);
      return { id: bestMatch.existingId, isNew: false };
    }

    // Create new company
    this.logger.log(`Creating new company: ${companyData.name}`);
    const newCompany = await this.prisma.company.create({
      data: {
        name: companyData.name,
        website: companyData.website,
        location: companyData.location,
        industry: companyData.industry,
        description: companyData.description,
        companyAliases: [companyData.name], // Track all known names
      },
    });

    return { id: newCompany.id, isNew: true };
  }

  /**
   * Find potential duplicate companies
   */
  async findSimilarCompanies(companyData: CompanyData): Promise<CompanyMatchResult[]> {
    const matches: CompanyMatchResult[] = [];

    // Get candidate companies
    const candidates = await this.findCandidateCompanies(companyData);

    for (const candidate of candidates) {
      const matchScore = this.calculateCompanySimilarity(companyData, candidate);
      
      if (matchScore >= 0.6) { // Minimum threshold for consideration
        const matchReasons = this.getCompanyMatchReasons(companyData, candidate, matchScore);
        
        matches.push({
          existingId: candidate.id,
          matchScore,
          matchReasons,
          shouldMerge: matchScore >= 0.8, // Higher threshold for auto-merge
        });
      }
    }

    // Sort by match score
    matches.sort((a, b) => b.matchScore - a.matchScore);

    this.logger.debug(`Found ${matches.length} potential company matches`);
    return matches;
  }

  private async findExactMatch(companyData: CompanyData): Promise<string | null> {
    // Check by website domain (most reliable)
    if (companyData.website) {
      const domain = this.extractDomain(companyData.website);
      if (domain) {
        const byWebsite = await this.prisma.company.findFirst({
          where: {
            OR: [
              { website: { contains: domain, mode: 'insensitive' } },
              { originalWebsite: { contains: domain, mode: 'insensitive' } },
            ],
          },
          select: { id: true },
        });
        
        if (byWebsite) return byWebsite.id;
      }
    }

    // Check by exact name match
    const byName = await this.prisma.company.findFirst({
      where: {
        name: { equals: companyData.name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    
    if (byName) return byName.id;

    // Check in company aliases
    const byAlias = await this.prisma.company.findFirst({
      where: {
        companyAliases: {
          array_contains: [companyData.name],
        },
      },
      select: { id: true },
    });
    
    if (byAlias) return byAlias.id;

    return null;
  }

  private async findCandidateCompanies(companyData: CompanyData): Promise<any[]> {
    const normalizedName = this.normalizeCompanyName(companyData.name);
    const nameWords = normalizedName.split(' ').filter(word => word.length > 2);

    if (nameWords.length === 0) return [];

    // Find companies with similar names
    const candidates = await this.prisma.company.findMany({
      where: {
        OR: [
          // Match by first significant word
          { name: { contains: nameWords[0], mode: 'insensitive' } },
          // Match by any word in aliases
          ...nameWords.map(word => ({
            companyAliases: {
              array_contains: [word],
            },
          })),
          // Match by website domain if available
          ...(companyData.website ? [{
            website: { contains: this.extractDomain(companyData.website) || '', mode: 'insensitive' }
          }] : []),
        ],
      },
      take: 50, // Limit results for performance
    });

    return candidates;
  }

  private calculateCompanySimilarity(newCompany: CompanyData, existingCompany: any): number {
    const nameScore = this.calculateNameSimilarity(newCompany.name, existingCompany.name);
    
    let websiteScore = 0;
    if (newCompany.website && existingCompany.website) {
      const domain1 = this.extractDomain(newCompany.website);
      const domain2 = this.extractDomain(existingCompany.website);
      
      if (domain1 && domain2) {
        websiteScore = domain1 === domain2 ? 1.0 : 0;
      }
    }

    let locationScore = 0;
    if (newCompany.location && existingCompany.location) {
      locationScore = this.stringSimilarity(newCompany.location, existingCompany.location);
    }

    let industryScore = 0;
    if (newCompany.industry && existingCompany.industry) {
      industryScore = this.stringSimilarity(newCompany.industry, existingCompany.industry);
    }

    // Check aliases
    let aliasScore = 0;
    if (existingCompany.companyAliases) {
      const aliases = existingCompany.companyAliases as string[];
      aliasScore = Math.max(...aliases.map(alias => 
        this.calculateNameSimilarity(newCompany.name, alias)
      ));
    }

    // Website domain match is very strong signal
    if (websiteScore === 1.0) {
      return 0.95; // Almost certain match
    }

    // Weighted combination
    const weights = {
      name: 0.5,
      alias: 0.3,
      location: 0.1,
      industry: 0.1,
    };

    return (nameScore * weights.name) + 
           (aliasScore * weights.alias) + 
           (locationScore * weights.location) + 
           (industryScore * weights.industry);
  }

  private calculateNameSimilarity(name1: string, name2: string): number {
    if (!name1 || !name2) return 0;

    const normalized1 = this.normalizeCompanyName(name1);
    const normalized2 = this.normalizeCompanyName(name2);

    if (normalized1 === normalized2) return 1.0;

    // Check if one is contained in the other (common with subsidiaries)
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return 0.85;
    }

    // Use string similarity
    return this.stringSimilarity(normalized1, normalized2);
  }

  private normalizeCompanyName(name: string): string {
    if (!name) return '';

    const normalized = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Remove common suffixes
    const words = normalized.split(' ');
    const filteredWords = words.filter(word => 
      !this.COMPANY_SUFFIXES.some(suffix => word === suffix.toLowerCase()) &&
      !this.IGNORE_WORDS.some(ignore => word === ignore.toLowerCase())
    );

    return filteredWords.join(' ');
  }

  private stringSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1.0;
    
    // Simple Levenshtein distance based similarity
    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    
    return maxLength === 0 ? 1 : 1 - (distance / maxLength);
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private extractDomain(url: string): string | null {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      // If URL parsing fails, try simple regex
      const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^/]+)/);
      return match ? match[1] : null;
    }
  }

  private getCompanyMatchReasons(newCompany: CompanyData, existingCompany: any, _score: number): string[] {
    const reasons: string[] = [];

    // Check name similarity
    const nameScore = this.calculateNameSimilarity(newCompany.name, existingCompany.name);
    if (nameScore > 0.9) reasons.push('Very similar company names');
    else if (nameScore > 0.7) reasons.push('Similar company names');

    // Check website domain
    if (newCompany.website && existingCompany.website) {
      const domain1 = this.extractDomain(newCompany.website);
      const domain2 = this.extractDomain(existingCompany.website);
      if (domain1 && domain2 && domain1 === domain2) {
        reasons.push('Same website domain');
      }
    }

    // Check location
    if (newCompany.location && existingCompany.location) {
      const locationScore = this.stringSimilarity(newCompany.location, existingCompany.location);
      if (locationScore > 0.8) reasons.push('Same location');
    }

    // Check industry
    if (newCompany.industry && existingCompany.industry) {
      const industryScore = this.stringSimilarity(newCompany.industry, existingCompany.industry);
      if (industryScore > 0.8) reasons.push('Same industry');
    }

    // Check aliases
    if (existingCompany.companyAliases) {
      const aliases = existingCompany.companyAliases as string[];
      const aliasMatch = aliases.find(alias => 
        this.calculateNameSimilarity(newCompany.name, alias) > 0.9
      );
      if (aliasMatch) {
        reasons.push(`Matches known alias: ${aliasMatch}`);
      }
    }

    return reasons;
  }

  private async mergeCompanyData(existingId: string, newCompanyData: CompanyData): Promise<void> {
    const existingCompany = await this.prisma.company.findUnique({
      where: { id: existingId },
    });

    if (!existingCompany) {
      throw new Error(`Company ${existingId} not found for merging`);
    }

    const updateData: any = {};

    // Add new name to aliases if not already present
    const aliases = (existingCompany.companyAliases as string[]) || [];
    if (!aliases.some(alias => alias.toLowerCase() === newCompanyData.name.toLowerCase())) {
      updateData.companyAliases = [...aliases, newCompanyData.name];
    }

    // Update website if we have a new one and old one is empty
    if (newCompanyData.website && !existingCompany.website) {
      updateData.website = newCompanyData.website;
    } else if (newCompanyData.website && newCompanyData.website !== existingCompany.website) {
      // Store original website if different
      updateData.originalWebsite = existingCompany.website;
      updateData.website = newCompanyData.website;
    }

    // Update other fields if they're empty
    if (newCompanyData.location && !existingCompany.location) {
      updateData.location = newCompanyData.location;
    }

    if (newCompanyData.industry && !existingCompany.industry) {
      updateData.industry = newCompanyData.industry;
    }

    if (newCompanyData.description && !existingCompany.description) {
      updateData.description = newCompanyData.description;
    }

    // Only update if there are changes
    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = new Date();
      
      await this.prisma.company.update({
        where: { id: existingId },
        data: updateData,
      });

      this.logger.log(`Updated company ${existingId} with new data from ${newCompanyData.name}`);
    }
  }
}