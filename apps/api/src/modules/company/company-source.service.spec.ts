import { Test, TestingModule } from '@nestjs/testing';
import { CompanySourceService } from './company-source.service';
import { PrismaService } from '../../common/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { createMockPrismaService } from '../../../test/test-utils/prisma-mock.helper';
import { createHash } from 'crypto';

describe('CompanySourceService', () => {
  let service: CompanySourceService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockPrismaService = {
    ...createMockPrismaService(),
    companySource: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };
  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanySourceService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<CompanySourceService>(CompanySourceService);
    prismaService = module.get<jest.Mocked<PrismaService>>(PrismaService);

    // ConfigService is not used for TTL - it's hardcoded in the service
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('shouldScrapeCompanySource', () => {
    const companyId = 'company-123';
    const sourceSite = 'dev.bg';
    const sourceUrl = 'https://dev.bg/company/example/';

    it('should return true with reason when no existing source found', async () => {
      // Arrange
      prismaService.companySource.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.shouldScrapeCompanySource(companyId, sourceSite, sourceUrl);

      // Assert
      expect(result.shouldScrape).toBe(true);
      expect(result.reason).toBe('No existing source found');
      expect(prismaService.companySource.findUnique).toHaveBeenCalledWith({
        where: {
          companyId_sourceSite: {
            companyId,
            sourceSite,
          },
        },
      });
    });

    it('should return true when existing source has expired TTL', async () => {
      // Arrange - Create a source that's older than TTL for dev.bg (30 days)
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 31); // 31 days ago (beyond 30 day TTL for dev.bg)
      
      const expiredSource = {
        id: 'source-1',
        companyId,
        sourceSite,
        sourceUrl,
        lastScrapedAt: expiredDate,
        isValid: true,
        contentHash: 'old-hash',
        scrapedContent: 'old content',
        createdAt: expiredDate,
        updatedAt: expiredDate,
      };

      prismaService.companySource.findUnique.mockResolvedValue(expiredSource);

      // Act
      const result = await service.shouldScrapeCompanySource(companyId, sourceSite, sourceUrl);

      // Assert
      expect(result.shouldScrape).toBe(true);
      expect(result.reason).toContain('TTL expired');
    });

    it('should return false when existing source is within TTL', async () => {
      // Arrange - Create a recent source (within 30 day TTL for dev.bg)
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5); // 5 days ago (within 30 day TTL)
      
      const recentSource = {
        id: 'source-1',
        companyId,
        sourceSite,
        sourceUrl,
        lastScrapedAt: recentDate,
        isValid: true,
        contentHash: 'recent-hash',
        scrapedContent: 'recent content',
        createdAt: recentDate,
        updatedAt: recentDate,
      };

      prismaService.companySource.findUnique.mockResolvedValue(recentSource);

      // Act
      const result = await service.shouldScrapeCompanySource(companyId, sourceSite, sourceUrl);

      // Assert
      expect(result.shouldScrape).toBe(false);
      expect(result.reason).toContain('Within TTL');
    });

    it('should return true when existing source is marked as invalid', async () => {
      // Arrange - Create an invalid source
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 2);
      
      const invalidSource = {
        id: 'source-1',
        companyId,
        sourceSite,
        sourceUrl,
        lastScrapedAt: recentDate,
        isValid: false,
        contentHash: 'invalid-hash',
        scrapedContent: 'invalid content',
        createdAt: recentDate,
        updatedAt: recentDate,
      };

      prismaService.companySource.findUnique.mockResolvedValue(invalidSource);

      // Act
      const result = await service.shouldScrapeCompanySource(companyId, sourceSite, sourceUrl);

      // Assert
      expect(result.shouldScrape).toBe(true);
      expect(result.reason).toBe('Source was marked as invalid');
    });

    it('should handle URL change detection', async () => {
      // Arrange - Create a source with different URL
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 2);
      
      const sourceWithDifferentUrl = {
        id: 'source-1',
        companyId,
        sourceSite,
        sourceUrl: 'https://dev.bg/company/different-company/', // Different URL
        lastScrapedAt: recentDate,
        isValid: true,
        contentHash: 'hash',
        scrapedContent: 'content',
        createdAt: recentDate,
        updatedAt: recentDate,
      };

      prismaService.companySource.findUnique.mockResolvedValue(sourceWithDifferentUrl);

      // Act
      const result = await service.shouldScrapeCompanySource(companyId, sourceSite, sourceUrl);

      // Assert
      expect(result.shouldScrape).toBe(true);
      expect(result.reason).toBe('Source URL has changed');
      expect(result.existingSource).toEqual(sourceWithDifferentUrl);
    });
  });

  describe('saveCompanySource', () => {
    const companyId = 'company-123';
    const sourceSite = 'dev.bg';
    const sourceUrl = 'https://dev.bg/company/example/';
    const scrapedContent = '<html>Company profile content</html>';

    it('should create new source when none exists', async () => {
      // Arrange
      const expectedHash = createHash('sha256').update(scrapedContent).digest('hex');
      const createdSource = {
        id: 'source-1',
        companyId,
        sourceSite,
        sourceUrl,
        lastScrapedAt: expect.any(Date),
        isValid: true,
        contentHash: expectedHash,
        scrapedContent,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      };

      prismaService.companySource.upsert.mockResolvedValue(createdSource);

      // Act
      const result = await service.saveCompanySource({
        companyId,
        sourceSite,
        sourceUrl,
        scrapedContent,
        isValid: true,
      });

      // Assert
      expect(result).toEqual(createdSource);
      expect(prismaService.companySource.upsert).toHaveBeenCalledWith({
        where: {
          companyId_sourceSite: {
            companyId,
            sourceSite,
          },
        },
        create: {
          companyId,
          sourceSite,
          sourceUrl,
          scrapedContent,
          contentHash: expectedHash,
          isValid: true,
        },
        update: {
          sourceUrl,
          lastScrapedAt: expect.any(Date),
          scrapedContent,
          contentHash: expectedHash,
          isValid: true,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should update existing source with new content', async () => {
      // Arrange
      const newContent = '<html>Updated company profile content</html>';
      const expectedHash = createHash('sha256').update(newContent).digest('hex');
      const updatedSource = {
        id: 'source-1',
        companyId,
        sourceSite,
        sourceUrl,
        lastScrapedAt: expect.any(Date),
        isValid: true,
        contentHash: expectedHash,
        scrapedContent: newContent,
        createdAt: new Date('2024-01-01'),
        updatedAt: expect.any(Date),
      };

      prismaService.companySource.upsert.mockResolvedValue(updatedSource);

      // Act
      const result = await service.saveCompanySource({
        companyId,
        sourceSite,
        sourceUrl,
        scrapedContent: newContent,
        isValid: true,
      });

      // Assert
      expect(result).toEqual(updatedSource);
      expect(prismaService.companySource.upsert).toHaveBeenCalledWith({
        where: {
          companyId_sourceSite: {
            companyId,
            sourceSite,
          },
        },
        create: {
          companyId,
          sourceSite,
          sourceUrl,
          scrapedContent: newContent,
          contentHash: expectedHash,
          isValid: true,
        },
        update: {
          sourceUrl,
          lastScrapedAt: expect.any(Date),
          scrapedContent: newContent,
          contentHash: expectedHash,
          isValid: true,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should save invalid source when scraping fails', async () => {
      // Arrange
      const invalidSource = {
        id: 'source-1',
        companyId,
        sourceSite,
        sourceUrl,
        lastScrapedAt: expect.any(Date),
        isValid: false,
        contentHash: undefined,
        scrapedContent: undefined,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      };

      prismaService.companySource.upsert.mockResolvedValue(invalidSource);

      // Act
      const result = await service.saveCompanySource({
        companyId,
        sourceSite,
        sourceUrl,
        scrapedContent: undefined,
        isValid: false,
      });

      // Assert
      expect(result).toEqual(invalidSource);
      expect(prismaService.companySource.upsert).toHaveBeenCalledWith({
        where: {
          companyId_sourceSite: {
            companyId,
            sourceSite,
          },
        },
        create: {
          companyId,
          sourceSite,
          sourceUrl,
          scrapedContent: undefined,
          contentHash: undefined,
          isValid: false,
        },
        update: {
          sourceUrl,
          lastScrapedAt: expect.any(Date),
          scrapedContent: undefined,
          contentHash: undefined,
          isValid: false,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should generate consistent content hash for same content', async () => {
      // Arrange
      const content1 = '<html>Same content</html>';
      const content2 = '<html>Same content</html>';
      const expectedHash = createHash('sha256').update(content1).digest('hex');

      // Act & Assert - Both calls should generate same hash
      await service.saveCompanySource({
        companyId,
        sourceSite,
        sourceUrl,
        scrapedContent: content1,
        isValid: true,
      });

      await service.saveCompanySource({
        companyId,
        sourceSite,
        sourceUrl,
        scrapedContent: content2,
        isValid: true,
      });

      expect(prismaService.companySource.upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
        create: expect.objectContaining({ contentHash: expectedHash }),
        update: expect.objectContaining({ contentHash: expectedHash }),
      }));

      expect(prismaService.companySource.upsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
        create: expect.objectContaining({ contentHash: expectedHash }),
        update: expect.objectContaining({ contentHash: expectedHash }),
      }));
    });
  });

  describe('markSourceAsInvalid', () => {
    const companyId = 'company-123';
    const sourceSite = 'dev.bg';

    it('should mark existing source as invalid', async () => {
      // Arrange
      const updateResult = { count: 1 };
      prismaService.companySource.updateMany.mockResolvedValue(updateResult);

      // Act
      const result = await service.markSourceAsInvalid(companyId, sourceSite);

      // Assert
      expect(result).toBeUndefined(); // Method returns void
      expect(prismaService.companySource.updateMany).toHaveBeenCalledWith({
        where: {
          companyId,
          sourceSite,
        },
        data: {
          isValid: false,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should handle case when source does not exist', async () => {
      // Arrange
      const updateResult = { count: 0 };
      prismaService.companySource.updateMany.mockResolvedValue(updateResult);

      // Act
      const result = await service.markSourceAsInvalid(companyId, sourceSite);

      // Assert
      expect(result).toBeUndefined(); // Method returns void even if no records updated
      expect(prismaService.companySource.updateMany).toHaveBeenCalledWith({
        where: {
          companyId,
          sourceSite,
        },
        data: {
          isValid: false,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      prismaService.companySource.updateMany.mockRejectedValue(error);

      // Act
      const result = await service.markSourceAsInvalid(companyId, sourceSite);

      // Assert - Method catches errors and doesn't throw
      expect(result).toBeUndefined();
    });
  });

  describe('getCompanySources', () => {
    const companyId = 'company-123';

    it('should return all sources for a company', async () => {
      // Arrange
      const companySources = [
        {
          id: 'source-1',
          companyId,
          sourceSite: 'dev.bg',
          sourceUrl: 'https://dev.bg/company/example/',
          lastScrapedAt: new Date('2024-01-15'),
          isValid: true,
          contentHash: 'hash-123',
          scrapedContent: 'content 1',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date(),
        },
        {
          id: 'source-2',
          companyId,
          sourceSite: 'company_website',
          sourceUrl: 'https://example-company.com',
          lastScrapedAt: new Date('2024-01-10'),
          isValid: true,
          contentHash: 'hash-456',
          scrapedContent: 'content 2',
          createdAt: new Date('2024-01-05'),
          updatedAt: new Date(),
        },
      ];

      prismaService.companySource.findMany.mockResolvedValue(companySources);

      // Act
      const result = await service.getCompanySources(companyId);

      // Assert
      expect(result).toEqual(companySources);
      expect(prismaService.companySource.findMany).toHaveBeenCalledWith({
        where: { companyId },
        orderBy: { lastScrapedAt: 'desc' },
      });
    });

    it('should return empty array when no sources exist', async () => {
      // Arrange
      prismaService.companySource.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getCompanySources(companyId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('TTL calculation for different source types', () => {
    it('should use correct TTL for dev.bg sources (30 days)', async () => {
      // Arrange - Create source that's 25 days old (within 30 day TTL)
      const sourceDateWithinTTL = new Date();
      sourceDateWithinTTL.setDate(sourceDateWithinTTL.getDate() - 25); 
      
      const devBgSource = {
        id: 'source-1',
        companyId: 'test',
        sourceSite: 'dev.bg',
        sourceUrl: 'https://dev.bg/company/test/',
        lastScrapedAt: sourceDateWithinTTL,
        isValid: true,
        contentHash: 'hash',
        scrapedContent: 'content',
        createdAt: sourceDateWithinTTL,
        updatedAt: sourceDateWithinTTL,
      };

      prismaService.companySource.findUnique.mockResolvedValue(devBgSource);

      // Act
      const result = await service.shouldScrapeCompanySource('test', 'dev.bg', 'https://dev.bg/company/test/');

      // Assert
      expect(result.shouldScrape).toBe(false);
      expect(result.reason).toContain('Within TTL');
    });

    it('should use correct TTL for company_website sources (7 days)', async () => {
      // Arrange - Create source that's 5 days old (within 7 day TTL)
      const sourceDateWithinTTL = new Date();
      sourceDateWithinTTL.setDate(sourceDateWithinTTL.getDate() - 5);
      
      const websiteSource = {
        id: 'source-1',
        companyId: 'test',
        sourceSite: 'company_website',
        sourceUrl: 'https://test-company.com',
        lastScrapedAt: sourceDateWithinTTL,
        isValid: true,
        contentHash: 'hash',
        scrapedContent: 'content',
        createdAt: sourceDateWithinTTL,
        updatedAt: sourceDateWithinTTL,
      };

      prismaService.companySource.findUnique.mockResolvedValue(websiteSource);

      // Act
      const result = await service.shouldScrapeCompanySource('test', 'company_website', 'https://test-company.com');

      // Assert
      expect(result.shouldScrape).toBe(false);
      expect(result.reason).toContain('Within TTL');
    });

    it('should use default TTL for unknown source types (14 days)', async () => {
      // Arrange - Create source that's 10 days old (within 14 day default TTL)
      const sourceDateWithinTTL = new Date();
      sourceDateWithinTTL.setDate(sourceDateWithinTTL.getDate() - 10);
      
      const unknownSource = {
        id: 'source-1',
        companyId: 'test',
        sourceSite: 'unknown_source',
        sourceUrl: 'https://unknown-source.com',
        lastScrapedAt: sourceDateWithinTTL,
        isValid: true,
        contentHash: 'hash',
        scrapedContent: 'content',
        createdAt: sourceDateWithinTTL,
        updatedAt: sourceDateWithinTTL,
      };

      prismaService.companySource.findUnique.mockResolvedValue(unknownSource);

      // Act
      const result = await service.shouldScrapeCompanySource('test', 'unknown_source', 'https://unknown-source.com');

      // Assert
      expect(result.shouldScrape).toBe(false);
      expect(result.reason).toContain('Within TTL');
    });
  });
});