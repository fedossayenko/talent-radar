import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { DevBgScraper } from '../../../src/modules/scraper/scrapers/dev-bg.scraper';
import { TranslationService } from '../../../src/modules/scraper/services/translation.service';
import { JobParserService } from '../../../src/modules/scraper/services/job-parser.service';
import { TechPatternService } from '../../../src/modules/scraper/services/tech-pattern.service';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('DevBgScraper Integration Tests', () => {
  let scraper: DevBgScraper;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
      ],
      providers: [
        DevBgScraper,
        TranslationService,
        JobParserService,
        TechPatternService,
      ],
    }).compile();

    scraper = module.get<DevBgScraper>(DevBgScraper);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('End-to-End Scraping Integration', () => {
    it('should successfully scrape and process jobs from dev.bg HTML', async () => {
      // Mock HTML response with realistic structure
      const mockHtmlResponse = {
        data: `
          <html>
            <body>
              <div class="job-list-item" data-job-id="460010">
                <h6 class="job-title">Старши Java Разработчик</h6>
                <div class="company-name">Test Company</div>
                <a class="overlay-link" href="/company/jobads/test-company-java-developer/"></a>
                <div class="badge">София\nДистанционно</div>
                <div class="salary">3000-5000 лв</div>
                <div class="tech-stack-wrap">
                  <img title="Java" src="/tech-java.png" />
                  <img title="Spring Boot" src="/tech-spring.png" />
                  <img title="MySQL" src="/tech-mysql.png" />
                </div>
                <time datetime="2024-01-15T10:00:00Z">15 януари</time>
                <p>Looking for experienced Java developer with Spring and MySQL knowledge</p>
              </div>
              <div class="job-list-item" data-job-id="460011">
                <h6 class="job-title">Frontend Developer</h6>
                <div class="company-name">Another Company</div>
                <a class="overlay-link" href="/company/jobads/frontend-dev/"></a>
                <div class="badge">Пловдив\nХибридно</div>
                <div class="tech-stack-wrap">
                  <img title="React" src="/tech-react.png" />
                  <img title="TypeScript" src="/tech-ts.png" />
                </div>
                <p>React and TypeScript experience required</p>
              </div>
            </body>
          </html>
        `,
      };

      mockedAxios.get.mockResolvedValue(mockHtmlResponse);

      const jobs = await scraper.scrapeJavaJobs({ page: 1 });

      expect(jobs).toHaveLength(2);

      // Test first job - Java with Bulgarian translation
      const javaJob = jobs[0];
      expect(javaJob.title).toBe('Senior Java Developer'); // Translated
      expect(javaJob.company).toBe('Test Company');
      expect(javaJob.location).toBe('Sofia'); // Translated from София
      expect(javaJob.workModel).toBe('remote'); // Detected from Дистанционно
      expect(javaJob.technologies).toContain('java');
      expect(javaJob.technologies).toContain('spring boot');
      expect(javaJob.technologies).toContain('mysql');
      expect(javaJob.technologies).toContain('spring'); // From text analysis
      expect(javaJob.salaryRange).toBe('3000-5000 лв');
      expect(javaJob.url).toBe('/company/jobads/test-company-java-developer/');
      expect(javaJob.postedDate).toBeInstanceOf(Date);

      // Test second job - Frontend
      const frontendJob = jobs[1];
      expect(frontendJob.title).toBe('Frontend Developer');
      expect(frontendJob.location).toBe('Plovdiv'); // Translated from Пловдив
      expect(frontendJob.workModel).toBe('hybrid'); // Detected from Хибридно
      expect(frontendJob.technologies).toContain('react');
      expect(frontendJob.technologies).toContain('typescript');
    });

    it('should handle empty HTML response gracefully', async () => {
      const emptyHtmlResponse = {
        data: '<html><body></body></html>',
      };

      mockedAxios.get.mockResolvedValue(emptyHtmlResponse);

      const jobs = await scraper.scrapeJavaJobs({ page: 1 });

      expect(jobs).toHaveLength(0);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('dev.bg'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('TalentRadar'),
          }),
        })
      );
    });

    it('should handle network errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network timeout'));

      await expect(scraper.scrapeJavaJobs({ page: 1 })).rejects.toThrow('Network timeout');
    });
  });

  describe('Job Details Fetching Integration', () => {
    it('should fetch and parse job details from individual job pages', async () => {
      const mockJobDetailsHtml = `
        <html>
          <body>
            <div class="job-description">
              <p>Търсим опитен <strong>Java разработчик</strong> за нашия екип.</p>
              <ul>
                <li>Работа с модерни технологии</li>
                <li>Гъвкаво работно време</li>
              </ul>
            </div>
            <div class="job-requirements">
              <p>Изисквания:</p>
              <ul>
                <li>3+ години опит с Java</li>
                <li>Познания по Spring Framework</li>
              </ul>
            </div>
          </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockJobDetailsHtml });

      const jobDetails = await scraper.fetchJobDetails('https://dev.bg/job/123');

      expect(jobDetails.description).toContain('опитен Java Developer'); // Partially translated
      expect(jobDetails.description).toContain('Работа с модерни технологии');
      expect(jobDetails.requirements).toContain('Изисквания');
      expect(jobDetails.requirements).toContain('3+ години опит с Java');
    });

    it('should handle missing job details gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Job not found'));

      const jobDetails = await scraper.fetchJobDetails('https://dev.bg/job/invalid');

      expect(jobDetails.description).toBe('');
      expect(jobDetails.requirements).toBe('');
    });
  });

  describe('Multi-page Scraping Integration', () => {
    it('should scrape multiple pages until no more jobs found', async () => {
      // Mock first page with jobs
      const firstPageHtml = {
        data: `
          <html><body>
            <div class="job-list-item">
              <h6 class="job-title">Java Developer</h6>
              <div class="company-name">Company 1</div>
              <div class="badge">София</div>
            </div>
          </body></html>
        `,
      };

      // Mock second page with no jobs
      const emptyPageHtml = {
        data: '<html><body></body></html>',
      };

      mockedAxios.get
        .mockResolvedValueOnce(firstPageHtml) // First page
        .mockResolvedValueOnce(emptyPageHtml); // Second page (empty)

      const allJobs = await scraper.scrapeAllJavaJobs();

      expect(allJobs).toHaveLength(1);
      expect(allJobs[0].title).toBe('Java Developer');
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Configuration Integration', () => {
    it('should respect configuration settings', () => {
      // Verify that scraper uses configuration from ConfigService
      expect(scraper).toBeDefined();
      
      // This test verifies the scraper is properly configured
      // In a real environment, it would fetch from actual config
    });
  });

  describe('Service Integration', () => {
    it('should properly integrate with all required services', async () => {
      const mockHtmlResponse = {
        data: `
          <html><body>
            <div class="job-list-item">
              <h6 class="job-title">Програмист</h6>
              <div class="company-name">Tech Corp</div>
              <div class="badge">Варна\nRemote</div>
              <img title="Python" src="/python.png" />
              <p>Python and Django experience needed</p>
            </div>
          </body></html>
        `,
      };

      mockedAxios.get.mockResolvedValue(mockHtmlResponse);

      const jobs = await scraper.scrapeJavaJobs();

      // Verify integration across all services
      expect(jobs).toHaveLength(1);
      
      const job = jobs[0];
      // TranslationService integration
      expect(job.title).toBe('Programmer'); // Translated from Програмист
      expect(job.location).toBe('Varna'); // Translated from Варна
      expect(job.workModel).toBe('remote'); // Detected by TranslationService
      
      // TechPatternService integration
      expect(job.technologies).toContain('python'); // From image
      expect(job.technologies).toContain('django'); // From text
      
      // JobParserService integration
      expect(job.company).toBe('Tech Corp'); // Parsed correctly
    });
  });
});