import { Test, TestingModule } from '@nestjs/testing';
import { JobParserService } from './job-parser.service';

describe('JobParserService - URL Extraction', () => {
  let service: JobParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JobParserService],
    }).compile();

    service = module.get<JobParserService>(JobParserService);
  });

  describe('extractCompanyUrls', () => {
    it('should extract valid company profile URLs', () => {
      const html = `
        <html>
          <body>
            <a href="/company/technologica/">TechnoLogica</a>
            <a href="/company/recruitment-bg/">Recruitment.bg</a>
            <a href="https://technologica.com">Company Website</a>
          </body>
        </html>
      `;

      const result = service.extractCompanyUrls(html);

      expect(result.profileUrl).toBe('https://dev.bg/company/technologica/');
      expect(result.website).toBe('https://technologica.com');
    });

    it('should reject generic company URLs without specific company identifier', () => {
      const html = `
        <html>
          <body>
            <a href="/company/">Generic Company Link</a>
            <a href="/company">Another Generic Link</a>
          </body>
        </html>
      `;

      const result = service.extractCompanyUrls(html);

      expect(result.profileUrl).toBeUndefined();
    });

    it('should filter out job board and social media URLs', () => {
      const html = `
        <html>
          <body>
            <a href="https://linkedin.com/company/test">LinkedIn</a>
            <a href="https://facebook.com/company/test">Facebook</a>
            <a href="https://jobboardfinder.com/jobboard-devbg-bulgaria">JobBoardFinder</a>
            <a href="https://indeed.com/company/test">Indeed</a>
            <a href="https://glassdoor.com/company/test">Glassdoor</a>
            <a href="https://technologica.com">Valid Company Website</a>
          </body>
        </html>
      `;

      const result = service.extractCompanyUrls(html);

      expect(result.website).toBe('https://technologica.com');
    });

    it('should handle multiple company profile URLs and return the first valid one', () => {
      const html = `
        <html>
          <body>
            <a href="/company/first-company/">First Company</a>
            <a href="/company/second-company/">Second Company</a>
          </body>
        </html>
      `;

      const result = service.extractCompanyUrls(html);

      expect(result.profileUrl).toBe('https://dev.bg/company/first-company/');
    });

    it('should handle absolute URLs for company profiles', () => {
      const html = `
        <html>
          <body>
            <a href="https://dev.bg/company/technologica/">TechnoLogica</a>
          </body>
        </html>
      `;

      const result = service.extractCompanyUrls(html);

      expect(result.profileUrl).toBe('https://dev.bg/company/technologica/');
    });

    it('should prefer links with website-related text for company websites', () => {
      const html = `
        <html>
          <body>
            <a href="https://random-site.com">Random Site</a>
            <a href="https://technologica.com">Website</a>
          </body>
        </html>
      `;

      const result = service.extractCompanyUrls(html);

      expect(result.website).toBe('https://technologica.com');
    });

    it('should handle Bulgarian text for website links', () => {
      const html = `
        <html>
          <body>
            <a href="https://technologica.com">Сайт</a>
          </body>
        </html>
      `;

      const result = service.extractCompanyUrls(html);

      expect(result.website).toBe('https://technologica.com');
    });

    it('should extract URLs from text content as fallback', () => {
      const html = `
        <html>
          <body>
            <p>Visit our website at https://technologica.com for more info</p>
          </body>
        </html>
      `;

      const result = service.extractCompanyUrls(html);

      expect(result.website).toBe('https://technologica.com');
    });

    it('should filter out job board URLs from text content', () => {
      const html = `
        <html>
          <body>
            <p>Visit https://dev.bg for more jobs</p>
            <p>Company website: https://technologica.com</p>
          </body>
        </html>
      `;

      const result = service.extractCompanyUrls(html);

      expect(result.website).toBe('https://technologica.com');
    });

    it('should handle empty HTML', () => {
      const html = '<html><body></body></html>';

      const result = service.extractCompanyUrls(html);

      expect(result.profileUrl).toBeUndefined();
      expect(result.website).toBeUndefined();
    });

    it('should handle malformed HTML gracefully', () => {
      const html = '<html><body><a href="/company/test-company/">Test</body>';

      const result = service.extractCompanyUrls(html);

      expect(result.profileUrl).toBe('https://dev.bg/company/test-company/');
    });

    it('should validate company URL patterns correctly', () => {
      const validUrls = [
        '/company/technologica/',
        '/company/recruitment-bg/',
        '/company/test-company-123/',
        '/company/company_name/'
      ];

      const invalidUrls = [
        '/company/',
        '/company',
        '/companies/test/',
        '/company//'
      ];

      for (const validUrl of validUrls) {
        const html = `<html><body><a href="${validUrl}">Test</a></body></html>`;
        const result = service.extractCompanyUrls(html);
        expect(result.profileUrl).toBe(`https://dev.bg${validUrl}`);
      }

      for (const invalidUrl of invalidUrls) {
        const html = `<html><body><a href="${invalidUrl}">Test</a></body></html>`;
        const result = service.extractCompanyUrls(html);
        expect(result.profileUrl).toBeUndefined();
      }
    });

    it('should match common website patterns', () => {
      const websitePatterns = [
        'https://www.technologica.com',
        'https://technologica.bg',
        'https://company.org',
        'https://startup.net',
        'https://tech.io',
        'https://business.eu'
      ];

      for (const website of websitePatterns) {
        const html = `<html><body><a href="${website}">Website</a></body></html>`;
        const result = service.extractCompanyUrls(html);
        expect(result.website).toBe(website);
      }
    });

    it('should prioritize link elements over text content', () => {
      const html = `
        <html>
          <body>
            <a href="https://primary-website.com">Website</a>
            <p>Also visit https://secondary-website.com</p>
          </body>
        </html>
      `;

      const result = service.extractCompanyUrls(html);

      expect(result.website).toBe('https://primary-website.com');
    });
  });
});