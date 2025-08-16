import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CompanyService } from './company.service';
import { PrismaService } from '../../common/database/prisma.service';
import { MockDataFactory } from '../../../test/test-utils/mock-data.factory';

describe('CompanyService', () => {
  let service: CompanyService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockPrismaService = {
    company: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    companyAnalysis: {
      create: jest.fn(),
    },
  };

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
    prismaService = module.get(PrismaService);
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
      expect(result.data).toEqual(mockCompanies);
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
      expect(result.data).toEqual(mockCompany);
      expect(prismaService.company.findUnique).toHaveBeenCalledWith({
        where: { id: companyId },
        include: {
          analyses: {
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
});