import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DevBgScraper } from '../../../src/modules/scraper/scrapers/dev-bg.scraper';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('DevBgScraper Integration Tests', () => {
  let scraper: DevBgScraper;
  let configService: ConfigService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
      ],
      providers: [DevBgScraper],
    }).compile();

    scraper = module.get<DevBgScraper>(DevBgScraper);
    configService = module.get<ConfigService>(ConfigService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scrapeJavaJobs', () => {
    it('should successfully scrape jobs from dev.bg HTML', async () => {
      // Mock HTML response with correct structure
      const mockHtmlResponse = {
        data: `
          <html>
            <body>
              <div class="job-list-item" data-job-id="460010">
                <h6 class="job-title"><a href="/company/jobads/test-company-java-developer/">Senior Java Developer</a></h6>
                <span class="company-name">Test Company</span>
                <span class="badge">София</span>
                <div class="tech-stack-wrap">
                  <img title="Java" src="/tech-java.png" />
                  <img title="Spring" src="/tech-spring.png" />
                </div>
                <time datetime="2024-01-15T10:00:00Z">2024-01-15</time>
              </div>
              <div class="job-list-item" data-job-id="460011">
                <h6 class="job-title"><a href="/company/jobads/another-company-backend-dev/">Backend Developer</a></h6>
                <span class="company-name">Another Company</span>
                <span class="badge">Fully Remote</span>
                <div class="tech-stack-wrap">
                  <img title="Java" src="/tech-java.png" />
                  <img title="PostgreSQL" src="/tech-postgres.png" />
                </div>
                <time datetime="2024-01-14T09:00:00Z">2024-01-14</time>
              </div>
            </body>
          </html>
        `,
      };

      mockedAxios.get.mockResolvedValueOnce(mockHtmlResponse);

      const result = await scraper.scrapeJavaJobs({ page: 1 });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Verify first job
      const firstJob = result[0];
      expect(firstJob.title).toBe('Senior Java Developer');
      expect(firstJob.company).toBe('Test Company');
      expect(firstJob.location).toBe('Sofia'); // Should be translated
      expect(firstJob.url).toContain('/company/jobads/test-company-java-developer/');
      expect(firstJob.technologies).toContain('java');
      expect(firstJob.technologies).toContain('spring');

      // Verify HTTP call was made correctly
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/company/jobs/java/'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('TalentRadar'),
            'Accept': expect.stringContaining('text/html'),
          }),
          timeout: expect.any(Number),
        })
      );
    });

    it('should handle empty HTML response gracefully', async () => {
      const mockHtmlResponse = {
        data: `
          <html>
            <body>
              <div>No jobs found</div>
            </body>
          </html>
        `,
      };

      mockedAxios.get.mockResolvedValueOnce(mockHtmlResponse);

      const result = await scraper.scrapeJavaJobs({ page: 1 });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should handle HTTP errors gracefully', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(scraper.scrapeJavaJobs({ page: 1 })).rejects.toThrow('Network error');
    });

    it('should respect configuration settings', async () => {
      const mockHtmlResponse = {
        data: `
          <html>
            <body>
              <div>No jobs</div>
            </body>
          </html>
        `,
      };

      mockedAxios.get.mockResolvedValueOnce(mockHtmlResponse);

      await scraper.scrapeJavaJobs({ page: 1 });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/company/jobs/java/'),
        expect.objectContaining({
          timeout: expect.any(Number),
          headers: expect.objectContaining({
            'User-Agent': expect.any(String),
            'Accept': expect.stringContaining('text/html'),
          }),
        })
      );
    });
  });

  describe('scrapeAllJavaJobs', () => {
    it('should scrape multiple pages until no more jobs found', async () => {
      // Mock responses for multiple pages
      const mockPage1Response = {
        data: `
          <html>
            <body>
              <div class="job-list-item" data-job-id="460010">
                <h6 class="job-title"><a href="/job1">Job 1</a></h6>
                <span class="company-name">Company 1</span>
                <span class="badge">София</span>
                <time datetime="2024-01-15T10:00:00Z">2024-01-15</time>
              </div>
            </body>
          </html>
        `,
      };

      const mockPage2Response = {
        data: `
          <html>
            <body>
              <div>No more jobs</div>
            </body>
          </html>
        `, // Empty response to stop pagination
      };

      mockedAxios.get
        .mockResolvedValueOnce(mockPage1Response)
        .mockResolvedValueOnce(mockPage2Response);

      const result = await scraper.scrapeAllJavaJobs();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should respect max pages limit', async () => {
      // Mock response that would continue indefinitely
      const mockResponse = {
        data: `
          <html>
            <body>
              <div class="job-list-item" data-job-id="460010">
                <h6 class="job-title"><a href="/job">Job</a></h6>
                <span class="company-name">Company</span>
                <span class="badge">София</span>
                <time datetime="2024-01-15T10:00:00Z">2024-01-15</time>
              </div>
            </body>
          </html>
        `,
      };

      // Mock exactly 5 responses to test limit
      const maxPages = 5;
      for (let i = 0; i < maxPages; i++) {
        mockedAxios.get.mockResolvedValueOnce(mockResponse);
      }

      // Set a shorter max pages for test
      jest.spyOn(configService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'scraper.devBg.maxPages') return maxPages;
        return defaultValue;
      });

      const result = await scraper.scrapeAllJavaJobs();

      expect(mockedAxios.get).toHaveBeenCalledTimes(maxPages);
      expect(result.length).toBe(maxPages); // Each page has 1 job
    }, 15000);
  });

  describe('fetchJobDetails', () => {
    it('should fetch job details from individual job page', async () => {
      const mockJobPageHtml = `
        <html>
          <body>
            <div class="job-description">
              <p>We are looking for a skilled Java developer to join our team.</p>
              <p>You will be working on exciting projects using Spring Boot and microservices.</p>
            </div>
            <div class="job-requirements">
              <ul>
                <li>5+ years experience with Java</li>
                <li>Experience with Spring Framework</li>
                <li>Knowledge of REST APIs</li>
              </ul>
            </div>
          </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValueOnce({ data: mockJobPageHtml });

      const result = await scraper.fetchJobDetails('https://dev.bg/company/jobads/test-job/');

      expect(result).toBeDefined();
      expect(result.description).toContain('skilled');
      expect(result.requirements).toContain('years experience');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://dev.bg/company/jobads/test-job/',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('TalentRadar'),
          }),
          timeout: expect.any(Number),
        })
      );
    });

    it('should handle missing job details gracefully', async () => {
      const mockJobPageHtml = '<html><body><p>Page not found</p></body></html>';

      mockedAxios.get.mockResolvedValueOnce({ data: mockJobPageHtml });

      const result = await scraper.fetchJobDetails('https://dev.bg/company/jobads/missing-job/');

      expect(result).toBeDefined();
      expect(result.description).toBe('');
      expect(result.requirements).toBe('');
    });

    it('should handle fetch errors gracefully', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('404 Not Found'));

      const result = await scraper.fetchJobDetails('https://dev.bg/company/jobads/error-job/');

      expect(result).toBeDefined();
      expect(result.description).toBe('');
      expect(result.requirements).toBe('');
    });
  });

  describe('Translation Methods', () => {
    it('should translate Bulgarian locations to English', () => {
      // Use reflection to access private method for testing
      const translateLocation = (scraper as any).translateLocation.bind(scraper);

      expect(translateLocation('София')).toBe('Sofia');
      expect(translateLocation('Пловдив')).toBe('Plovdiv');
      expect(translateLocation('Дистанционно')).toBe('Remote');
      expect(translateLocation('Unknown Location')).toBe('Unknown Location');
    });

    it('should translate Bulgarian work models', () => {
      const translateWorkModel = (scraper as any).translateWorkModel.bind(scraper);

      expect(translateWorkModel('Дистанционно')).toBe('remote');
      expect(translateWorkModel('Хибридно')).toBe('hybrid');
      expect(translateWorkModel('В офиса')).toBe('on-site');
      expect(translateWorkModel('Unknown')).toBe('full-time'); // fallback
    });

    it('should translate Bulgarian job titles and descriptions', () => {
      const translateText = (scraper as any).translateText.bind(scraper);

      expect(translateText('Старши Java Разработчик')).toContain('Senior');
      expect(translateText('Младши Програмист')).toContain('Junior');
      expect(translateText('Бекенд Инженер')).toContain('Backend');
    });
  });

  describe('Technology Extraction', () => {
    it('should extract technologies from job HTML', () => {
      const extractTechnologies = (scraper as any).extractTechnologiesFromElement.bind(scraper);

      // Create a mock jQuery element
      const jobHtml = `
        <div>
          Looking for Java developer with Spring experience.
          Must know MySQL, Docker, and REST APIs.
          Experience with Maven and Git is a plus.
        </div>
      `;

      const mockElement = {
        find: jest.fn().mockReturnValue({
          each: jest.fn(),
          eq: jest.fn().mockReturnValue({
            attr: jest.fn().mockReturnValue('Java'),
          }),
        }),
        text: jest.fn().mockReturnValue(jobHtml),
      };

      const technologies = extractTechnologies(mockElement);

      expect(Array.isArray(technologies)).toBe(true);
    });

    it('should handle HTML without technologies', () => {
      const extractTechnologies = (scraper as any).extractTechnologiesFromElement.bind(scraper);

      const mockElement = {
        find: jest.fn().mockReturnValue({
          each: jest.fn(),
        }),
        text: jest.fn().mockReturnValue('General software development position.'),
      };

      const technologies = extractTechnologies(mockElement);

      expect(Array.isArray(technologies)).toBe(true);
    });
  });
});