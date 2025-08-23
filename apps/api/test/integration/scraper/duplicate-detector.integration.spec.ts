import { Test, TestingModule } from '@nestjs/testing';
import { DuplicateDetectorService } from '../../../src/modules/scraper/services/duplicate-detector.service';
import { PrismaService } from '../../../src/common/database/prisma.service';
import { JobListing } from '../../../src/modules/scraper/interfaces/job-scraper.interface';

describe('DuplicateDetectorService Integration', () => {
  let module: TestingModule;
  let duplicateDetector: DuplicateDetectorService;
  let prismaService: PrismaService;

  const mockJob1: JobListing = {
    title: 'Senior Java Developer',
    company: 'UKG (Ultimate Kronos Group)',
    location: 'София',
    workModel: 'hybrid',
    technologies: ['Java', 'Spring Boot', 'AWS', 'Docker', 'SQL'],
    postedDate: new Date('2023-08-20'),
    url: 'https://dev.bg/company/jobads/ukg-senior-java-developer/',
    originalJobId: 'ukg-senior-java-developer',
    sourceSite: 'dev.bg',
    description: '',
    requirements: '',
    experienceLevel: 'senior',
    employmentType: 'full-time',
  };

  const mockJob2: JobListing = {
    title: 'Senior Java Developer',
    company: 'UKG',
    location: 'София',
    workModel: 'hybrid',
    technologies: ['Java', 'Spring Boot', 'AWS', 'Docker', 'PostgreSQL'],
    postedDate: new Date('2023-08-20'),
    url: 'https://www.jobs.bg/job/8102284',
    originalJobId: '8102284',
    sourceSite: 'jobs.bg',
    description: '',
    requirements: '',
    experienceLevel: 'senior',
    employmentType: 'full-time',
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mockJob3: JobListing = {
    title: 'Junior Java Developer',
    company: 'SoftUni',
    location: 'София',
    workModel: 'office',
    technologies: ['Java', 'Spring Boot', 'PostgreSQL'],
    postedDate: new Date('2023-08-21'),
    url: 'https://dev.bg/company/jobads/softuni-junior-java-developer/',
    originalJobId: 'softuni-junior-java-developer',
    sourceSite: 'dev.bg',
    description: '',
    requirements: '',
    experienceLevel: 'junior',
    employmentType: 'full-time',
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        DuplicateDetectorService,
        {
          provide: PrismaService,
          useValue: {
            vacancy: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              upsert: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    duplicateDetector = module.get<DuplicateDetectorService>(DuplicateDetectorService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Exact match detection', () => {
    it('should find exact match by external ID', async () => {
      // Mock existing vacancy with same external ID
      (prismaService.vacancy.findFirst as jest.Mock).mockResolvedValue({
        id: 'vacancy-1',
        title: 'Senior Java Developer',
        externalIds: { 'dev.bg': 'ukg-senior-java-developer' },
      });

      const exactMatch = await duplicateDetector.findExactMatch(mockJob1);

      expect(exactMatch).toBe('vacancy-1');
      expect(prismaService.vacancy.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { sourceUrl: mockJob1.url },
            {
              externalIds: {
                path: [mockJob1.sourceSite],
                equals: mockJob1.originalJobId,
              },
            },
          ],
        },
        select: { id: true },
      });
    });

    it('should find exact match by source URL', async () => {
      (prismaService.vacancy.findFirst as jest.Mock).mockResolvedValue({
        id: 'vacancy-2',
        title: 'Senior Java Developer',
        sourceUrl: mockJob1.url,
      });

      const exactMatch = await duplicateDetector.findExactMatch(mockJob1);

      expect(exactMatch).toBe('vacancy-2');
    });

    it('should return null when no exact match found', async () => {
      (prismaService.vacancy.findFirst as jest.Mock).mockResolvedValue(null);

      const exactMatch = await duplicateDetector.findExactMatch(mockJob1);

      expect(exactMatch).toBeNull();
    });
  });

  describe('Fuzzy duplicate detection', () => {
    it('should find duplicates based on title and company similarity', async () => {
      // Mock existing vacancies
      const existingVacancies = [
        {
          id: 'vacancy-1',
          title: 'Senior Java Developer',
          companyName: 'UKG',
          location: 'София',
          technologies: ['Java', 'Spring Boot', 'AWS'],
          postedAt: new Date('2023-08-20'),
          Company: { name: 'UKG' },
        },
        {
          id: 'vacancy-2',
          title: 'Junior Java Developer',
          companyName: 'SoftUni',
          location: 'София',
          technologies: ['Java', 'Spring'],
          postedAt: new Date('2023-08-21'),
          Company: { name: 'SoftUni' },
        },
      ];

      (prismaService.vacancy.findMany as jest.Mock).mockResolvedValue(existingVacancies);

      const duplicates = await duplicateDetector.findDuplicates(mockJob2);

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0]).toMatchObject({
        existingId: 'vacancy-1',
        shouldMerge: true,
        matchReasons: expect.arrayContaining([
          expect.stringContaining('Similar job title'),
          expect.stringContaining('Same company'),
        ]),
      });
      expect(duplicates[0].matchScore).toBeGreaterThan(0.8);
    });

    it('should not find duplicates when similarity is too low', async () => {
      const existingVacancies = [
        {
          id: 'vacancy-1',
          title: 'React Developer',
          companyName: 'Different Company',
          location: 'Пловдив',
          technologies: ['React', 'TypeScript'],
          postedAt: new Date('2023-08-15'),
          Company: { name: 'Different Company' },
        },
      ];

      (prismaService.vacancy.findMany as jest.Mock).mockResolvedValue(existingVacancies);

      const duplicates = await duplicateDetector.findDuplicates(mockJob1);

      expect(duplicates).toHaveLength(0);
    });

    it('should consider temporal proximity in similarity calculation', async () => {
      const existingVacancies = [
        {
          id: 'vacancy-1',
          title: 'Senior Java Developer',
          companyName: 'UKG',
          location: 'София',
          technologies: ['Java', 'Spring'],
          postedAt: new Date('2023-08-20'), // Same day as mockJob1
          Company: { name: 'UKG' },
        },
        {
          id: 'vacancy-2',
          title: 'Senior Java Developer',
          companyName: 'UKG',
          location: 'София',
          technologies: ['Java', 'Spring'],
          postedAt: new Date('2023-07-15'), // Much older
          Company: { name: 'UKG' },
        },
      ];

      (prismaService.vacancy.findMany as jest.Mock).mockResolvedValue(existingVacancies);

      const duplicates = await duplicateDetector.findDuplicates(mockJob1);

      expect(duplicates).toHaveLength(2);
      
      // The more recent job should have a higher score
      const recentJob = duplicates.find(d => d.existingId === 'vacancy-1');
      const olderJob = duplicates.find(d => d.existingId === 'vacancy-2');
      
      expect(recentJob?.matchScore).toBeGreaterThan(olderJob?.matchScore || 0);
    });

    it('should consider technology overlap in similarity calculation', async () => {
      const existingVacancies = [
        {
          id: 'vacancy-1',
          title: 'Senior Java Developer',
          companyName: 'UKG',
          location: 'София',
          technologies: ['Java', 'Spring Boot', 'AWS', 'Docker'], // High overlap
          postedAt: new Date('2023-08-20'),
          Company: { name: 'UKG' },
        },
        {
          id: 'vacancy-2',
          title: 'Senior Java Developer',
          companyName: 'UKG',
          location: 'София',
          technologies: ['Python', 'Django'], // No overlap
          postedAt: new Date('2023-08-20'),
          Company: { name: 'UKG' },
        },
      ];

      (prismaService.vacancy.findMany as jest.Mock).mockResolvedValue(existingVacancies);

      const duplicates = await duplicateDetector.findDuplicates(mockJob1);

      expect(duplicates).toHaveLength(2);
      
      const highOverlapJob = duplicates.find(d => d.existingId === 'vacancy-1');
      const noOverlapJob = duplicates.find(d => d.existingId === 'vacancy-2');
      
      expect(highOverlapJob?.matchScore).toBeGreaterThan(noOverlapJob?.matchScore || 0);
    });
  });

  describe('Job merging', () => {
    it('should merge job listings by updating scrapedSites', async () => {
      const existingVacancy = {
        id: 'vacancy-1',
        scrapedSites: {
          'dev.bg': {
            lastSeenAt: '2023-08-20T10:00:00Z',
            url: 'https://dev.bg/company/jobads/ukg-senior-java-developer/',
            originalId: 'ukg-senior-java-developer',
          },
        },
        externalIds: {
          'dev.bg': 'ukg-senior-java-developer',
        },
      };

      (prismaService.vacancy.findFirst as jest.Mock).mockResolvedValue(existingVacancy);
      (prismaService.vacancy.update as jest.Mock).mockResolvedValue({});

      await duplicateDetector.mergeJobListings('vacancy-1', mockJob2);

      expect(prismaService.vacancy.update).toHaveBeenCalledWith({
        where: { id: 'vacancy-1' },
        data: {
          scrapedSites: {
            'dev.bg': {
              lastSeenAt: '2023-08-20T10:00:00Z',
              url: 'https://dev.bg/company/jobads/ukg-senior-java-developer/',
              originalId: 'ukg-senior-java-developer',
            },
            'jobs.bg': {
              lastSeenAt: expect.any(String),
              url: mockJob2.url,
              originalId: mockJob2.originalJobId,
            },
          },
          externalIds: {
            'dev.bg': 'ukg-senior-java-developer',
            'jobs.bg': '8102284',
          },
        },
      });
    });

    it('should handle merging when existing vacancy has no scrapedSites', async () => {
      const existingVacancy = {
        id: 'vacancy-1',
        scrapedSites: null,
        externalIds: null,
      };

      (prismaService.vacancy.findFirst as jest.Mock).mockResolvedValue(existingVacancy);
      (prismaService.vacancy.update as jest.Mock).mockResolvedValue({});

      await duplicateDetector.mergeJobListings('vacancy-1', mockJob1);

      expect(prismaService.vacancy.update).toHaveBeenCalledWith({
        where: { id: 'vacancy-1' },
        data: {
          scrapedSites: {
            'dev.bg': {
              lastSeenAt: expect.any(String),
              url: mockJob1.url,
              originalId: mockJob1.originalJobId,
            },
          },
          externalIds: {
            'dev.bg': 'ukg-senior-java-developer',
          },
        },
      });
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully in findDuplicates', async () => {
      (prismaService.vacancy.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const duplicates = await duplicateDetector.findDuplicates(mockJob1);

      expect(duplicates).toEqual([]);
    });

    it('should handle database errors gracefully in mergeJobListings', async () => {
      (prismaService.vacancy.findFirst as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(duplicateDetector.mergeJobListings('vacancy-1', mockJob1))
        .rejects.toThrow('Database error');
    });
  });
});