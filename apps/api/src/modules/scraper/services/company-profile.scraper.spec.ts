import { Test, TestingModule } from '@nestjs/testing';
import { CompanyProfileScraper } from './company-profile.scraper';

// Mock Playwright
const mockPage = {
  goto: jest.fn(),
  content: jest.fn(),
  $eval: jest.fn(),
  $$eval: jest.fn(),
  waitForSelector: jest.fn(),
  waitForTimeout: jest.fn(),
  close: jest.fn(),
};

const mockBrowser = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn(),
};

const mockPlaywright = {
  chromium: {
    launch: jest.fn().mockResolvedValue(mockBrowser),
  },
};

jest.mock('playwright', () => mockPlaywright);

describe('CompanyProfileScraper', () => {
  let service: CompanyProfileScraper;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CompanyProfileScraper],
    }).compile();

    service = module.get<CompanyProfileScraper>(CompanyProfileScraper);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateCompanyUrl', () => {
    it('should validate dev.bg company URL as valid', async () => {
      // Act
      const result = await service.validateCompanyUrl('https://dev.bg/company/example-company/');

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate standard company website URL as valid', async () => {
      // Act
      const result = await service.validateCompanyUrl('https://example-company.com');

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate HTTPS company website URL as valid', async () => {
      // Act
      const result = await service.validateCompanyUrl('https://www.example-company.com/about');

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid URLs', async () => {
      // Act
      const result = await service.validateCompanyUrl('not-a-url');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });

    it('should reject non-HTTP/HTTPS URLs', async () => {
      // Act
      const result = await service.validateCompanyUrl('ftp://example.com');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Only HTTP/HTTPS URLs are supported');
    });

    it('should reject URLs with suspicious content', async () => {
      // Act
      const result = await service.validateCompanyUrl('https://example.com/admin/delete?all=true');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('URL appears to contain suspicious content');
    });

    it('should reject localhost URLs in production', async () => {
      // Act
      const result = await service.validateCompanyUrl('http://localhost:3000/company');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Localhost URLs are not allowed');
    });

    it('should reject common non-company domains', async () => {
      // Act
      const result = await service.validateCompanyUrl('https://facebook.com/company');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('URL appears to be from a social media or non-company domain');
    });
  });

  describe('scrapeDevBgCompanyProfile', () => {
    const testUrl = 'https://dev.bg/company/example-company/';

    beforeEach(() => {
      // Setup default mocks
      mockPage.goto.mockResolvedValue(null);
      mockPage.waitForTimeout.mockResolvedValue(null);
    });

    it('should successfully scrape dev.bg company profile with complete information', async () => {
      // Arrange
      const mockContent = `
        <div class="company-profile">
          <h1>Example Company</h1>
          <div class="company-description">
            <p>Leading software development company specializing in web applications.</p>
          </div>
          <div class="company-details">
            <div class="detail">
              <label>Industry:</label>
              <span>Technology</span>
            </div>
            <div class="detail">
              <label>Company size:</label>
              <span>100-500</span>
            </div>
            <div class="detail">
              <label>Location:</label>
              <span>Sofia, Bulgaria</span>
            </div>
          </div>
          <div class="technologies">
            <span class="tech">JavaScript</span>
            <span class="tech">TypeScript</span>
            <span class="tech">React</span>
          </div>
        </div>
      `;

      mockPage.content.mockResolvedValue(mockContent);
      mockPage.$eval
        .mockResolvedValueOnce('Example Company') // Company name
        .mockResolvedValueOnce('Leading software development company specializing in web applications.') // Description
        .mockResolvedValueOnce('Technology') // Industry
        .mockResolvedValueOnce('100-500') // Size
        .mockResolvedValueOnce('Sofia, Bulgaria'); // Location

      mockPage.$$eval.mockResolvedValue(['JavaScript', 'TypeScript', 'React']); // Technologies

      // Act
      const result = await service.scrapeDevBgCompanyProfile(testUrl);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.name).toBe('Example Company');
      expect(result.data!.description).toBe('Leading software development company specializing in web applications.');
      expect(result.data!.industry).toBe('Technology');
      expect(result.data!.size).toBe('100-500');
      expect(result.data!.location).toBe('Sofia, Bulgaria');
      expect(result.data!.technologies).toEqual(['JavaScript', 'TypeScript', 'React']);
      expect(result.data!.rawContent).toBe(mockContent);

      // Verify browser interactions
      expect(mockBrowser.newPage).toHaveBeenCalled();
      expect(mockPage.goto).toHaveBeenCalledWith(testUrl, { waitUntil: 'networkidle' });
      expect(mockPage.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle missing optional fields gracefully', async () => {
      // Arrange
      const mockContent = `
        <div class="company-profile">
          <h1>Minimal Company</h1>
        </div>
      `;

      mockPage.content.mockResolvedValue(mockContent);
      mockPage.$eval
        .mockResolvedValueOnce('Minimal Company') // Company name
        .mockRejectedValueOnce(new Error('Element not found')) // Description - missing
        .mockRejectedValueOnce(new Error('Element not found')) // Industry - missing
        .mockRejectedValueOnce(new Error('Element not found')) // Size - missing
        .mockRejectedValueOnce(new Error('Element not found')); // Location - missing

      mockPage.$$eval.mockResolvedValue([]); // No technologies

      // Act
      const result = await service.scrapeDevBgCompanyProfile(testUrl);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.name).toBe('Minimal Company');
      expect(result.data!.description).toBeNull();
      expect(result.data!.industry).toBeNull();
      expect(result.data!.size).toBeNull();
      expect(result.data!.location).toBeNull();
      expect(result.data!.technologies).toEqual([]);
    });

    it('should handle navigation failures', async () => {
      // Arrange
      const navigationError = new Error('Navigation failed');
      mockPage.goto.mockRejectedValue(navigationError);

      // Act
      const result = await service.scrapeDevBgCompanyProfile(testUrl);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to load page');
      expect(result.data).toBeNull();

      // Verify cleanup
      expect(mockPage.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle timeout errors', async () => {
      // Arrange
      const timeoutError = new Error('Navigation timeout');
      mockPage.goto.mockRejectedValue(timeoutError);

      // Act
      const result = await service.scrapeDevBgCompanyProfile(testUrl);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to load page');
    });

    it('should handle missing company name as error', async () => {
      // Arrange
      mockPage.content.mockResolvedValue('<div>No company name here</div>');
      mockPage.$eval.mockRejectedValue(new Error('Company name not found'));

      // Act
      const result = await service.scrapeDevBgCompanyProfile(testUrl);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to extract company name');
    });
  });

  describe('scrapeCompanyWebsite', () => {
    const testUrl = 'https://example-company.com';

    beforeEach(() => {
      mockPage.goto.mockResolvedValue(null);
      mockPage.waitForTimeout.mockResolvedValue(null);
    });

    it('should successfully scrape company website with basic information', async () => {
      // Arrange
      const mockContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Example Company - Leading Tech Solutions</title>
            <meta name="description" content="We provide innovative technology solutions for businesses worldwide.">
          </head>
          <body>
            <header>
              <h1>Example Company</h1>
              <nav>
                <a href="/about">About</a>
                <a href="/services">Services</a>
                <a href="/contact">Contact</a>
              </nav>
            </header>
            <main>
              <section class="hero">
                <h2>Innovation at its finest</h2>
                <p>We are a leading technology company providing cutting-edge solutions.</p>
              </section>
              <section class="services">
                <h2>Our Technologies</h2>
                <p>We specialize in JavaScript, Python, AWS, and modern web frameworks.</p>
              </section>
            </main>
          </body>
        </html>
      `;

      mockPage.content.mockResolvedValue(mockContent);
      mockPage.$eval
        .mockResolvedValueOnce('Example Company - Leading Tech Solutions') // Title
        .mockResolvedValueOnce('We provide innovative technology solutions for businesses worldwide.'); // Meta description

      // Act
      const result = await service.scrapeCompanyWebsite(testUrl);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.name).toBe('Example Company');
      expect(result.data!.description).toBe('We provide innovative technology solutions for businesses worldwide.');
      expect(result.data!.rawContent).toBe(mockContent);

      // Verify browser interactions
      expect(mockPage.goto).toHaveBeenCalledWith(testUrl, { waitUntil: 'networkidle' });
    });

    it('should extract company name from URL when title extraction fails', async () => {
      // Arrange
      const mockContent = '<html><body>Content without clear company name</body></html>';

      mockPage.content.mockResolvedValue(mockContent);
      mockPage.$eval
        .mockRejectedValueOnce(new Error('Title not found')) // Title extraction fails
        .mockResolvedValueOnce('Company description from meta'); // Meta description works

      // Act
      const result = await service.scrapeCompanyWebsite('https://awesome-tech-solutions.com/about');

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.name).toBe('Awesome Tech Solutions'); // Extracted from domain
      expect(result.data!.description).toBe('Company description from meta');
    });

    it('should handle websites with no meta description', async () => {
      // Arrange
      const mockContent = '<html><head><title>Simple Company</title></head><body>Content</body></html>';

      mockPage.content.mockResolvedValue(mockContent);
      mockPage.$eval
        .mockResolvedValueOnce('Simple Company') // Title works
        .mockRejectedValueOnce(new Error('Meta description not found')); // No meta description

      // Act
      const result = await service.scrapeCompanyWebsite(testUrl);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data!.name).toBe('Simple Company');
      expect(result.data!.description).toBeNull();
    });

    it('should handle network errors during website scraping', async () => {
      // Arrange
      const networkError = new Error('ENOTFOUND');
      mockPage.goto.mockRejectedValue(networkError);

      // Act
      const result = await service.scrapeCompanyWebsite(testUrl);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to load website');
      expect(result.data).toBeNull();
    });

    it('should handle browser launch failures', async () => {
      // Arrange
      mockPlaywright.chromium.launch.mockRejectedValueOnce(new Error('Browser launch failed'));

      // Act
      const result = await service.scrapeCompanyWebsite(testUrl);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to initialize browser');
    });
  });

  describe('error handling and cleanup', () => {
    it('should properly clean up browser resources on success', async () => {
      // Arrange
      mockPage.content.mockResolvedValue('<html><head><title>Test Company</title></head></html>');
      mockPage.$eval.mockResolvedValue('Test Company');

      // Act
      await service.scrapeDevBgCompanyProfile('https://dev.bg/company/test/');

      // Assert
      expect(mockPage.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should properly clean up browser resources on error', async () => {
      // Arrange
      mockPage.goto.mockRejectedValue(new Error('Navigation failed'));

      // Act
      await service.scrapeDevBgCompanyProfile('https://dev.bg/company/test/');

      // Assert
      expect(mockPage.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle page close errors gracefully', async () => {
      // Arrange
      mockPage.content.mockResolvedValue('<html><head><title>Test</title></head></html>');
      mockPage.$eval.mockResolvedValue('Test Company');
      mockPage.close.mockRejectedValue(new Error('Close failed'));

      // Act & Assert
      const result = await service.scrapeDevBgCompanyProfile('https://dev.bg/company/test/');
      
      // Should still succeed despite close error
      expect(result.success).toBe(true);
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('content extraction edge cases', () => {
    it('should handle empty content gracefully', async () => {
      // Arrange
      mockPage.content.mockResolvedValue('');
      mockPage.$eval.mockRejectedValue(new Error('No content'));

      // Act
      const result = await service.scrapeDevBgCompanyProfile('https://dev.bg/company/empty/');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to extract company name');
    });

    it('should trim whitespace from extracted data', async () => {
      // Arrange
      const mockContent = '<div>Content with spaces</div>';
      
      mockPage.content.mockResolvedValue(mockContent);
      mockPage.$eval
        .mockResolvedValueOnce('  Spaced Company Name  ')
        .mockResolvedValueOnce('  Description with spaces  ');

      // Act
      const result = await service.scrapeCompanyWebsite('https://example.com');

      // Assert
      expect(result.success).toBe(true);
      expect(result.data!.name).toBe('Spaced Company Name');
      expect(result.data!.description).toBe('Description with spaces');
    });

    it('should handle very long content appropriately', async () => {
      // Arrange
      const longContent = 'A'.repeat(50000); // 50KB content
      
      mockPage.content.mockResolvedValue(`<html><body>${longContent}</body></html>`);
      mockPage.$eval.mockResolvedValue('Long Content Company');

      // Act
      const result = await service.scrapeCompanyWebsite('https://example.com');

      // Assert
      expect(result.success).toBe(true);
      expect(result.data!.rawContent).toContain(longContent);
    });
  });
});