import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { VacancyService } from './vacancy.service';
import { PrismaService } from '../../common/database/prisma.service';
import { MockDataFactory } from '../../../test/test-utils/mock-data.factory';

describe('VacancyService', () => {
  let service: VacancyService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockPrismaService = {
    vacancy: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    vacancyScore: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VacancyService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<VacancyService>(VacancyService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated vacancies with default parameters', async () => {
      // Arrange
      const mockVacancies = [
        MockDataFactory.createVacancyData('company-1', { id: '1', title: 'Frontend Developer' }),
        MockDataFactory.createVacancyData('company-2', { id: '2', title: 'Backend Engineer' }),
      ];
      const totalCount = 2;

      prismaService.vacancy.count.mockResolvedValue(totalCount);
      prismaService.vacancy.findMany.mockResolvedValue(mockVacancies);

      // Act
      const result = await service.findAll({});

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockVacancies);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: totalCount,
        pages: Math.ceil(totalCount / 20),
      });

      expect(prismaService.vacancy.count).toHaveBeenCalledWith({ 
        where: { status: 'active' } 
      });
      expect(prismaService.vacancy.findMany).toHaveBeenCalledWith({
        where: { status: 'active' },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              logo: true,
              size: true,
              industry: true,
            },
          },
          scores: {
            orderBy: { scoredAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should filter vacancies by search term', async () => {
      // Arrange
      const query = { search: 'react' };
      const mockVacancies = [MockDataFactory.createVacancyData('company-1', { title: 'React Developer' })];

      prismaService.vacancy.count.mockResolvedValue(1);
      prismaService.vacancy.findMany.mockResolvedValue(mockVacancies);

      // Act
      await service.findAll(query);

      // Assert
      expect(prismaService.vacancy.count).toHaveBeenCalledWith({
        where: {
          status: 'active',
          OR: [
            { title: { contains: 'react', mode: 'insensitive' } },
            { description: { contains: 'react', mode: 'insensitive' } },
          ],
        },
      });
    });

    it('should filter vacancies by location and experience level', async () => {
      // Arrange
      const query = { location: 'Remote', experienceLevel: 'senior' };
      const mockVacancies = [MockDataFactory.createVacancyData('company-1')];

      prismaService.vacancy.count.mockResolvedValue(1);
      prismaService.vacancy.findMany.mockResolvedValue(mockVacancies);

      // Act
      await service.findAll(query);

      // Assert
      expect(prismaService.vacancy.count).toHaveBeenCalledWith({
        where: {
          status: 'active',
          location: { contains: 'Remote', mode: 'insensitive' },
          experienceLevel: 'senior',
        },
      });
    });

    it('should filter vacancies by salary range', async () => {
      // Arrange
      const query = { salaryMin: 80000, salaryMax: 120000 };
      const mockVacancies = [MockDataFactory.createVacancyData('company-1')];

      prismaService.vacancy.count.mockResolvedValue(1);
      prismaService.vacancy.findMany.mockResolvedValue(mockVacancies);

      // Act
      await service.findAll(query);

      // Assert
      expect(prismaService.vacancy.count).toHaveBeenCalledWith({
        where: {
          status: 'active',
          AND: [
            { salaryMin: { gte: 80000 } },
            { salaryMax: { lte: 120000 } },
          ],
        },
      });
    });

    it('should sort vacancies by score when requested', async () => {
      // Arrange
      const query = { sortBy: 'score' };
      const mockVacancies = [MockDataFactory.createVacancyData('company-1')];

      prismaService.vacancy.count.mockResolvedValue(1);
      prismaService.vacancy.findMany.mockResolvedValue(mockVacancies);

      // Act
      await service.findAll(query);

      // Assert
      expect(prismaService.vacancy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            { scores: { _count: 'desc' } },
            { createdAt: 'desc' },
          ],
        })
      );
    });
  });

  describe('findOne', () => {
    it('should return a vacancy by ID', async () => {
      // Arrange
      const vacancyId = '123';
      const mockVacancy = MockDataFactory.createVacancyData('company-1', { id: vacancyId });

      prismaService.vacancy.findUnique.mockResolvedValue(mockVacancy);

      // Act
      const result = await service.findOne(vacancyId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockVacancy);
      expect(prismaService.vacancy.findUnique).toHaveBeenCalledWith({
        where: { id: vacancyId },
        include: {
          company: true,
          scores: {
            orderBy: { scoredAt: 'desc' },
          },
          applications: {
            orderBy: { appliedAt: 'desc' },
            include: {
              cv: {
                select: {
                  id: true,
                  filename: true,
                },
              },
            },
          },
        },
      });
    });

    it('should throw NotFoundException when vacancy does not exist', async () => {
      // Arrange
      const vacancyId = 'non-existent';
      prismaService.vacancy.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(vacancyId)).rejects.toThrow(
        new NotFoundException(`Vacancy with ID ${vacancyId} not found`)
      );
    });
  });

  describe('create', () => {
    it('should create a new vacancy successfully', async () => {
      // Arrange
      const createData = MockDataFactory.createVacancyData('company-1');
      const mockCreatedVacancy = { id: '123', ...createData };

      prismaService.vacancy.create.mockResolvedValue(mockCreatedVacancy);

      // Act
      const result = await service.create(createData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCreatedVacancy);
      expect(result.message).toBe('Vacancy created successfully');

      expect(prismaService.vacancy.create).toHaveBeenCalledWith({
        data: createData,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              logo: true,
            },
          },
        },
      });
    });
  });

  describe('update', () => {
    it('should update a vacancy successfully', async () => {
      // Arrange
      const vacancyId = '123';
      const updateData = { title: 'Updated Position Title' };
      const mockUpdatedVacancy = MockDataFactory.createVacancyData('company-1', {
        id: vacancyId,
        ...updateData,
      });

      prismaService.vacancy.update.mockResolvedValue(mockUpdatedVacancy);

      // Act
      const result = await service.update(vacancyId, updateData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpdatedVacancy);
      expect(result.message).toBe('Vacancy updated successfully');

      expect(prismaService.vacancy.update).toHaveBeenCalledWith({
        where: { id: vacancyId },
        data: {
          ...updateData,
          updatedAt: expect.any(Date),
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              logo: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException when updating non-existent vacancy', async () => {
      // Arrange
      const vacancyId = 'non-existent';
      const updateData = { title: 'Updated Title' };
      const error = { code: 'P2025' };

      prismaService.vacancy.update.mockRejectedValue(error);

      // Act & Assert
      await expect(service.update(vacancyId, updateData)).rejects.toThrow(
        new NotFoundException(`Vacancy with ID ${vacancyId} not found`)
      );
    });
  });

  describe('scoreVacancy', () => {
    it('should create a new score for a vacancy', async () => {
      // Arrange
      const vacancyId = '123';
      const criteria = {
        salaryRange: '80000-120000',
        preferredLocation: 'Remote',
        requiredSkills: ['React', 'TypeScript'],
        experienceLevel: 'senior',
      };
      const mockVacancy = MockDataFactory.createVacancyData('company-1', { id: vacancyId });
      const mockScore = MockDataFactory.createVacancyScoreData(vacancyId);

      prismaService.vacancy.findUnique.mockResolvedValue(mockVacancy);
      prismaService.vacancyScore.create.mockResolvedValue(mockScore);

      // Act
      const result = await service.scoreVacancy(vacancyId, criteria);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockScore);
      expect(result.message).toBe('Vacancy scored successfully');

      expect(prismaService.vacancyScore.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          vacancyId,
          scoringCriteria: criteria,
        }),
      });
    });

    it('should throw NotFoundException when vacancy does not exist', async () => {
      // Arrange
      const vacancyId = 'non-existent';
      const criteria = { experienceLevel: 'senior' };

      prismaService.vacancy.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.scoreVacancy(vacancyId, criteria)).rejects.toThrow(
        new NotFoundException(`Vacancy with ID ${vacancyId} not found`)
      );
    });
  });

  describe('findDuplicates', () => {
    it('should detect duplicate vacancies by title and company', async () => {
      // Arrange
      const newVacancy = MockDataFactory.createVacancyData('company-1', {
        title: 'Frontend Developer',
        companyId: 'company-1',
      });
      const existingVacancy = MockDataFactory.createVacancyData('company-1', {
        id: 'existing-1',
        title: 'Frontend Developer',
        companyId: 'company-1',
      });

      prismaService.vacancy.findMany.mockResolvedValue([existingVacancy]);

      // Act
      const result = await service.findDuplicates(newVacancy);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual([existingVacancy]);

      expect(prismaService.vacancy.findMany).toHaveBeenCalledWith({
        where: {
          title: { contains: newVacancy.title, mode: 'insensitive' },
          companyId: newVacancy.companyId,
          status: 'active',
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    it('should return empty array when no duplicates found', async () => {
      // Arrange
      const newVacancy = MockDataFactory.createVacancyData('company-1');
      prismaService.vacancy.findMany.mockResolvedValue([]);

      // Act
      const result = await service.findDuplicates(newVacancy);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });
});