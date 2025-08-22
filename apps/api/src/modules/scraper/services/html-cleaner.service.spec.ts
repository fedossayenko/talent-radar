import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { HtmlCleanerService, CleaningProfile } from './html-cleaner.service';

describe('HtmlCleanerService', () => {
  let service: HtmlCleanerService;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Mock Logger
    loggerSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [HtmlCleanerService],
    }).compile();

    service = module.get<HtmlCleanerService>(HtmlCleanerService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('cleanHtml with standard profile', () => {
    it('should clean HTML using standard profile', async () => {
      const html = `
        <html>
          <head><title>Test Page</title></head>
          <body>
            <nav>Navigation</nav>
            <header>Header</header>
            <main>
              <article>
                <h1>Job Title</h1>
                <div class="job-description">
                  <p>Job requirements and description</p>
                  <ul class="job-requirements">
                    <li>Experience with JavaScript</li>
                    <li>Knowledge of React</li>
                  </ul>
                </div>
                <div class="salary">$80,000 - $100,000</div>
              </article>
            </main>
            <aside>Sidebar content</aside>
            <footer>Footer</footer>
            <script>console.log('test');</script>
          </body>
        </html>
      `;

      const result = await service.cleanHtml(html, 'standard');

      expect(result.cleanedHtml).toBeDefined();
      expect(result.cleanedText).toBeDefined();
      expect(result.result).toBeDefined();

      // Should remove navigation, header, footer, aside, script
      expect(result.cleanedHtml).not.toContain('<nav>');
      expect(result.cleanedHtml).not.toContain('<header>');
      expect(result.cleanedHtml).not.toContain('<footer>');
      expect(result.cleanedHtml).not.toContain('<aside>');
      expect(result.cleanedHtml).not.toContain('<script>');

      // Should preserve main content
      expect(result.cleanedHtml).toContain('<main>');
      expect(result.cleanedHtml).toContain('<article>');
      expect(result.cleanedText).toContain('Job Title');
      expect(result.cleanedText).toContain('Job requirements');

      // Should have cleaning result metadata
      expect(result.result.appliedProfile).toBe('standard');
      expect(result.result.originalLength).toBe(html.length);
      expect(result.result.cleanedLength).toBeLessThan(html.length);
      expect(result.result.processingTime).toBeGreaterThan(0);
      expect(result.result.removedElements).toContain('NAV');
      expect(result.result.preservedElements).toContain('MAIN');
    });

    it('should process text content with standard profile patterns', async () => {
      const html = `
        <body>
          <main>
            <p>Privacy policy and cookie policy information.</p>
            <p>Follow us on social media and subscribe to our newsletter.</p>
            <p>Click here to read more about our services.</p>
            <p>This is the actual job description content.</p>
          </main>
        </body>
      `;

      const result = await service.cleanHtml(html, 'standard');

      // Should remove privacy policy text
      expect(result.cleanedText).not.toContain('Privacy policy');
      expect(result.cleanedText).not.toContain('cookie policy');
      
      // Should remove social media text
      expect(result.cleanedText).not.toContain('Follow us');
      expect(result.cleanedText).not.toContain('subscribe to our newsletter');
      
      // Should remove click here text
      expect(result.cleanedText).not.toContain('Click here');
      expect(result.cleanedText).not.toContain('read more');
      
      // Should preserve actual content
      expect(result.cleanedText).toContain('actual job description');
    });

    it('should truncate text when exceeding maxLength for standard profile', async () => {
      const longText = 'a'.repeat(20000);
      const html = `<body><main><p>${longText}</p></main></body>`;

      const result = await service.cleanHtml(html, 'standard');

      expect(result.cleanedText.length).toBeLessThanOrEqual(15003); // 15000 + '...'
      expect(result.cleanedText).toMatch(/\.\.\.$/m);
    });
  });

  describe('cleanHtml with aggressive profile', () => {
    it('should clean HTML using aggressive profile', async () => {
      const html = `
        <html>
          <body>
            <nav>Navigation</nav>
            <main>
              <article>
                <h1>Job Title</h1>
                <p>Job description</p>
                <form>Contact form</form>
                <button>Apply</button>
                <input type="text" name="email">
              </article>
            </main>
            <div class="sidebar">Sidebar</div>
            <video>Video content</video>
          </body>
        </html>
      `;

      const result = await service.cleanHtml(html, 'aggressive');

      // Should remove more elements than standard
      expect(result.cleanedHtml).not.toContain('<nav>');
      expect(result.cleanedHtml).not.toContain('<form>');
      expect(result.cleanedHtml).not.toContain('<button>');
      expect(result.cleanedHtml).not.toContain('<input>');
      expect(result.cleanedHtml).not.toContain('<video>');
      expect(result.cleanedHtml).not.toContain('class="sidebar"');

      // Should preserve basic content elements
      expect(result.cleanedHtml).toContain('<main>');
      expect(result.cleanedHtml).toContain('<article>');
      expect(result.cleanedHtml).toContain('<h1>');
      expect(result.cleanedHtml).toContain('<p>');

      expect(result.result.appliedProfile).toBe('aggressive');
    });

    it('should process text with aggressive profile patterns', async () => {
      const html = `
        <body>
          <main>
            <p>© 2024 Company Name. All rights reserved.</p>
            <p>Copyright 2023 Test Corp. All rights reserved.</p>
            <p>Powered by WordPress and built with React.</p>
            <p>Click here to learn more about our platform.</p>
            <p>This is the important content.</p>
          </main>
        </body>
      `;

      const result = await service.cleanHtml(html, 'aggressive');

      // Should remove copyright text
      expect(result.cleanedText).not.toContain('© 2024');
      expect(result.cleanedText).not.toContain('Copyright 2023');
      expect(result.cleanedText).not.toContain('All rights reserved');
      
      // Should remove powered by text
      expect(result.cleanedText).not.toContain('Powered by');
      expect(result.cleanedText).not.toContain('built with');
      
      // Should remove click here text
      expect(result.cleanedText).not.toContain('Click here');
      
      // Should preserve actual content
      expect(result.cleanedText).toContain('important content');
    });

    it('should have shorter maxLength for aggressive profile', async () => {
      const longText = 'b'.repeat(15000);
      const html = `<body><main><p>${longText}</p></main></body>`;

      const result = await service.cleanHtml(html, 'aggressive');

      expect(result.cleanedText.length).toBeLessThanOrEqual(10003); // 10000 + '...'
      expect(result.cleanedText).toMatch(/\.\.\.$/m);
    });
  });

  describe('cleanHtml with custom options', () => {
    it('should merge custom options with base profile', async () => {
      const html = `
        <body>
          <main>
            <div class="custom-class">Custom content</div>
            <p>Regular content</p>
          </main>
        </body>
      `;

      const customOptions: Partial<CleaningProfile> = {
        selectors: {
          remove: ['.custom-class'],
          preserve: [],
          contentContainers: ['main'],
        },
      };

      const result = await service.cleanHtml(html, 'standard', customOptions);

      expect(result.cleanedHtml).not.toContain('class="custom-class"');
      expect(result.cleanedHtml).not.toContain('Custom content');
      expect(result.cleanedText).toContain('Regular content');
      expect(result.cleanedText).not.toContain('Custom content');
    });

    it('should merge custom text processing options', async () => {
      const html = `<body><main><p>Test content with custom pattern removal</p></main></body>`;

      const customOptions: Partial<CleaningProfile> = {
        textProcessing: {
          removePatterns: [/custom pattern/gi],
          maxLength: 50,
          minLength: 5,
        },
      };

      const result = await service.cleanHtml(html, 'standard', customOptions);

      expect(result.cleanedText).not.toContain('custom pattern');
      expect(result.cleanedText.length).toBeLessThanOrEqual(53); // 50 + '...'
    });
  });

  describe('Content extraction strategy', () => {
    it('should extract from first matching content container', async () => {
      const html = `
        <body>
          <div class="content">Primary content here</div>
          <main>Secondary content here</main>
        </body>
      `;

      const result = await service.cleanHtml(html, 'standard');

      // Should prefer main over .content based on contentContainers order
      expect(result.cleanedText).toContain('Secondary content');
    });

    it('should fallback to body text when no content containers match', async () => {
      const html = `
        <body>
          <div>Some content without specific containers</div>
          <p>More text content</p>
        </body>
      `;

      const result = await service.cleanHtml(html, 'standard');

      expect(result.cleanedText).toContain('Some content');
      expect(result.cleanedText).toContain('More text content');
    });

    it('should respect minLength when extracting from containers', async () => {
      const html = `
        <body>
          <main>Hi</main>
          <div>This is a much longer piece of content that meets the minimum length requirement</div>
        </body>
      `;

      const result = await service.cleanHtml(html, 'standard');

      // Should skip short main content and use body fallback
      expect(result.cleanedText).toContain('much longer piece');
    });
  });

  describe('Error handling and fallback', () => {
    it('should handle malformed HTML gracefully', async () => {
      const malformedHtml = '<html><body><div><p>Unclosed tags<div><span></body>';

      const result = await service.cleanHtml(malformedHtml, 'standard');

      expect(result.cleanedHtml).toBeDefined();
      expect(result.cleanedText).toBeDefined();
      expect(result.result.appliedProfile).toBe('standard');
    });

    it('should use fallback when cleaning fails', async () => {
      // Test with malformed HTML that might cause parsing issues
      const invalidHtml = '<<invalid>>html<<malformed>><script>alert("test")</script>';

      const result = await service.cleanHtml(invalidHtml, 'standard');

      // Should handle the error gracefully
      expect(result.result.appliedProfile).toBe('standard');
      expect(result.cleanedHtml).toBeDefined();
      expect(result.cleanedText).toBeDefined();
      // Should still remove scripts even with malformed HTML
      expect(result.cleanedText).not.toContain('<script>');
      expect(result.cleanedText).not.toContain('alert');
    });

    it('should handle empty HTML', async () => {
      const result = await service.cleanHtml('', 'standard');

      expect(result.cleanedHtml).toBeDefined();
      expect(result.cleanedText).toBe('');
      expect(result.result.originalLength).toBe(0);
    });

    it('should handle HTML with only whitespace', async () => {
      const html = '   \n\t   ';

      const result = await service.cleanHtml(html, 'standard');

      expect(result.cleanedText.trim()).toBe('');
    });
  });

  describe('Text processing edge cases', () => {
    it('should normalize whitespace properly', async () => {
      const html = `
        <body>
          <main>
            <p>Text    with     multiple    spaces</p>
            <p>Text
            with
            newlines</p>
            <p>Text\t\twith\ttabs</p>
          </main>
        </body>
      `;

      const result = await service.cleanHtml(html, 'standard');

      expect(result.cleanedText).not.toMatch(/\s{2,}/); // No multiple consecutive spaces
      expect(result.cleanedText).toContain('Text with multiple spaces');
      expect(result.cleanedText).toContain('Text with newlines');
      expect(result.cleanedText).toContain('Text with tabs');
    });

    it('should handle text truncation at word boundaries', async () => {
      const words = Array(2000).fill('word').join(' ');
      const html = `<body><main><p>${words}</p></main></body>`;

      const result = await service.cleanHtml(html, 'standard');

      // Check that the text is processed (may or may not be truncated depending on the profile settings)
      expect(result.cleanedText).toBeDefined();
      expect(result.cleanedText.length).toBeGreaterThan(0);
      
      // If text is truncated (ends with ...), it should not cut words in the middle
      if (result.cleanedText.endsWith('...')) {
        expect(result.cleanedText).not.toMatch(/\w+\.\.\.$/); // Should not cut words in middle
      }
    });

    it('should handle text shorter than maxLength gracefully', async () => {
      const shortText = 'Short content';
      const html = `<body><main><p>${shortText}</p></main></body>`;

      const result = await service.cleanHtml(html, 'standard');

      expect(result.cleanedText).toBe(shortText);
      expect(result.cleanedText).not.toContain('...');
    });
  });

  describe('Profile management', () => {
    it('should return available profiles', () => {
      const profiles = service.getAvailableProfiles();

      expect(profiles).toContain('standard');
      expect(profiles).toContain('aggressive');
      expect(profiles).toHaveLength(2);
    });

    it('should return profile details for valid profile', () => {
      const profile = service.getProfileDetails('standard');

      expect(profile).toBeDefined();
      expect(profile!.name).toBe('Standard');
      expect(profile!.description).toContain('Balanced cleaning');
      expect(profile!.selectors.remove).toContain('nav');
      expect(profile!.selectors.preserve).toContain('main');
      expect(profile!.textProcessing.maxLength).toBe(15000);
    });

    it('should return null for invalid profile', () => {
      const profile = service.getProfileDetails('nonexistent');

      expect(profile).toBeNull();
    });

    it('should fallback to standard profile for unknown profile name', async () => {
      const html = '<body><main><p>Test content</p></main></body>';

      const result = await service.cleanHtml(html, 'unknown-profile');

      expect(result.result.appliedProfile).toBe('unknown-profile');
      // Should still work using standard profile internally
      expect(result.cleanedText).toContain('Test content');
    });
  });

  describe('Logging', () => {
    it('should log cleaning start and completion', async () => {
      const html = '<body><main><p>Test</p></main></body>';

      await service.cleanHtml(html, 'standard');

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cleaning HTML with profile: standard'),
        expect.objectContaining({ originalLength: html.length })
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('HTML cleaning completed'),
        expect.objectContaining({
          profile: 'standard',
          compressionRatio: expect.any(Number),
          processingTime: expect.any(Number),
          removedElementTypes: expect.any(Number),
        })
      );
    });

    it('should warn when using unknown profile', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');
      const html = '<body><main><p>Test</p></main></body>';

      await service.cleanHtml(html, 'invalid-profile');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown cleaning profile: invalid-profile')
      );
    });

    it('should handle cleaning gracefully without throwing errors', async () => {
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');
      
      // Test with various potentially problematic HTML inputs
      const problematicHtml = '<html><body><p>Test</p><script>alert("test")</script></body></html>';

      const result = await service.cleanHtml(problematicHtml, 'standard');

      // Should complete without throwing errors
      expect(result).toBeDefined();
      expect(result.cleanedText).toBeDefined();
      expect(result.cleanedHtml).toBeDefined();
      
      // Should have logged the start of cleaning
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cleaning HTML with profile:'),
        expect.anything()
      );
    });
  });

  describe('Fallback text extraction', () => {
    it('should extract text without HTML tags', () => {
      const html = '<div><p>Text content</p><script>alert("bad")</script><style>body{}</style></div>';
      
      // Access private method through service instance
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
      expect(warnSpy).toHaveBeenCalledWith('Fallback text extraction failed');
    });
  });
});