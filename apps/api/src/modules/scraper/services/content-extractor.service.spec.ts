import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { 
  ContentExtractorService, 
  ContentExtractionResult, 
  ExtractionOptions 
} from './content-extractor.service';

describe('ContentExtractorService', () => {
  let service: ContentExtractorService;
  let _configService: jest.Mocked<ConfigService>;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Mock Logger
    loggerSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    // Mock ConfigService
    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentExtractorService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ContentExtractorService>(ContentExtractorService);
    _configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('extractContent', () => {
    const sampleUrl = 'https://dev.bg/job/12345';

    it('should extract content with default options', async () => {
      const html = `
        <html>
          <head><title>Software Engineer</title></head>
          <body>
            <main>
              <h1>Senior JavaScript Developer</h1>
              <div class="job-description">
                <p>We are looking for an experienced JavaScript developer.</p>
                <ul>
                  <li>3+ years experience</li>
                  <li>React knowledge required</li>
                </ul>
              </div>
            </main>
            <script>analytics.track('view');</script>
          </body>
        </html>
      `;

      const result = await service.extractContent(html, sampleUrl);

      expect(result.title).toBe('Senior JavaScript Developer');
      expect(result.content).toContain('experienced JavaScript developer');
      expect(result.cleanedContent).toContain('JavaScript developer');
      expect(result.cleanedContent).not.toContain('analytics.track');
      
      expect(result.metadata).toMatchObject({
        originalLength: html.length,
        sourceUrl: sampleUrl,
        hasStructuredData: false,
        extractedAt: expect.any(Date),
      });
      
      expect(result.metadata.cleanedLength).toBeLessThan(result.metadata.originalLength);
      expect(result.metadata.compressionRatio).toBeGreaterThan(0);
    });

    it('should extract content with custom options', async () => {
      const html = `
        <html>
          <body>
            <main>
              <h1>Job Title</h1>
              <p>Description with <a href="http://example.com">link</a></p>
              <img src="image.jpg" alt="Company logo">
              <div>More content here that should be preserved</div>
            </main>
          </body>
        </html>
      `;

      const options: ExtractionOptions = {
        maxContentLength: 100,
        removeImages: false,
        removeLinks: true,
        aggressiveCleaning: true,
        extractMetadata: false,
      };

      const result = await service.extractContent(html, sampleUrl, options);

      expect(result.cleanedContent.length).toBeLessThanOrEqual(103); // 100 + '...'
      expect(result.cleanedContent).not.toContain('http://example.com');
      expect(result.metadata.originalLength).toBe(html.length);
    });

    it('should handle HTML without title', async () => {
      const html = `
        <html>
          <body>
            <main>
              <div>Content without title</div>
            </main>
          </body>
        </html>
      `;

      const result = await service.extractContent(html, sampleUrl);

      expect(result.title).toBeNull();
      expect(result.content).toContain('Content without title');
    });

    it('should extract title from various selectors in priority order', async () => {
      const html = `
        <html>
          <head><title>Page Title</title></head>
          <body>
            <h1>Primary Heading</h1>
            <h2>Secondary Heading</h2>
            <div class="job-title">Job Position</div>
          </body>
        </html>
      `;

      const result = await service.extractContent(html, sampleUrl);

      expect(result.title).toBe('Primary Heading'); // h1 has higher priority than title
    });

    it('should handle title length validation', async () => {
      const html = `
        <html>
          <body>
            <h1>Hi</h1>
            <h2>This is a reasonable length title for a job posting</h2>
          </body>
        </html>
      `;

      const result = await service.extractContent(html, sampleUrl);

      expect(result.title).toBe('This is a reasonable length title for a job posting'); // h1 too short, h2 used
    });

    it('should remove unwanted elements based on options', async () => {
      const html = `
        <html>
          <body>
            <main>Job content</main>
            <script>alert('test');</script>
            <style>body { color: red; }</style>
            <nav>Navigation</nav>
            <img src="test.jpg" alt="Test">
            <aside>Sidebar</aside>
          </body>
        </html>
      `;

      const result = await service.extractContent(html, sampleUrl, { 
        removeImages: true, 
        aggressiveCleaning: true 
      });

      expect(result.content).not.toContain('alert');
      expect(result.content).not.toContain('color: red');
      expect(result.content).toContain('Job content');
    });

    it('should use largest text block strategy when main selectors fail', async () => {
      const html = `
        <html>
          <body>
            <div>Short text</div>
            <div>This is a much longer piece of content that should be selected as the main content because it contains more meaningful information about the job posting</div>
            <div>Another short piece</div>
          </body>
        </html>
      `;

      const result = await service.extractContent(html, sampleUrl);

      expect(result.content).toContain('much longer piece of content');
    });

    it('should fallback to body text when no good content found', async () => {
      const html = `
        <html>
          <body>
            <div>A</div>
            <div>B</div>
            <span>Some body content here</span>
          </body>
        </html>
      `;

      const result = await service.extractContent(html, sampleUrl);

      expect(result.content).toContain('Some body content');
    });

    it('should clean content by removing noise patterns', async () => {
      const html = `
        <html>
          <body>
            <main>
              <p>Job description here.</p>
              <p>Please accept our cookies and privacy policy.</p>
              <p>Follow us on social media and subscribe to our newsletter.</p>
              <p>Share this on Facebook and LinkedIn.</p>
              <p>This is sponsored content and advertisement.</p>
              <p>More job details (with parenthetical notes).</p>
            </main>
          </body>
        </html>
      `;

      const result = await service.extractContent(html, sampleUrl);

      expect(result.cleanedContent).toContain('Job description');
      expect(result.cleanedContent).toContain('More job details');
      expect(result.cleanedContent).not.toContain('accept our cookies');
      expect(result.cleanedContent).not.toContain('Follow us');
      expect(result.cleanedContent).not.toContain('Share this');
      expect(result.cleanedContent).not.toContain('sponsored');
      expect(result.cleanedContent).not.toContain('(with parenthetical notes)');
    });

    it('should remove URLs and emails when removeLinks is true', async () => {
      const html = `
        <html>
          <body>
            <main>
              <p>Contact us at jobs@company.com or visit https://company.com/careers</p>
              <p>Regular content without links</p>
            </main>
          </body>
        </html>
      `;

      const result = await service.extractContent(html, sampleUrl, { removeLinks: true });

      expect(result.cleanedContent).not.toContain('jobs@company.com');
      expect(result.cleanedContent).not.toContain('https://company.com');
      expect(result.cleanedContent).toContain('Regular content');
    });

    it('should truncate content at word boundaries', async () => {
      const longContent = 'word '.repeat(200);
      const html = `<html><body><main><p>${longContent}</p></main></body></html>`;

      const result = await service.extractContent(html, sampleUrl, { maxContentLength: 100 });

      expect(result.cleanedContent.length).toBeLessThanOrEqual(103);
      expect(result.cleanedContent).toEndWith('...');
      expect(result.cleanedContent).not.toMatch(/\w+\.\.\.$/); // Should not cut words
    });

    it('should detect content sections in metadata', async () => {
      const html = `
        <html>
          <body>
            <h1>Title</h1>
            <h2>Subtitle</h2>
            <ul><li>Item 1</li><li>Item 2</li></ul>
            <table><tr><td>Data</td></tr></table>
            <p>Para 1</p><p>Para 2</p><p>Para 3</p><p>Para 4</p><p>Para 5</p><p>Para 6</p>
          </body>
        </html>
      `;

      const result = await service.extractContent(html, sampleUrl);

      expect(result.metadata.contentSections).toContain('headings');
      expect(result.metadata.contentSections).toContain('lists');
      expect(result.metadata.contentSections).toContain('tables');
      expect(result.metadata.contentSections).toContain('paragraphs');
    });

    it('should detect structured data', async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">{"@type": "JobPosting"}</script>
          </head>
          <body>
            <div itemscope itemtype="http://schema.org/JobPosting">Job content</div>
            <meta property="og:title" content="Job Title">
          </body>
        </html>
      `;

      const result = await service.extractContent(html, sampleUrl);

      expect(result.metadata.hasStructuredData).toBe(true);
    });

    it('should handle parsing errors with fallback', async () => {
      // Mock cheerio to throw an error
      const cheerio = await import('cheerio');
      jest.doMock('cheerio', () => ({
        ...cheerio.default,
        load: jest.fn().mockImplementation(() => {
          throw new Error('Parsing failed');
        }),
      }));

      const html = '<html><body><p>Test content</p><script>bad script</script></body></html>';

      const result = await service.extractContent(html, sampleUrl);

      expect(result.title).toBeNull();
      expect(result.content).toContain('Test content');
      expect(result.content).not.toContain('<script>');
      expect(result.metadata.contentSections).toContain('fallback');

      jest.unmock('cheerio');
    });
  });

  describe('preprocessHtml', () => {
    const sampleUrl = 'https://dev.bg/job/12345';

    it('should preprocess HTML with default options', async () => {
      const html = `
        <html>
          <body>
            <main>
              <h1>Job Title</h1>
              <p>Job description content</p>
              <ul>
                <li>Requirement 1</li>
                <li>Requirement 2</li>
              </ul>
            </main>
            <script>analytics.track();</script>
            <nav>Navigation</nav>
          </body>
        </html>
      `;

      const result = await service.preprocessHtml(html, sampleUrl);

      expect(result.markdown).toContain('# Job Title');
      expect(result.markdown).toContain('- Requirement 1');
      expect(result.markdown).toContain('- Requirement 2');
      expect(result.markdown).not.toContain('analytics.track');
      expect(result.markdown).not.toContain('Navigation');
      
      expect(result.metadata.originalSize).toBe(html.length);
      expect(result.metadata.processedSize).toBeLessThan(html.length);
      expect(result.metadata.compressionRatio).toBeGreaterThan(0);
      expect(result.metadata.tokensEstimate).toBeGreaterThan(0);
    });

    it('should extract dev.bg specific sections', async () => {
      const html = `
        <html>
          <body>
            <h1 class="job-title">Senior Developer Position</h1>
            <div class="job_description">Detailed job description here</div>
            <div class="job-requirements">Must have 5+ years experience</div>
            <div class="benefits">Health insurance and remote work</div>
            <div class="company-info">About our company</div>
            <div class="salary">$80,000 - $100,000</div>
            <div class="location">Sofia, Bulgaria</div>
          </body>
        </html>
      `;

      const result = await service.preprocessHtml(html, sampleUrl);

      expect(result.sections.title).toBe('Senior Developer Position');
      expect(result.sections.description).toBe('Detailed job description here');
      expect(result.sections.requirements).toBe('Must have 5+ years experience');
      expect(result.sections.benefits).toBe('Health insurance and remote work');
      expect(result.sections.companyInfo).toBe('About our company');
      expect(result.sections.salary).toBe('$80,000 - $100,000');
      expect(result.sections.location).toBe('Sofia, Bulgaria');
      
      expect(result.metadata.sectionCount).toBe(7);
    });

    it('should convert HTML to markdown properly', async () => {
      const html = `
        <html>
          <body>
            <h1>Main Title</h1>
            <h2>Subtitle</h2>
            <p>Paragraph with <strong>bold text</strong> and <em>italic text</em></p>
            <ul>
              <li>Unordered item 1</li>
              <li>Unordered item 2</li>
            </ul>
            <ol>
              <li>Ordered item 1</li>
              <li>Ordered item 2</li>
            </ol>
          </body>
        </html>
      `;

      const result = await service.preprocessHtml(html, sampleUrl);

      expect(result.markdown).toContain('# Main Title');
      expect(result.markdown).toContain('## Subtitle');
      expect(result.markdown).toContain('**bold text**');
      expect(result.markdown).toContain('*italic text*');
      expect(result.markdown).toContain('- Unordered item 1');
      expect(result.markdown).toContain('1. Ordered item 1');
    });

    it('should optimize content for AI consumption', async () => {
      const longContent = 'A very long piece of content. '.repeat(1000);
      const html = `
        <html>
          <body>
            <h1>Title</h1>
            <p>${longContent}</p>
            <h2>Another Section</h2>
            <p>More content here</p>
          </body>
        </html>
      `;

      const result = await service.preprocessHtml(html, sampleUrl, { 
        maxTokens: 100, 
        optimizeForAI: true 
      });

      expect(result.markdown.length).toBeLessThan(longContent.length);
      expect(result.metadata.tokensEstimate).toBeLessThanOrEqual(100);
    });

    it('should disable markdown conversion when requested', async () => {
      const html = `
        <html>
          <body>
            <h1>Title</h1>
            <p>Content</p>
          </body>
        </html>
      `;

      const result = await service.preprocessHtml(html, sampleUrl, { 
        convertToMarkdown: false 
      });

      expect(result.markdown).toBe('');
      expect(result.html).toContain('Title');
      expect(result.html).toContain('Content');
    });

    it('should handle preprocessing errors with fallback', async () => {
      // Mock cheerio to throw an error
      const cheerio = await import('cheerio');
      jest.doMock('cheerio', () => ({
        ...cheerio.default,
        load: jest.fn().mockImplementation(() => {
          throw new Error('Preprocessing failed');
        }),
      }));

      const html = '<html><body><p>Test content</p><script>bad script</script></body></html>';

      const result = await service.preprocessHtml(html, sampleUrl);

      expect(result.markdown).toBe('');
      expect(result.html).toContain('Test content');
      expect(result.html).not.toContain('<script>');
      expect(result.sections).toEqual({});
      expect(result.metadata.sectionCount).toBe(0);

      jest.unmock('cheerio');
    });

    it('should clean markdown by removing excessive formatting', async () => {
      // Test the private cleanMarkdown method indirectly
      const html = `
        <html>
          <body>
            <h1>   Title with spaces   </h1>
            

            <p>Paragraph with



            multiple newlines</p>
            <h2></h2>
            <ul><li></li></ul>
          </body>
        </html>
      `;

      const result = await service.preprocessHtml(html, sampleUrl);

      expect(result.markdown).not.toMatch(/\n{3,}/); // No excessive newlines
      expect(result.markdown).not.toMatch(/[ \t]+$/m); // No trailing spaces
      expect(result.markdown).not.toContain('##  \n'); // No empty headers
    });

    it('should optimize for AI by truncating at logical boundaries', async () => {
      const html = `
        <html>
          <body>
            <h1>Section 1</h1>
            <p>${'Content of section 1. '.repeat(100)}</p>
            <h2>Section 2</h2>
            <p>${'Content of section 2. '.repeat(100)}</p>
            <h3>Section 3</h3>
            <p>${'Content of section 3. '.repeat(100)}</p>
          </body>
        </html>
      `;

      const result = await service.preprocessHtml(html, sampleUrl, { 
        maxTokens: 200,
        optimizeForAI: true 
      });

      expect(result.markdown).toContain('Section 1');
      expect(result.metadata.tokensEstimate).toBeLessThanOrEqual(200);
    });
  });

  describe('detectLanguage', () => {
    it('should detect English content', async () => {
      const html = `
        <html>
          <body>
            <main>
              <p>This is an English job description with common words like the, and, for, are, but, not, you, all, can, had, her, was, one, our, out, day, get, has, him, his, how</p>
            </main>
          </body>
        </html>
      `;

      const result = await service.extractContent(html, 'https://example.com');
      expect(result.metadata.detectedLanguage).toBe('en');
    });

    it('should detect Bulgarian content', async () => {
      const html = `
        <html>
          <body>
            <main>
              <p>Търсим програмист за нашата компания. Изискванията са опит с JavaScript, React и добри познания по програмиране. Заплатата е добра и работим в екип.</p>
            </main>
          </body>
        </html>
      `;

      const result = await service.extractContent(html, 'https://dev.bg/job/123');
      expect(result.metadata.detectedLanguage).toBe('bg');
    });

    it('should return unknown for unrecognized languages', async () => {
      const html = `
        <html>
          <body>
            <main>
              <p>こんにちは世界、プログラマーを探しています</p>
            </main>
          </body>
        </html>
      `;

      const result = await service.extractContent(html, 'https://example.com');
      expect(result.metadata.detectedLanguage).toBe('unknown');
    });

    it('should require minimum matches for confidence', async () => {
      const html = `
        <html>
          <body>
            <main>
              <p>Short text</p>
            </main>
          </body>
        </html>
      `;

      const result = await service.extractContent(html, 'https://example.com');
      expect(result.metadata.detectedLanguage).toBe('unknown');
    });
  });

  describe('validateContentQuality', () => {
    it('should return high score for quality content', () => {
      const result: ContentExtractionResult = {
        title: 'Senior JavaScript Developer',
        content: 'Original content here',
        cleanedContent: 'This is a substantial piece of content with good length and diverse vocabulary containing many different words and concepts',
        metadata: {
          originalLength: 1000,
          cleanedLength: 100,
          compressionRatio: 0.5,
          extractedAt: new Date(),
          sourceUrl: 'https://example.com',
          detectedLanguage: 'en',
          hasStructuredData: true,
          contentSections: ['headings', 'paragraphs', 'lists'],
        },
      };

      const validation = service.validateContentQuality(result);

      expect(validation.score).toBeGreaterThan(80);
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should penalize short content', () => {
      const result: ContentExtractionResult = {
        title: 'Job',
        content: 'Short',
        cleanedContent: 'Too short',
        metadata: {
          originalLength: 100,
          cleanedLength: 9,
          compressionRatio: 0.09,
          extractedAt: new Date(),
          sourceUrl: 'https://example.com',
          hasStructuredData: false,
          contentSections: [],
        },
      };

      const validation = service.validateContentQuality(result);

      expect(validation.score).toBeLessThan(50);
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Content too short');
      expect(validation.issues).toContain('Low content density (too much markup)');
      expect(validation.issues).toContain('Limited content structure');
    });

    it('should penalize missing title', () => {
      const result: ContentExtractionResult = {
        title: null,
        content: 'Content without title',
        cleanedContent: 'This is a reasonable amount of content but without a proper title extracted from the page',
        metadata: {
          originalLength: 200,
          cleanedLength: 100,
          compressionRatio: 0.5,
          extractedAt: new Date(),
          sourceUrl: 'https://example.com',
          hasStructuredData: false,
          contentSections: ['paragraphs'],
        },
      };

      const validation = service.validateContentQuality(result);

      expect(validation.issues).toContain('No title extracted');
      expect(validation.score).toBeLessThan(100);
    });

    it('should penalize repetitive content', () => {
      const repetitiveContent = 'same word '.repeat(50);
      const result: ContentExtractionResult = {
        title: 'Title',
        content: repetitiveContent,
        cleanedContent: repetitiveContent,
        metadata: {
          originalLength: 500,
          cleanedLength: repetitiveContent.length,
          compressionRatio: 0.5,
          extractedAt: new Date(),
          sourceUrl: 'https://example.com',
          hasStructuredData: false,
          contentSections: ['paragraphs'],
        },
      };

      const validation = service.validateContentQuality(result);

      expect(validation.issues).toContain('High content repetition');
      expect(validation.score).toBeLessThan(80);
    });
  });

  describe('fallback text extraction', () => {
    it('should extract text without HTML tags', () => {
      const html = '<div><p>Text content</p><script>alert("bad")</script><style>body{}</style></div>';
      
      // Access private method through any cast
      const fallbackText = (service as any).extractTextFallback(html);

      expect(fallbackText).toBe('Text content');
      expect(fallbackText).not.toContain('<');
      expect(fallbackText).not.toContain('alert');
      expect(fallbackText).not.toContain('body{}');
    });

    it('should handle fallback extraction errors', () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');
      
      // Create HTML that might cause issues in regex processing
      const problematicHtml = null as any;
      
      const fallbackText = (service as any).extractTextFallback(problematicHtml);

      expect(fallbackText).toBe('');
      expect(warnSpy).toHaveBeenCalledWith('Fallback text extraction failed, returning empty string');
    });
  });

  describe('section extraction edge cases', () => {
    it('should prioritize first matching selector for sections', async () => {
      const html = `
        <html>
          <body>
            <div class="job_description">Primary description</div>
            <div class="job-description">Secondary description</div>
            <div class="description">Tertiary description</div>
          </body>
        </html>
      `;

      const result = await service.preprocessHtml(html, 'https://dev.bg/job/123');

      expect(result.sections.description).toBe('Primary description');
    });

    it('should skip empty sections', async () => {
      const html = `
        <html>
          <body>
            <div class="job_description"></div>
            <div class="job-description">   </div>
            <div class="description">Valid description</div>
          </body>
        </html>
      `;

      const result = await service.preprocessHtml(html, 'https://dev.bg/job/123');

      expect(result.sections.description).toBe('Valid description');
    });

    it('should respect minimum content length for sections', async () => {
      const html = `
        <html>
          <body>
            <div class="job_description">Too short</div>
            <div class="description">This is a longer description that meets the minimum requirement</div>
          </body>
        </html>
      `;

      const result = await service.preprocessHtml(html, 'https://dev.bg/job/123');

      expect(result.sections.description).toBe('This is a longer description that meets the minimum requirement');
    });
  });

  describe('markdown conversion edge cases', () => {
    it('should handle nested lists properly', async () => {
      const html = `
        <html>
          <body>
            <ul>
              <li>Item 1</li>
              <li>Item 2
                <ul>
                  <li>Nested item 1</li>
                  <li>Nested item 2</li>
                </ul>
              </li>
            </ul>
          </body>
        </html>
      `;

      const result = await service.preprocessHtml(html, 'https://example.com');

      expect(result.markdown).toContain('- Item 1');
      expect(result.markdown).toContain('- Item 2');
      expect(result.markdown).toContain('- Nested item 1');
    });

    it('should fallback to plain text when no structured content found', async () => {
      const html = `
        <html>
          <body>
            <div>Simple content without headers or lists</div>
          </body>
        </html>
      `;

      const result = await service.preprocessHtml(html, 'https://example.com');

      expect(result.markdown).toContain('Simple content without headers or lists');
    });

    it('should handle empty HTML elements gracefully', async () => {
      const html = `
        <html>
          <body>
            <h1></h1>
            <p></p>
            <ul><li></li></ul>
            <div>Actual content</div>
          </body>
        </html>
      `;

      const result = await service.preprocessHtml(html, 'https://example.com');

      expect(result.markdown).toContain('Actual content');
      expect(result.markdown).not.toContain('# \n'); // No empty headers
    });
  });

  describe('AI optimization strategies', () => {
    it('should preserve complete sections when they fit', async () => {
      const html = `
        <html>
          <body>
            <h1>Section 1</h1>
            <p>Short content</p>
            <h2>Section 2</h2>
            <p>Also short</p>
          </body>
        </html>
      `;

      const result = await service.preprocessHtml(html, 'https://example.com', { 
        maxTokens: 1000 
      });

      expect(result.markdown).toContain('Section 1');
      expect(result.markdown).toContain('Section 2');
    });

    it('should add partial sections when space allows', async () => {
      const shortContent = 'Short section content. ';
      const longContent = 'Very long section content. '.repeat(200);
      
      const html = `
        <html>
          <body>
            <h1>Short Section</h1>
            <p>${shortContent}</p>
            <h2>Long Section</h2>
            <p>${longContent}</p>
          </body>
        </html>
      `;

      const result = await service.preprocessHtml(html, 'https://example.com', { 
        maxTokens: 100 
      });

      expect(result.markdown).toContain('Short Section');
      expect(result.markdown.length).toBeLessThan(longContent.length);
    });
  });

  describe('logging behavior', () => {
    it('should log extraction start and completion', async () => {
      const html = '<html><body><main><p>Test</p></main></body></html>';

      await service.extractContent(html, 'https://example.com');

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Extracting content from https://example.com'),
        expect.objectContaining({ htmlLength: html.length })
      );
    });

    it('should log preprocessing start', async () => {
      const html = '<html><body><main><p>Test</p></main></body></html>';

      await service.preprocessHtml(html, 'https://example.com');

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Preprocessing HTML for AI extraction from https://example.com'),
        expect.objectContaining({ htmlLength: html.length })
      );
    });

    it('should log errors during extraction failures', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      
      // Force an error by mocking cheerio to throw
      const cheerio = await import('cheerio');
      jest.doMock('cheerio', () => ({
        ...cheerio.default,
        load: jest.fn().mockImplementation(() => {
          throw new Error('Simulated cheerio error');
        }),
      }));

      await service.extractContent('<html></html>', 'https://example.com');

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to extract content from https://example.com:'),
        expect.any(Error)
      );

      jest.unmock('cheerio');
    });
  });
});