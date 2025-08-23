import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CompanyService } from './company.service';
import { PrismaService } from '../../common/database/prisma.service';
import { MockDataFactory } from '../../../test/test-utils/mock-data.factory';
import { createMockPrismaService } from '../../../test/test-utils/prisma-mock.helper';

describe('CompanyService', () => {
  let service: CompanyService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockPrismaService = createMockPrismaService();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CompanyService>(CompanyService);
    prismaService = module.get<jest.Mocked<PrismaService>>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated companies with default parameters', async () => {
      // Arrange
      const mockCompanies = [
        MockDataFactory.createCompanyData({ id: '1', name: 'Tech Corp' }),
        MockDataFactory.createCompanyData({ id: '2', name: 'Software Inc' }),
      ];
      const totalCount = 2;

      prismaService.company.count.mockResolvedValue(totalCount);
      prismaService.company.findMany.mockResolvedValue(mockCompanies);

      // Act
      const result = await service.findAll({});

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        mockCompanies.map(company => ({
          ...company,
          analyses: undefined,
          analysisScore: null,
          hasAnalysis: false,
          analysisAge: null,
          recommendation: null,
          scores: null,
        }))
      );
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: totalCount,
        pages: Math.ceil(totalCount / 20),
      });

      expect(prismaService.company.count).toHaveBeenCalledWith({ where: {} });
      expect(prismaService.company.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          analyses: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              recommendationScore: true,
              cultureScore: true,
              workLifeBalance: true,
              careerGrowth: true,
              techCulture: true,
              confidenceScore: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              vacancies: {
                where: { status: 'active' },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
        skip: 0,
        take: 20,
      });
    });

    it('should filter companies by search term', async () => {
      // Arrange
      const query = { search: 'tech' };
      const mockCompanies = [MockDataFactory.createCompanyData({ name: 'Tech Corp' })];

      prismaService.company.count.mockResolvedValue(1);
      prismaService.company.findMany.mockResolvedValue(mockCompanies);

      // Act
      await service.findAll(query);

      // Assert
      expect(prismaService.company.count).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'tech', mode: 'insensitive' } },
            { description: { contains: 'tech', mode: 'insensitive' } },
          ],
        },
      });
    });

    it('should filter companies by industry and size', async () => {
      // Arrange
      const query = { industry: 'Technology', size: '100-500' };
      const mockCompanies = [MockDataFactory.createCompanyData()];

      prismaService.company.count.mockResolvedValue(1);
      prismaService.company.findMany.mockResolvedValue(mockCompanies);

      // Act
      await service.findAll(query);

      // Assert
      expect(prismaService.company.count).toHaveBeenCalledWith({
        where: {
          industry: { contains: 'Technology', mode: 'insensitive' },
          size: '100-500',
        },
      });
    });

    it('should handle pagination correctly', async () => {
      // Arrange
      const query = { page: 2, limit: 10 };
      const mockCompanies = [MockDataFactory.createCompanyData()];

      prismaService.company.count.mockResolvedValue(25);
      prismaService.company.findMany.mockResolvedValue(mockCompanies);

      // Act
      const result = await service.findAll(query);

      // Assert
      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        pages: 3,
      });

      expect(prismaService.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // (page - 1) * limit
          take: 10,
        })
      );
    });
  });

  describe('findOne', () => {
    it('should return a company by ID', async () => {
      // Arrange
      const companyId = '123';
      const mockCompany = MockDataFactory.createCompanyData({ id: companyId });

      prismaService.company.findUnique.mockResolvedValue(mockCompany);

      // Act
      const result = await service.findOne(companyId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        ...mockCompany,
        latestAnalysis: null,
        activeVacanciesCount: 0,
        hasAnalysis: false,
        vacancies: undefined,
        salaryRange: null,
        contactInfo: null,
        companyDetails: null,
        analyses: undefined,
        _count: undefined,
      });
      expect(prismaService.company.findUnique).toHaveBeenCalledWith({
        where: { id: companyId },
        include: {
          analyses: {
            orderBy: { createdAt: 'desc' },
          },
          sources: {
            select: {
              id: true,
              sourceSite: true,
              sourceUrl: true,
              isValid: true,
              lastScrapedAt: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          vacancies: {
            where: { status: 'active' },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
              id: true,
              title: true,
              experienceLevel: true,
              employmentType: true,
              location: true,
              salaryMin: true,
              salaryMax: true,
              currency: true,
              benefits: true,
              requirements: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              vacancies: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException when company does not exist', async () => {
      // Arrange
      const companyId = 'non-existent';
      prismaService.company.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(companyId)).rejects.toThrow(
        new NotFoundException(`Company with ID ${companyId} not found`)
      );
    });
  });

  describe('update', () => {
    it('should update a company successfully', async () => {
      // Arrange
      const companyId = '123';
      const updateData = { name: 'Updated Company Name' };
      const mockUpdatedCompany = MockDataFactory.createCompanyData({
        id: companyId,
        ...updateData,
      });

      prismaService.company.update.mockResolvedValue(mockUpdatedCompany);

      // Act
      const result = await service.update(companyId, updateData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpdatedCompany);
      expect(result.message).toBe('Company updated successfully');

      expect(prismaService.company.update).toHaveBeenCalledWith({
        where: { id: companyId },
        data: {
          ...updateData,
          updatedAt: expect.any(Date),
        },
        include: {
          analyses: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
    });

    it('should throw NotFoundException when updating non-existent company', async () => {
      // Arrange
      const companyId = 'non-existent';
      const updateData = { name: 'Updated Name' };
      const error = { code: 'P2025' }; // Prisma "Record to update not found" error

      prismaService.company.update.mockRejectedValue(error);

      // Act & Assert
      await expect(service.update(companyId, updateData)).rejects.toThrow(
        new NotFoundException(`Company with ID ${companyId} not found`)
      );
    });
  });

  describe('analyzeCompany', () => {
    it('should return existing analysis when recent and not forced', async () => {
      // Arrange
      const companyId = '123';
      const recentAnalysis = {
        id: 'analysis-1',
        companyId,
        createdAt: new Date(), // Recent
        cultureScore: 8.5,
      };
      const mockCompany = {
        id: companyId,
        analyses: [recentAnalysis],
        vacancies: [],
      };

      prismaService.company.findUnique.mockResolvedValue(mockCompany);

      // Act
      const result = await service.analyzeCompany(companyId, false);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(recentAnalysis);
      expect(result.message).toBe('Using existing recent analysis');
      expect(prismaService.companyAnalysis.create).not.toHaveBeenCalled();
    });

    it('should create new analysis when forced refresh', async () => {
      // Arrange
      const companyId = '123';
      const recentAnalysis = {
        id: 'analysis-1',
        companyId,
        createdAt: new Date(),
        cultureScore: 8.5,
      };
      const mockCompany = {
        id: companyId,
        analyses: [recentAnalysis],
        vacancies: [],
      };
      const newAnalysis = MockDataFactory.createCompanyAnalysisData(companyId);

      prismaService.company.findUnique.mockResolvedValue(mockCompany);
      prismaService.companyAnalysis.create.mockResolvedValue(newAnalysis);

      // Act
      const result = await service.analyzeCompany(companyId, true);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(newAnalysis);
      expect(result.message).toBe('Company analysis completed');
      expect(prismaService.companyAnalysis.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId,
          analysisSource: 'ai_generated',
          confidenceScore: 0.8,
        }),
      });
    });

    it('should throw NotFoundException when company does not exist', async () => {
      // Arrange
      const companyId = 'non-existent';
      prismaService.company.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.analyzeCompany(companyId)).rejects.toThrow(
        new NotFoundException(`Company with ID ${companyId} not found`)
      );
    });
  });

  describe('createOrUpdateAnalysis', () => {
    it('should create new company analysis successfully', async () => {
      // Arrange
      const companyId = '123';
      const analysisData = {
        analysisSource: 'ai_generated' as const,
        confidenceScore: 0.85,
        dataCompleteness: 0.9,
        name: 'Tech Corp',
        industry: 'Technology',
        location: 'Sofia, Bulgaria',
        size: '100-500',
        description: 'Leading technology company',
        technologies: ['JavaScript', 'TypeScript', 'React'],
        pros: ['Great work-life balance', 'Modern tech stack'],
        cons: ['Remote work limited'],
        cultureScore: 8.5,
        workLifeBalance: 9.0,
        careerGrowth: 7.5,
        compensation: 8.0,
        techCulture: 9.5,
        workEnvironment: 8.0,
      };

      const mockAnalysis = MockDataFactory.createCompanyAnalysisData(companyId, analysisData);
      prismaService.companyAnalysis.create.mockResolvedValue(mockAnalysis);

      // Act
      const result = await service.createOrUpdateAnalysis({
        companyId,
        ...analysisData,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAnalysis);
      expect(result.message).toBe('Company analysis created successfully');

      expect(prismaService.companyAnalysis.create).toHaveBeenCalledWith({
        data: {
          companyId,
          analysisSource: analysisData.analysisSource,
          confidenceScore: analysisData.confidenceScore,
          dataCompleteness: analysisData.dataCompleteness,
          name: analysisData.name,
          industry: analysisData.industry,
          location: analysisData.location,
          size: analysisData.size,
          description: analysisData.description,
          pros: analysisData.pros,
          cons: analysisData.cons,
          cultureScore: analysisData.cultureScore,
          workLifeBalance: analysisData.workLifeBalance,
          careerGrowth: analysisData.careerGrowth,
          compensation: analysisData.compensation,
          techCulture: analysisData.techCulture,
          workEnvironment: analysisData.workEnvironment,
          techStack: JSON.stringify(analysisData.technologies),
          createdAt: expect.any(Date),
        },
      });
    });

    it('should handle analysis creation with minimal required fields', async () => {
      // Arrange
      const companyId = '123';
      const minimalAnalysisData = {
        analysisSource: 'manual' as const,
        confidenceScore: 0.7,
        dataCompleteness: 0.5,
      };

      const mockAnalysis = MockDataFactory.createCompanyAnalysisData(companyId, minimalAnalysisData);
      prismaService.companyAnalysis.create.mockResolvedValue(mockAnalysis);

      // Act
      const result = await service.createOrUpdateAnalysis({
        companyId,
        ...minimalAnalysisData,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAnalysis);
      expect(prismaService.companyAnalysis.create).toHaveBeenCalledWith({
        data: {
          companyId,
          ...minimalAnalysisData,
          createdAt: expect.any(Date),
        },
      });
    });

    it('should handle database errors during analysis creation', async () => {
      // Arrange
      const companyId = '123';
      const analysisData = {
        analysisSource: 'ai_generated' as const,
        confidenceScore: 0.85,
        dataCompleteness: 0.9,
      };

      const error = new Error('Database connection failed');
      prismaService.companyAnalysis.create.mockRejectedValue(error);

      // Act & Assert
      await expect(service.createOrUpdateAnalysis({
        companyId,
        ...analysisData,
      })).rejects.toThrow(error);
    });

    it('should create analysis with all optional fields populated', async () => {
      // Arrange
      const companyId = '123';
      const completeAnalysisData = {
        analysisSource: 'scraped_profile' as const,
        confidenceScore: 0.95,
        dataCompleteness: 1.0,
        name: 'Complete Tech Corp',
        industry: 'Software Development',
        location: 'Sofia, Bulgaria',
        size: '500+',
        description: 'Comprehensive technology solutions provider',
        technologies: ['JavaScript', 'Python', 'AWS', 'Docker', 'Kubernetes'],
        benefits: ['Health insurance', 'Flexible hours', 'Remote work'],
        pros: ['Excellent benefits', 'Modern technology stack', 'Great team culture'],
        cons: ['Fast-paced environment', 'High expectations'],
        cultureScore: 9.2,
        workLifeBalance: 8.8,
        careerGrowth: 8.5,
        compensation: 9.0,
        techCulture: 9.8,
        workEnvironment: 8.7,
      };

      const mockAnalysis = MockDataFactory.createCompanyAnalysisData(companyId, completeAnalysisData);
      prismaService.companyAnalysis.create.mockResolvedValue(mockAnalysis);

      // Act
      const result = await service.createOrUpdateAnalysis({
        companyId,
        ...completeAnalysisData,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAnalysis);
      expect(prismaService.companyAnalysis.create).toHaveBeenCalledWith({
        data: {
          companyId,
          analysisSource: completeAnalysisData.analysisSource,
          confidenceScore: completeAnalysisData.confidenceScore,
          dataCompleteness: completeAnalysisData.dataCompleteness,
          name: completeAnalysisData.name,
          industry: completeAnalysisData.industry,
          location: completeAnalysisData.location,
          size: completeAnalysisData.size,
          description: completeAnalysisData.description,
          benefits: completeAnalysisData.benefits,
          pros: completeAnalysisData.pros,
          cons: completeAnalysisData.cons,
          cultureScore: completeAnalysisData.cultureScore,
          workLifeBalance: completeAnalysisData.workLifeBalance,
          careerGrowth: completeAnalysisData.careerGrowth,
          compensation: completeAnalysisData.compensation,
          techCulture: completeAnalysisData.techCulture,
          workEnvironment: completeAnalysisData.workEnvironment,
          techStack: JSON.stringify(completeAnalysisData.technologies),
          createdAt: expect.any(Date),
        },
      });
    });

    it('should validate analysis source enum values', async () => {
      // Arrange
      const companyId = '123';
      const validSources = ['ai_generated', 'scraped_profile', 'manual', 'scraped_website'];

      for (const source of validSources) {
        const analysisData = {
          analysisSource: source as any,
          confidenceScore: 0.8,
          dataCompleteness: 0.8,
        };

        const mockAnalysis = MockDataFactory.createCompanyAnalysisData(companyId, analysisData);
        prismaService.companyAnalysis.create.mockResolvedValue(mockAnalysis);

        // Act
        const result = await service.createOrUpdateAnalysis({
          companyId,
          ...analysisData,
        });

        // Assert
        expect(result.success).toBe(true);
        expect(result.data.analysisSource).toBe(source);
      }

      // Verify all valid sources were tested
      expect(prismaService.companyAnalysis.create).toHaveBeenCalledTimes(validSources.length);
    });
  });
});