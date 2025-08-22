import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/database/prisma.service';
import { CompanySource } from '@prisma/client';
import * as crypto from 'crypto';

export interface CacheCheckResult {
  shouldScrape: boolean;
  existingSource?: CompanySource;
  reason: string;
}

export interface CompanySourceData {
  companyId: string;
  sourceSite: string;
  sourceUrl: string;
  scrapedContent?: string;
  isValid?: boolean;
}

/**
 * Service for managing company data sources and TTL caching
 */
@Injectable()
export class CompanySourceService {
  private readonly logger = new Logger(CompanySourceService.name);
  
  // TTL Configuration (in hours)
  private readonly ttlConfig = {
    'dev.bg': 24 * 30,        // 30 days for dev.bg profiles
    'company_website': 24 * 7, // 7 days for company websites
    'default': 24 * 14,       // 14 days default
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.logger.log('CompanySourceService initialized');
  }

  /**
   * Check if we should scrape a company source based on TTL rules
   */
  async shouldScrapeCompanySource(
    companyId: string, 
    sourceSite: string, 
    sourceUrl: string,
    force = false
  ): Promise<CacheCheckResult> {
    try {
      const existingSource = await this.prisma.companySource.findUnique({
        where: {
          companyId_sourceSite: {
            companyId,
            sourceSite,
          },
        },
      });

      if (!existingSource) {
        return {
          shouldScrape: true,
          reason: 'No existing source found',
        };
      }

      // If force flag is enabled, bypass all TTL checks
      if (force) {
        return {
          shouldScrape: true,
          existingSource,
          reason: 'Force flag enabled - bypassing TTL',
        };
      }

      // Check if URL has changed
      if (existingSource.sourceUrl !== sourceUrl) {
        return {
          shouldScrape: true,
          existingSource,
          reason: 'Source URL has changed',
        };
      }

      // Check if source is marked as invalid
      if (!existingSource.isValid) {
        return {
          shouldScrape: true,
          existingSource,
          reason: 'Source was marked as invalid',
        };
      }

      // Check TTL
      const ttlHours = this.ttlConfig[sourceSite] || this.ttlConfig.default;
      const expiryTime = new Date(existingSource.lastScrapedAt.getTime() + ttlHours * 60 * 60 * 1000);
      const now = new Date();

      if (now > expiryTime) {
        return {
          shouldScrape: true,
          existingSource,
          reason: `TTL expired (${ttlHours}h limit exceeded)`,
        };
      }

      return {
        shouldScrape: false,
        existingSource,
        reason: `Within TTL window (expires in ${Math.round((expiryTime.getTime() - now.getTime()) / (1000 * 60 * 60))}h)`,
      };

    } catch (error) {
      this.logger.error(`Failed to check cache for company ${companyId} source ${sourceSite}:`, error);
      return {
        shouldScrape: true,
        reason: `Cache check failed: ${error.message}`,
      };
    }
  }

  /**
   * Save or update company source data
   */
  async saveCompanySource(data: CompanySourceData): Promise<CompanySource> {
    try {
      const contentHash = data.scrapedContent ? 
        crypto.createHash('sha256').update(data.scrapedContent).digest('hex') :
        undefined;

      const companySource = await this.prisma.companySource.upsert({
        where: {
          companyId_sourceSite: {
            companyId: data.companyId,
            sourceSite: data.sourceSite,
          },
        },
        update: {
          sourceUrl: data.sourceUrl,
          lastScrapedAt: new Date(),
          scrapedContent: data.scrapedContent,
          contentHash,
          isValid: data.isValid ?? true,
          updatedAt: new Date(),
        },
        create: {
          companyId: data.companyId,
          sourceSite: data.sourceSite,
          sourceUrl: data.sourceUrl,
          scrapedContent: data.scrapedContent,
          contentHash,
          isValid: data.isValid ?? true,
        },
      });

      this.logger.log(`Saved company source: ${data.sourceSite} for company ${data.companyId}`);
      return companySource;

    } catch (error) {
      this.logger.error(`Failed to save company source:`, error);
      throw error;
    }
  }

  /**
   * Mark a company source as invalid (e.g., URL no longer works)
   */
  async markSourceAsInvalid(companyId: string, sourceSite: string, error?: string): Promise<void> {
    try {
      await this.prisma.companySource.updateMany({
        where: {
          companyId,
          sourceSite,
        },
        data: {
          isValid: false,
          updatedAt: new Date(),
        },
      });

      this.logger.warn(`Marked company source as invalid: ${sourceSite} for company ${companyId}. Error: ${error}`);

    } catch (updateError) {
      this.logger.error(`Failed to mark source as invalid:`, updateError);
    }
  }

  /**
   * Get all sources for a company
   */
  async getCompanySources(companyId: string): Promise<CompanySource[]> {
    return this.prisma.companySource.findMany({
      where: { companyId },
      orderBy: { lastScrapedAt: 'desc' },
    });
  }

  /**
   * Check if content has changed by comparing hashes
   */
  async hasContentChanged(
    companyId: string, 
    sourceSite: string, 
    newContent: string
  ): Promise<boolean> {
    try {
      const existingSource = await this.prisma.companySource.findUnique({
        where: {
          companyId_sourceSite: {
            companyId,
            sourceSite,
          },
        },
        select: { contentHash: true },
      });

      if (!existingSource?.contentHash) {
        return true; // No existing hash, consider it changed
      }

      const newContentHash = crypto.createHash('sha256').update(newContent).digest('hex');
      return existingSource.contentHash !== newContentHash;

    } catch (error) {
      this.logger.error(`Failed to check content change:`, error);
      return true; // Assume changed on error
    }
  }

  /**
   * Clean up old/invalid sources
   */
  async cleanupOldSources(olderThanDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.prisma.companySource.deleteMany({
        where: {
          OR: [
            { isValid: false },
            { lastScrapedAt: { lt: cutoffDate } },
          ],
        },
      });

      this.logger.log(`Cleaned up ${result.count} old company sources`);
      return result.count;

    } catch (error) {
      this.logger.error('Failed to cleanup old sources:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalSources: number;
    validSources: number;
    invalidSources: number;
    sourcesByType: Record<string, number>;
    oldestSource: Date | null;
    newestSource: Date | null;
  }> {
    try {
      const totalSources = await this.prisma.companySource.count();
      const validSources = await this.prisma.companySource.count({
        where: { isValid: true },
      });
      const invalidSources = totalSources - validSources;

      const sourcesByType = await this.prisma.companySource.groupBy({
        by: ['sourceSite'],
        _count: { id: true },
      });

      const sourceTypeMap = sourcesByType.reduce((acc, item) => {
        acc[item.sourceSite] = item._count.id;
        return acc;
      }, {} as Record<string, number>);

      const oldestSource = await this.prisma.companySource.findFirst({
        orderBy: { lastScrapedAt: 'asc' },
        select: { lastScrapedAt: true },
      });

      const newestSource = await this.prisma.companySource.findFirst({
        orderBy: { lastScrapedAt: 'desc' },
        select: { lastScrapedAt: true },
      });

      return {
        totalSources,
        validSources,
        invalidSources,
        sourcesByType: sourceTypeMap,
        oldestSource: oldestSource?.lastScrapedAt || null,
        newestSource: newestSource?.lastScrapedAt || null,
      };

    } catch (error) {
      this.logger.error('Failed to get cache stats:', error);
      return {
        totalSources: 0,
        validSources: 0,
        invalidSources: 0,
        sourcesByType: {},
        oldestSource: null,
        newestSource: null,
      };
    }
  }
}