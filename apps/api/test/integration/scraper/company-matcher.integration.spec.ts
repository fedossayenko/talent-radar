import { Test, TestingModule } from '@nestjs/testing';
import { CompanyMatcherService } from '../../../src/modules/scraper/services/company-matcher.service';
import { PrismaService } from '../../../src/common/database/prisma.service';

describe('CompanyMatcherService Integration', () => {
  let module: TestingModule;
  let companyMatcher: CompanyMatcherService;
  let prismaService: PrismaService;

  const mockCompanyData1 = {
    name: 'UKG (Ultimate Kronos Group)',
    website: 'https://www.ukg.com',
    location: 'София, България',
    industry: 'HR Technology',
    description: 'Global leader in HR technology solutions',
  };

  const mockCompanyData2 = {
    name: 'UKG',
    website: 'https://ukg.com',
    location: 'София',
    industry: 'HR Technology',
  };

  const mockCompanyData3 = {
    name: 'Ultimate Kronos Group',
    website: 'https://www.ukg.com',
    location: 'София, България',
    industry: 'Human Resources',
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mockCompanyData4 = {
    name: 'SoftUni',
    website: 'https://softuni.bg',
    location: 'София',
    industry: 'Education',
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        CompanyMatcherService,
        {
          provide: PrismaService,
          useValue: {
            company: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    companyMatcher = module.get<CompanyMatcherService>(CompanyMatcherService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Exact match detection', () => {
    it('should find exact match by website domain', async () => {
      (prismaService.company.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'company-1',
        name: 'UKG (Ultimate Kronos Group)',
        website: 'https://www.ukg.com',
      });

      const result = await companyMatcher.findOrCreateCompany(mockCompanyData1);

      expect(result).toEqual({
        id: 'company-1',
        isNew: false,
      });

      expect(prismaService.company.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { website: { contains: 'ukg.com', mode: 'insensitive' } },
            { originalWebsite: { contains: 'ukg.com', mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
    });

    it('should find exact match by company name', async () => {
      // First call for website check returns null
      (prismaService.company.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        // Second call for exact name match returns result
        .mockResolvedValueOnce({
          id: 'company-2',
          name: 'UKG (Ultimate Kronos Group)',
        });

      const result = await companyMatcher.findOrCreateCompany(mockCompanyData1);

      expect(result).toEqual({
        id: 'company-2',
        isNew: false,
      });
    });

    it.skip('should find exact match in company aliases', async () => {
      // TODO: This test is skipped because company aliases functionality is not yet implemented
      // The exact match logic for aliases is commented out in the service
      (prismaService.company.findFirst as jest.Mock)
        .mockResolvedValueOnce(null) // website check
        .mockResolvedValueOnce(null) // name check
        .mockResolvedValueOnce({     // alias check
          id: 'company-3',
          name: 'Ultimate Kronos Group',
          companyAliases: ['UKG', 'UKG (Ultimate Kronos Group)'],
        });

      const result = await companyMatcher.findOrCreateCompany(mockCompanyData2);

      expect(result).toEqual({
        id: 'company-3',
        isNew: false,
      });
    });
  });

  describe('Fuzzy matching and company creation', () => {
    it('should create new company when no matches found', async () => {
      // All exact match checks return null
      (prismaService.company.findFirst as jest.Mock).mockReset();
      (prismaService.company.findMany as jest.Mock).mockReset();
      (prismaService.company.create as jest.Mock).mockReset();
      
      (prismaService.company.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.company.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.company.create as jest.Mock).mockResolvedValue({
        id: 'company-new',
        name: 'New Company Ltd',
      });

      const result = await companyMatcher.findOrCreateCompany({
        name: 'New Company Ltd',
        website: 'https://newcompany.com',
        location: 'София',
        industry: 'Software',
      });

      expect(result).toEqual({
        id: 'company-new',
        isNew: true,
      });

      expect(prismaService.company.create).toHaveBeenCalledWith({
        data: {
          name: 'New Company Ltd',
          website: 'https://newcompany.com',
          location: 'София',
          industry: 'Software',
          description: undefined,
        },
      });
    });

    it('should merge with similar company when similarity is high', async () => {
      // Mock exact match checks returning null
      (prismaService.company.findFirst as jest.Mock).mockResolvedValue(null);

      // Mock candidate companies for similarity check
      const existingCompanies = [
        {
          id: 'company-similar',
          name: 'UKG',
          website: 'https://www.ukg.com',
          location: 'София',
          industry: 'HR Technology',
          companyAliases: ['Ultimate Kronos Group'],
          originalWebsite: null,
        },
      ];
      (prismaService.company.findMany as jest.Mock).mockResolvedValue(existingCompanies);

      // Mock the update for merging
      (prismaService.company.findUnique as jest.Mock).mockResolvedValue(existingCompanies[0]);
      (prismaService.company.update as jest.Mock).mockResolvedValue({});

      const result = await companyMatcher.findOrCreateCompany(mockCompanyData1);

      expect(result).toEqual({
        id: 'company-similar',
        isNew: false,
      });

      expect(prismaService.company.update).toHaveBeenCalledWith({
        where: { id: 'company-similar' },
        data: expect.objectContaining({
          description: 'Global leader in HR technology solutions',
          updatedAt: expect.any(Date),
        }),
      });
    });

    it('should not merge when similarity is below threshold', async () => {
      (prismaService.company.findFirst as jest.Mock).mockResolvedValue(null);

      // Mock dissimilar company
      const existingCompanies = [
        {
          id: 'company-different',
          name: 'Completely Different Company',
          website: 'https://different.com',
          location: 'Пловдив',
          industry: 'Manufacturing',
          companyAliases: [],
        },
      ];
      (prismaService.company.findMany as jest.Mock).mockResolvedValue(existingCompanies);
      (prismaService.company.create as jest.Mock).mockResolvedValue({
        id: 'company-new',
        name: 'UKG (Ultimate Kronos Group)',
      });

      const result = await companyMatcher.findOrCreateCompany(mockCompanyData1);

      expect(result).toEqual({
        id: 'company-new',
        isNew: true,
      });

      // Should create new company instead of merging
      expect(prismaService.company.create).toHaveBeenCalled();
      expect(prismaService.company.update).not.toHaveBeenCalled();
    });
  });

  describe('Similarity calculation', () => {
    it('should find high similarity for same company with variations', async () => {
      (prismaService.company.findFirst as jest.Mock).mockResolvedValue(null);

      const existingCompanies = [
        {
          id: 'company-1',
          name: 'UKG',
          website: 'https://ukg.com',
          location: 'София',
          industry: 'HR Technology',
          companyAliases: ['Ultimate Kronos Group'],
        },
      ];
      (prismaService.company.findMany as jest.Mock).mockResolvedValue(existingCompanies);
      (prismaService.company.findUnique as jest.Mock).mockResolvedValue(existingCompanies[0]);
      (prismaService.company.update as jest.Mock).mockResolvedValue({});

      const similarities = await companyMatcher.findSimilarCompanies(mockCompanyData3);

      expect(similarities).toHaveLength(1);
      expect(similarities[0]).toMatchObject({
        existingId: 'company-1',
        shouldMerge: true,
        matchScore: expect.any(Number),
        matchReasons: expect.any(Array),
      });
      expect(similarities[0].matchScore).toBeGreaterThan(0.8);
    });

    it('should prioritize website domain matches', async () => {
      (prismaService.company.findFirst as jest.Mock).mockResolvedValue(null);

      const existingCompanies = [
        {
          id: 'company-1',
          name: 'Different Company Name',
          website: 'https://www.ukg.com', // Same domain
          location: 'Different Location',
          industry: 'Different Industry',
          companyAliases: [],
        },
        {
          id: 'company-2',
          name: 'UKG (Ultimate Kronos Group)', // Same name
          website: 'https://different-website.com',
          location: 'София, България',
          industry: 'HR Technology',
          companyAliases: [],
        },
      ];
      (prismaService.company.findMany as jest.Mock).mockResolvedValue(existingCompanies);

      const similarities = await companyMatcher.findSimilarCompanies(mockCompanyData1);

      expect(similarities).toHaveLength(2);
      
      // Website match should have higher score than name match
      const websiteMatch = similarities.find(s => s.existingId === 'company-1');
      const nameMatch = similarities.find(s => s.existingId === 'company-2');
      
      expect(websiteMatch?.matchScore).toBeGreaterThan(nameMatch?.matchScore || 0);
    });

    it('should handle companies without websites gracefully', async () => {
      (prismaService.company.findFirst as jest.Mock).mockResolvedValue(null);

      const existingCompanies = [
        {
          id: 'company-1',
          name: 'Software University',
          website: null,
          location: 'София',
          industry: 'Education',
          companyAliases: [],
        },
      ];
      (prismaService.company.findMany as jest.Mock).mockResolvedValue(existingCompanies);

      const similarities = await companyMatcher.findSimilarCompanies({
        name: 'Software University Ltd',
        location: 'София',
        industry: 'Education',
      });

      expect(similarities).toHaveLength(1);
      expect(similarities[0].matchScore).toBeGreaterThan(0.6);
    });
  });

  describe('Company normalization', () => {
    it('should normalize company names by removing suffixes and common words', async () => {
      (prismaService.company.findFirst as jest.Mock).mockResolvedValue(null);

      const existingCompanies = [
        {
          id: 'company-1',
          name: 'TechCompany Ltd',
          website: null,
          location: 'София',
          industry: 'Software',
          companyAliases: [],
        },
      ];
      (prismaService.company.findMany as jest.Mock).mockResolvedValue(existingCompanies);

      const similarities = await companyMatcher.findSimilarCompanies({
        name: 'TechCompany Limited',
        location: 'София',
        industry: 'Software Development',
      });

      expect(similarities).toHaveLength(1);
      expect(similarities[0].matchScore).toBeGreaterThan(0.6);
    });

    it('should extract and compare website domains correctly', async () => {
      (prismaService.company.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'company-1',
        name: 'Example Company',
      });

      const result = await companyMatcher.findOrCreateCompany({
        name: 'Example Company',
        website: 'https://www.example.com/careers', // Should extract example.com
      });

      expect(result.isNew).toBe(false);
      
      // Verify the website domain extraction worked in the query
      expect(prismaService.company.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { website: { contains: 'example.com', mode: 'insensitive' } },
            { originalWebsite: { contains: 'example.com', mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully during company creation', async () => {
      (prismaService.company.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.company.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.company.create as jest.Mock).mockRejectedValue(new Error('Database constraint violation'));

      await expect(companyMatcher.findOrCreateCompany(mockCompanyData1))
        .rejects.toThrow('Database constraint violation');
    });

    it('should handle database errors during similarity search', async () => {
      (prismaService.company.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.company.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const similarities = await companyMatcher.findSimilarCompanies(mockCompanyData1);

      expect(similarities).toEqual([]);
    });
  });
});