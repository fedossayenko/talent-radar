import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { ScraperFactoryService } from '../../../src/modules/scraper/services/scraper-factory.service';
import { ScraperRegistryService } from '../../../src/modules/scraper/services/scraper-registry.service';
import { DuplicateDetectorService } from '../../../src/modules/scraper/services/duplicate-detector.service';
import { CompanyMatcherService } from '../../../src/modules/scraper/services/company-matcher.service';
import { DevBgScraper } from '../../../src/modules/scraper/scrapers/dev-bg.scraper';
import { JobsBgScraper } from '../../../src/modules/scraper/scrapers/jobs-bg.scraper';
import { PrismaService } from '../../../src/common/database/prisma.service';
import { TranslationService } from '../../../src/modules/scraper/services/translation.service';
import { JobParserService } from '../../../src/modules/scraper/services/job-parser.service';
import { TechPatternService } from '../../../src/modules/scraper/services/tech-pattern.service';

// Mock axios to return our fixture HTML
jest.mock('axios');
const mockedAxios = jest.mocked(axios, true);

describe('ScraperFactoryService Integration', () => {
  let module: TestingModule;
  let scraperFactory: ScraperFactoryService;
  let prismaService: PrismaService;
  
  const fixturesPath = path.join(__dirname, 'fixtures');
  
  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        ScraperFactoryService,
        ScraperRegistryService,
        DuplicateDetectorService,
        CompanyMatcherService,
        DevBgScraper,
        JobsBgScraper,
        TranslationService,
        JobParserService,
        TechPatternService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config = {
                'scraper.devBg.baseUrl': 'https://dev.bg',
                'scraper.devBg.apiUrl': 'https://dev.bg/company/jobs/java/',
                'scraper.devBg.maxPages': 10,
                'scraper.devBg.requestTimeout': 30000,
                'scraper.devBg.requestDelay': 2000,
                'scraper.devBg.maxRetries': 3,
                'scraper.devBg.userAgent': 'Test Agent',
                'scraper.jobsBg.baseUrl': 'https://www.jobs.bg',
                'scraper.jobsBg.searchUrl': 'https://www.jobs.bg/front_job_search.php',
                'scraper.jobsBg.maxPages': 10,
                'scraper.jobsBg.requestTimeout': 30000,
                'scraper.jobsBg.requestDelay': 2000,
                'scraper.jobsBg.maxRetries': 3,
                'scraper.jobsBg.userAgent': 'Test Agent',
                'scraper.duplicateDetection.enabled': true,
                'scraper.duplicateDetection.fuzzyMatchThreshold': 0.8,
              };
              return config[key] || defaultValue;
            }),
          },
        },
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
            vacancy: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    scraperFactory = module.get<ScraperFactoryService>(ScraperFactoryService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Multi-site scraping with fixtures', () => {
    it('should scrape jobs from dev.bg using fixture HTML', async () => {
      // Load fixture HTML
      const devBgHTML = fs.readFileSync(
        path.join(fixturesPath, 'dev-bg', 'job-listings-page1.html'),
        'utf8'
      );

      // Mock axios response
      mockedAxios.get.mockResolvedValueOnce({
        data: devBgHTML,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      // Mock database calls
      (prismaService.company.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.company.create as jest.Mock).mockResolvedValue({
        id: 'company-1',
        name: 'UKG (Ultimate Kronos Group)',
      });
      (prismaService.vacancy.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await scraperFactory.scrapeMultipleSites({
        sites: ['dev.bg'],
        enableDuplicateDetection: false,
        enableCompanyMatching: true,
      });

      expect(result.totalJobs).toBeGreaterThan(0);
      expect(result.siteResults).toHaveProperty('dev.bg');
      expect(result.siteResults['dev.bg'].jobs).toHaveLength(4); // 4 jobs in fixture
      expect(result.errors).toHaveLength(0);
      
      // Verify job data structure
      const firstJob = result.siteResults['dev.bg'].jobs[0];
      expect(firstJob).toMatchObject({
        title: expect.any(String),
        company: expect.any(String),
        url: expect.stringContaining('dev.bg'),
        sourceSite: 'dev.bg',
        technologies: expect.any(Array),
      });
    });

    it('should scrape jobs from jobs.bg using fixture HTML', async () => {
      // Load fixture HTML
      const jobsBgHTML = fs.readFileSync(
        path.join(fixturesPath, 'jobs-bg', 'job-listings.html'),
        'utf8'
      );

      // Mock axios response
      mockedAxios.get.mockResolvedValueOnce({
        data: jobsBgHTML,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      // Mock database calls
      (prismaService.company.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.company.create as jest.Mock).mockResolvedValue({
        id: 'company-1',
        name: 'UKG',
      });
      (prismaService.vacancy.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await scraperFactory.scrapeMultipleSites({
        sites: ['jobs.bg'],
        enableDuplicateDetection: false,
        enableCompanyMatching: true,
      });

      expect(result.totalJobs).toBeGreaterThan(0);
      expect(result.siteResults).toHaveProperty('jobs.bg');
      expect(result.siteResults['jobs.bg'].jobs).toHaveLength(4); // 4 jobs in fixture
      expect(result.errors).toHaveLength(0);

      // Verify job data structure
      const firstJob = result.siteResults['jobs.bg'].jobs[0];
      expect(firstJob).toMatchObject({
        title: expect.any(String),
        company: expect.any(String),
        url: expect.stringContaining('jobs.bg'),
        sourceSite: 'jobs.bg',
        technologies: expect.any(Array),
      });
    });

    it('should scrape multiple sites concurrently', async () => {
      // Load both fixture HTMLs
      const devBgHTML = fs.readFileSync(
        path.join(fixturesPath, 'dev-bg', 'job-listings-page1.html'),
        'utf8'
      );
      const jobsBgHTML = fs.readFileSync(
        path.join(fixturesPath, 'jobs-bg', 'job-listings.html'),
        'utf8'
      );

      // Mock axios responses for both sites
      mockedAxios.get
        .mockResolvedValueOnce({ data: devBgHTML, status: 200, statusText: 'OK', headers: {}, config: {} })
        .mockResolvedValueOnce({ data: jobsBgHTML, status: 200, statusText: 'OK', headers: {}, config: {} });

      // Mock database calls
      (prismaService.company.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.company.create as jest.Mock)
        .mockResolvedValueOnce({ id: 'company-1', name: 'UKG (Ultimate Kronos Group)' })
        .mockResolvedValueOnce({ id: 'company-2', name: 'UKG' });
      (prismaService.vacancy.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await scraperFactory.scrapeMultipleSites({
        sites: ['dev.bg', 'jobs.bg'],
        enableDuplicateDetection: false,
        enableCompanyMatching: true,
      });

      expect(result.totalJobs).toBe(8); // 4 from each site
      expect(result.siteResults).toHaveProperty('dev.bg');
      expect(result.siteResults).toHaveProperty('jobs.bg');
      expect(result.errors).toHaveLength(0);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle scraping errors gracefully', async () => {
      // Mock axios to throw an error
      mockedAxios.get.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await scraperFactory.scrapeMultipleSites({
        sites: ['dev.bg'],
        enableDuplicateDetection: false,
        enableCompanyMatching: false,
      });

      expect(result.totalJobs).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Network timeout');
    });
  });

  describe('Job details fetching', () => {
    it('should fetch job details from dev.bg using fixture', async () => {
      // Load job details fixture
      const jobDetailsHTML = fs.readFileSync(
        path.join(fixturesPath, 'dev-bg', 'job-details-sample.html'),
        'utf8'
      );

      // Mock axios response
      mockedAxios.get.mockResolvedValueOnce({
        data: jobDetailsHTML,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const jobUrl = 'https://dev.bg/company/jobads/ukg-senior-java-developer/';
      const details = await scraperFactory.fetchJobDetails(jobUrl, 'UKG');

      expect(details).toBeDefined();
      expect(details.description).toContain('Java');
      expect(details.requirements).toContain('Spring');
      expect(details.rawHtml).toBe(jobDetailsHTML);
    });

    it('should fetch job details from jobs.bg using fixture', async () => {
      // Load job details fixture
      const jobDetailsHTML = fs.readFileSync(
        path.join(fixturesPath, 'jobs-bg', 'job-details.html'),
        'utf8'
      );

      // Mock axios response
      mockedAxios.get.mockResolvedValueOnce({
        data: jobDetailsHTML,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const jobUrl = 'https://www.jobs.bg/job/8102284';
      const details = await scraperFactory.fetchJobDetails(jobUrl);

      expect(details).toBeDefined();
      expect(details.description).toContain('Java');
      expect(details.rawHtml).toBe(jobDetailsHTML);
    });

    it('should handle job details fetch errors gracefully', async () => {
      // Mock axios to throw an error
      mockedAxios.get.mockRejectedValueOnce(new Error('Job not found'));

      const jobUrl = 'https://dev.bg/company/jobads/nonexistent-job/';
      const details = await scraperFactory.fetchJobDetails(jobUrl);

      expect(details).toEqual({
        description: '',
        requirements: '',
        rawHtml: '',
      });
    });
  });

  describe('Configuration', () => {
    it('should return available scrapers configuration', () => {
      const scrapers = scraperFactory.getAvailableScrapers();

      expect(scrapers).toHaveProperty('dev.bg');
      expect(scrapers).toHaveProperty('jobs.bg');
      expect(scrapers['dev.bg']).toMatchObject({
        name: 'dev.bg',
        baseUrl: expect.any(String),
        supportedLocations: expect.any(Array),
        supportedCategories: expect.any(Array),
      });
    });

    it('should return scraper statistics', () => {
      const stats = scraperFactory.getStats();

      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });
  });
});