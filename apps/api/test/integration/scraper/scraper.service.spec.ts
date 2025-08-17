import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ScraperService } from '../../../src/modules/scraper/scraper.service';
import { DevBgScraper } from '../../../src/modules/scraper/scrapers/dev-bg.scraper';
import { VacancyService } from '../../../src/modules/vacancy/vacancy.service';
import { CompanyService } from '../../../src/modules/company/company.service';
import { PrismaService } from '../../../src/common/database/prisma.service';
import { DevBgJobListing } from '../../../src/modules/scraper/scrapers/dev-bg.scraper';

describe('ScraperService Integration Tests', () => {
  let service: ScraperService;
  let devBgScraper: DevBgScraper;
  let vacancyService: VacancyService;
  let companyService: CompanyService;
  let prismaService: PrismaService;

  // Mock data
  const mockCompany = {
    id: 'test-company-id',
    name: 'Test Company',
    location: 'Sofia',
    industry: 'Technology',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockVacancy = {
    id: 'test-vacancy-id',
    title: 'Senior Java Developer',
    description: 'Great opportunity for Java developer',
    requirements: '["java", "spring", "mysql"]',
    location: 'Sofia',
    companyId: 'test-company-id',
    sourceUrl: 'https://dev.bg/job/123',
    sourceSite: 'dev.bg',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockJobListings: DevBgJobListing[] = [
    {
      title: 'Senior Java Developer',
      company: 'Test Company',
      location: 'Sofia',
      workModel: 'hybrid',
      technologies: ['java', 'spring', 'mysql'],
      salaryRange: '3000-5000 BGN',
      postedDate: new Date('2024-01-15'),
      url: 'https://dev.bg/job/123',
      description: 'Great opportunity for Java developer',
      requirements: 'Experience with Java and Spring',
    },
    {
      title: 'Backend Developer',
      company: 'Another Company',
      location: 'Remote',
      workModel: 'remote',
      technologies: ['java', 'spring-boot', 'postgresql'],
      postedDate: new Date('2024-01-14'),
      url: 'https://dev.bg/job/124',
      description: 'Backend development role',
      requirements: 'Strong backend skills required',
    },
  ];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
      ],
      providers: [
        ScraperService,
        {
          provide: DevBgScraper,
          useValue: {
            scrapeAllJavaJobs: jest.fn(),
            fetchJobDetails: jest.fn(),
          },
        },
        {
          provide: VacancyService,
          useValue: {
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: CompanyService,
          useValue: {
            findOrCreate: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            vacancy: {
              findFirst: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ScraperService>(ScraperService);
    devBgScraper = module.get<DevBgScraper>(DevBgScraper);
    vacancyService = module.get<VacancyService>(VacancyService);
    companyService = module.get<CompanyService>(CompanyService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scrapeDevBg', () => {
    it('should successfully scrape and process job listings', async () => {
      // Setup mocks
      (devBgScraper.scrapeAllJavaJobs as jest.Mock).mockResolvedValue(mockJobListings);
      (devBgScraper.fetchJobDetails as jest.Mock).mockResolvedValue({
        description: 'Detailed job description',
        requirements: 'Detailed requirements',
      });
      (companyService.findOrCreate as jest.Mock).mockResolvedValue(mockCompany);
      (prismaService.vacancy.findFirst as jest.Mock).mockResolvedValue(null); // No existing vacancy
      (vacancyService.create as jest.Mock).mockResolvedValue(mockVacancy);

      const result = await service.scrapeDevBg();

      expect(result).toBeDefined();
      expect(result.totalJobsFound).toBe(2);
      expect(result.newVacancies).toBe(2);
      expect(result.updatedVacancies).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.duration).toBeGreaterThan(0);

      // Verify scraper was called
      expect(devBgScraper.scrapeAllJavaJobs).toHaveBeenCalledTimes(1);

      // Verify companies were found/created
      expect(companyService.findOrCreate).toHaveBeenCalledTimes(2);
      expect(companyService.findOrCreate).toHaveBeenCalledWith({
        name: 'Test Company',
        location: 'Sofia',
        industry: 'Technology',
      });

      // Verify vacancies were created
      expect(vacancyService.create).toHaveBeenCalledTimes(2);
      expect(vacancyService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Senior Java Developer',
          companyId: 'test-company-id',
          sourceUrl: 'https://dev.bg/job/123',
          sourceSite: 'dev.bg',
          status: 'active',
        })
      );
    });

    it('should update existing vacancies instead of creating duplicates', async () => {
      // Setup mocks
      (devBgScraper.scrapeAllJavaJobs as jest.Mock).mockResolvedValue([mockJobListings[0]]);
      (companyService.findOrCreate as jest.Mock).mockResolvedValue(mockCompany);
      (prismaService.vacancy.findFirst as jest.Mock).mockResolvedValue(mockVacancy); // Existing vacancy
      (vacancyService.update as jest.Mock).mockResolvedValue(mockVacancy);

      const result = await service.scrapeDevBg();

      expect(result.totalJobsFound).toBe(1);
      expect(result.newVacancies).toBe(0);
      expect(result.updatedVacancies).toBe(1);

      // Verify update was called instead of create
      expect(vacancyService.update).toHaveBeenCalledTimes(1);
      expect(vacancyService.create).not.toHaveBeenCalled();
    });

    it('should handle scraping errors gracefully', async () => {
      // Setup error scenario
      (devBgScraper.scrapeAllJavaJobs as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.scrapeDevBg();

      expect(result.totalJobsFound).toBe(0);
      expect(result.newVacancies).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Network error');
    });

    it('should handle individual job processing errors', async () => {
      // Setup scenario where one job fails
      (devBgScraper.scrapeAllJavaJobs as jest.Mock).mockResolvedValue(mockJobListings);
      (companyService.findOrCreate as jest.Mock)
        .mockResolvedValueOnce(mockCompany) // First job succeeds
        .mockRejectedValueOnce(new Error('Company creation failed')); // Second job fails

      const result = await service.scrapeDevBg();

      expect(result.totalJobsFound).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Company creation failed');
    });

    it('should fetch detailed job information when URL is available', async () => {
      // Setup mocks
      (devBgScraper.scrapeAllJavaJobs as jest.Mock).mockResolvedValue([mockJobListings[0]]);
      (devBgScraper.fetchJobDetails as jest.Mock).mockResolvedValue({
        description: 'Detailed description from job page',
        requirements: 'Detailed requirements from job page',
      });
      (companyService.findOrCreate as jest.Mock).mockResolvedValue(mockCompany);
      (prismaService.vacancy.findFirst as jest.Mock).mockResolvedValue(null);
      (vacancyService.create as jest.Mock).mockResolvedValue(mockVacancy);

      await service.scrapeDevBg();

      // Verify job details were fetched
      expect(devBgScraper.fetchJobDetails).toHaveBeenCalledWith('https://dev.bg/job/123');

      // Verify vacancy was created with detailed information
      expect(vacancyService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Detailed description from job page',
        })
      );
    });

    it('should continue processing when job details fetch fails', async () => {
      // Setup scenario where job details fetch fails
      (devBgScraper.scrapeAllJavaJobs as jest.Mock).mockResolvedValue([mockJobListings[0]]);
      (devBgScraper.fetchJobDetails as jest.Mock).mockRejectedValue(new Error('Failed to fetch details'));
      (companyService.findOrCreate as jest.Mock).mockResolvedValue(mockCompany);
      (prismaService.vacancy.findFirst as jest.Mock).mockResolvedValue(null);
      (vacancyService.create as jest.Mock).mockResolvedValue(mockVacancy);

      const result = await service.scrapeDevBg();

      // Should still process the job even if details fetch fails
      expect(result.totalJobsFound).toBe(1);
      expect(result.newVacancies).toBe(1);
      expect(result.errors).toHaveLength(0); // Job details fetch errors don't count as processing errors

      // Verify vacancy was created with original description
      expect(vacancyService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Great opportunity for Java developer', // Original description
        })
      );
    });
  });

  describe('getScrapingStats', () => {
    it('should return scraping statistics', async () => {
      // Setup mocks
      (prismaService.vacancy.count as jest.Mock)
        .mockResolvedValueOnce(50) // Total vacancies
        .mockResolvedValueOnce(45) // Active vacancies
        .mockResolvedValueOnce(10); // Companies count

      const stats = await service.getScrapingStats();

      expect(stats).toBeDefined();
      expect(stats.totalVacancies).toBe(50);
      expect(stats.activeVacancies).toBe(45);
      expect(stats.companiesFromDevBg).toBe(10);
      expect(stats.lastScrapedAt).toBeDefined();
    });
  });

  describe('Data Processing Methods', () => {
    it('should parse salary ranges correctly', () => {
      const parseSalaryMin = (service as any).parseSalaryMin.bind(service);
      const parseSalaryMax = (service as any).parseSalaryMax.bind(service);

      expect(parseSalaryMin('3000-5000 BGN')).toBe(300000); // Convert to cents
      expect(parseSalaryMax('3000-5000 BGN')).toBe(500000);
      expect(parseSalaryMin('2500 BGN')).toBe(250000);
      expect(parseSalaryMax('2500 BGN')).toBe(250000);
      expect(parseSalaryMin(undefined)).toBeNull();
      expect(parseSalaryMax(undefined)).toBeNull();
    });

    it('should extract experience level from job titles', () => {
      const extractExperienceLevel = (service as any).extractExperienceLevel.bind(service);

      expect(extractExperienceLevel('Senior Java Developer')).toBe('senior');
      expect(extractExperienceLevel('Junior Software Engineer')).toBe('junior');
      expect(extractExperienceLevel('Lead Backend Developer')).toBe('senior');
      expect(extractExperienceLevel('Java Developer')).toBe('mid'); // default
      expect(extractExperienceLevel('Mid-level Programmer')).toBe('mid');
    });

    it('should map work models to employment types', () => {
      const mapWorkModelToEmploymentType = (service as any).mapWorkModelToEmploymentType.bind(service);

      expect(mapWorkModelToEmploymentType('remote')).toBe('full-time');
      expect(mapWorkModelToEmploymentType('hybrid')).toBe('full-time');
      expect(mapWorkModelToEmploymentType('on-site')).toBe('full-time');
      expect(mapWorkModelToEmploymentType('part-time')).toBe('part-time');
      expect(mapWorkModelToEmploymentType('contract')).toBe('contract');
      expect(mapWorkModelToEmploymentType('unknown')).toBe('full-time'); // default
    });
  });
});