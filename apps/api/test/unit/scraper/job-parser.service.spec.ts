import { JobParserService } from '../../../src/modules/scraper/services/job-parser.service';
import { DateUtils } from '../../../src/modules/scraper/utils/date.utils';
import * as cheerio from 'cheerio';

describe('JobParserService', () => {
  let service: JobParserService;
  let dateUtils: DateUtils;

  beforeEach(() => {
    dateUtils = new DateUtils();
    service = new JobParserService(dateUtils);
  });

  describe('parseJobFromElement', () => {
    it('should parse complete job data from HTML element', () => {
      const html = `
        <div class="job-list-item">
          <h6 class="job-title">Senior Java Developer</h6>
          <div class="company-name">TechCorp</div>
          <a class="overlay-link" href="/job/123"></a>
          <div class="badge">София\nДистанционно</div>
          <div class="salary">3000-5000 лв</div>
          <time datetime="2024-01-15">15 януари</time>
          <img title="Java" src="java.png">
          <img title="Spring" src="spring.png">
        </div>
      `;

      const $ = cheerio.load(html);
      const element = $('.job-list-item').get(0);
      const result = service.parseJobFromElement($, element);

      expect(result).toBeDefined();
      expect(result!.title).toBe('Senior Java Developer');
      expect(result!.company).toBe('TechCorp');
      expect(result!.url).toBe('/job/123');
      expect(result!.badgeText).toContain('София');
      expect(result!.salaryRange).toBe('3000-5000 лв');
      expect(result!.timeElement?.datetime).toBe('2024-01-15');
      expect(result!.techImageTitles).toContain('java');
      expect(result!.techImageTitles).toContain('spring');
    });

    it('should handle missing optional elements gracefully', () => {
      const html = `
        <div class="job-list-item">
          <h6 class="job-title">Developer</h6>
          <div class="company-name">Company</div>
        </div>
      `;

      const $ = cheerio.load(html);
      const element = $('.job-list-item').get(0);
      const result = service.parseJobFromElement($, element);

      expect(result).toBeDefined();
      expect(result!.title).toBe('Developer');
      expect(result!.company).toBe('Company');
      expect(result!.url).toBe('');
      expect(result!.badgeText).toBe('');
      expect(result!.salaryRange).toBeUndefined();
      expect(result!.timeElement).toBeUndefined();
      expect(result!.techImageTitles).toEqual([]);
    });

    it('should return null for invalid job data', () => {
      const html = `
        <div class="job-list-item">
          <div class="some-other-element">Not a job</div>
        </div>
      `;

      const $ = cheerio.load(html);
      const element = $('.job-list-item').get(0);
      const result = service.parseJobFromElement($, element);

      expect(result).toBeNull();
    });

    it('should handle alternative selectors for job elements', () => {
      const html = `
        <div class="job-list-item">
          <div class="job-title">Alternative Title</div>
          <div class="company-name">Company</div>
          <a class="overlay-link" href="/job/456">Job Link</a>
        </div>
      `;

      const $ = cheerio.load(html);
      const element = $('.job-list-item').get(0);
      const result = service.parseJobFromElement($, element);

      expect(result).toBeDefined();
      expect(result!.title).toBe('Alternative Title');
      expect(result!.url).toBe('/job/456');
    });
  });

  describe('parseJobDetailsFromHtml', () => {
    it('should extract job description and requirements', () => {
      const html = `
        <html>
          <div class="job-description">
            <p>This is a great <b>job opportunity</b> for developers.</p>
            <ul><li>Work with modern technologies</li></ul>
          </div>
          <div class="job-requirements">
            <p>Requirements:</p>
            <ul><li>3+ years experience</li><li>Java knowledge</li></ul>
          </div>
        </html>
      `;

      const result = service.parseJobDetailsFromHtml(html);

      expect(result.description).toContain('This is a great job opportunity');
      expect(result.description).toContain('Work with modern technologies');
      expect(result.description).not.toContain('<b>');
      expect(result.description).not.toContain('<ul>');

      expect(result.requirements).toContain('Requirements:');
      expect(result.requirements).toContain('3+ years experience');
      expect(result.requirements).toContain('Java knowledge');
    });

    it('should handle missing description and requirements', () => {
      const html = `
        <html>
          <div class="some-other-content">
            <p>This is not a job description</p>
          </div>
        </html>
      `;

      const result = service.parseJobDetailsFromHtml(html);

      expect(result.description).toBe('');
      expect(result.requirements).toBe('');
    });

    it('should strip HTML tags properly', () => {
      const html = `
        <div class="job-description">
          <p>Job with <a href="#">links</a> and <span class="highlight">spans</span>.</p>
        </div>
      `;

      const result = service.parseJobDetailsFromHtml(html);
      
      expect(result.description).toBe('Job with links and spans.');
      expect(result.description).not.toContain('<a');
      expect(result.description).not.toContain('<span');
    });
  });

  describe('findBulgarianDateInText', () => {
    it('should find Bulgarian date patterns in text', () => {
      const text = 'Posted on 15 януари and expires soon';
      const result = service.findBulgarianDateInText(text);
      
      expect(result).toBe('15 януари');
    });

    it('should find different month names', () => {
      const textMarch = 'Updated 5 март 2024';
      const textDecember = 'Created 25 декември';
      
      expect(service.findBulgarianDateInText(textMarch)).toBe('5 март');
      expect(service.findBulgarianDateInText(textDecember)).toBe('25 декември');
    });

    it('should handle single digit days', () => {
      const text = 'Date: 1 февруари';
      const result = service.findBulgarianDateInText(text);
      
      expect(result).toBe('1 февруари');
    });

    it('should be case insensitive', () => {
      const text = 'Posted 15 ЯНУАРИ';
      const result = service.findBulgarianDateInText(text);
      
      expect(result).toBe('15 ЯНУАРИ');
    });

    it('should return null when no date pattern found', () => {
      const text = 'No date pattern in this text';
      const result = service.findBulgarianDateInText(text);
      
      expect(result).toBeNull();
    });

    it('should find first occurrence when multiple dates exist', () => {
      const text = 'From 1 януари to 15 февруари';
      const result = service.findBulgarianDateInText(text);
      
      expect(result).toBe('1 януари');
    });
  });

  describe('error handling', () => {
    it('should handle malformed HTML gracefully', () => {
      const malformedHtml = '<div><unclosed><tag>content';
      
      expect(() => {
        service.parseJobDetailsFromHtml(malformedHtml);
      }).not.toThrow();
    });

    it('should handle null/undefined inputs', () => {
      expect(service.findBulgarianDateInText('')).toBeNull();
      
      const $ = cheerio.load('<div></div>');
      const result = service.parseJobFromElement($, null);
      expect(result).toBeNull();
    });
  });
});