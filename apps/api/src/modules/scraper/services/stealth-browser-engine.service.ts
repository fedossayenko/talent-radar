import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrowserContext, Page, chromium } from 'playwright';
import { BrowserEngineService } from './browser-engine.service';
import { BrowserSessionConfig, IBrowserSession } from '../interfaces/browser-scraper.interface';

/**
 * Enhanced browser service with stealth capabilities for bypassing DataDome protection
 */
@Injectable()
export class StealthBrowserEngineService extends BrowserEngineService {
  protected readonly logger = new Logger(StealthBrowserEngineService.name);
  
  // Pool of realistic browser configurations
  private readonly browserConfigs = [
    {
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      platform: 'Win32',
      vendor: 'Google Inc.',
    },
    {
      viewport: { width: 1366, height: 768 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      platform: 'Win32',
      vendor: 'Google Inc.',
    },
    {
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      platform: 'MacIntel',
      vendor: 'Apple Computer, Inc.',
    },
    {
      viewport: { width: 1536, height: 864 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
      platform: 'Win32',
      vendor: '',
    },
  ];

  private readonly timezones = ['America/New_York', 'Europe/London', 'Europe/Paris', 'America/Los_Angeles'];
  private readonly languages = [['en-US', 'en'], ['en-GB', 'en'], ['en-CA', 'en', 'fr']];

  constructor(configService: ConfigService) {
    super(configService);
    this.logger.log('StealthBrowserEngineService initialized');
  }

  /**
   * Create enhanced stealth session with randomized fingerprints
   */
  async createNewSession(config: BrowserSessionConfig, sessionId?: string): Promise<IBrowserSession> {
    const id = sessionId || this.generateSessionId(config, true);
    
    // Select random browser configuration
    const browserConfig = this.getRandomBrowserConfig();
    
    // Ensure browser is available with stealth enhancements
    if (!this.browser) {
      try {
        this.browser = await this.launchStealthBrowser(config);
        this.logger.log('Stealth browser instance created');
      } catch (error) {
        this.logger.error('Failed to launch stealth browser:', error.message);
        throw new Error(`Stealth browser initialization failed: ${error.message}`);
      }
    }

    // Create context with enhanced stealth configuration
    const context = await this.createStealthContext(browserConfig);
    const page = await this.createStealthPage(context);
    
    const session: IBrowserSession = {
      context,
      page,
      config,
      createdAt: new Date(),
      lastActivity: new Date(),
      requestCount: 0,
      id,
    };

    this.sessions.set(id, session);
    this.logger.log(`Created stealth session: ${id} for ${config.siteName}`);
    
    return session;
  }

  /**
   * Launch browser with stealth capabilities
   */
  private async launchStealthBrowser(config: BrowserSessionConfig) {
    return await chromium.launch({
      headless: config.headless !== false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        // Additional stealth args
        '--disable-extensions-except=/path/to/extension',
        '--disable-extensions',
        '--disable-plugins-discovery',
        '--disable-default-apps',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
      ],
      // Use stealth techniques
      ignoreDefaultArgs: ['--enable-automation'],
    });
  }

  /**
   * Create browser context with enhanced fingerprint spoofing
   */
  private async createStealthContext(browserConfig: any): Promise<BrowserContext> {
    const randomTimezone = this.timezones[Math.floor(Math.random() * this.timezones.length)];
    const randomLanguages = this.languages[Math.floor(Math.random() * this.languages.length)];
    
    return await this.browser!.newContext({
      userAgent: browserConfig.userAgent,
      viewport: browserConfig.viewport,
      ignoreHTTPSErrors: true,
      
      // Enhanced fingerprint spoofing
      locale: randomLanguages[0],
      timezoneId: randomTimezone,
      permissions: ['geolocation', 'notifications', 'microphone', 'camera'],
      colorScheme: 'light',
      reducedMotion: 'no-preference',
      forcedColors: 'none',
      
      // Enhanced headers
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': randomLanguages.join(',') + ';q=0.9',
        'Cache-Control': 'max-age=0',
        'DNT': '1',
        'Sec-CH-UA': this.generateSecChUa(),
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': `"${browserConfig.platform}"`,
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
    });
  }

  /**
   * Create page with advanced stealth scripts
   */
  private async createStealthPage(context: BrowserContext): Promise<Page> {
    const page = await context.newPage();

    // Enhanced stealth script injection
    await page.addInitScript(() => {
      // Override webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Enhanced plugin spoofing
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', description: 'Portable Document Format', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', description: '', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', description: '', filename: 'internal-nacl-plugin' },
        ],
      });

      // Language spoofing
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Enhanced screen properties
      Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
      Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
      Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
      Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });

      // Chrome runtime spoofing
      (window as any).chrome = {
        runtime: {
          onConnect: null,
          onMessage: null,
        },
        loadTimes: () => ({
          commitLoadTime: Date.now() / 1000 - Math.random(),
          connectionInfo: 'h2',
          finishDocumentLoadTime: Date.now() / 1000 - Math.random(),
          finishLoadTime: Date.now() / 1000 - Math.random(),
          firstPaintAfterLoadTime: Date.now() / 1000 - Math.random(),
          firstPaintTime: Date.now() / 1000 - Math.random(),
          navigationType: 'Other',
          npnNegotiatedProtocol: 'h2',
          requestTime: Date.now() / 1000 - Math.random(),
          startLoadTime: Date.now() / 1000 - Math.random(),
          wasAlternateProtocolAvailable: false,
          wasFetchedViaSpdy: true,
          wasNpnNegotiated: true,
        }),
        csi: () => ({}),
      };

      // Battery API spoofing
      (navigator as any).getBattery = () => Promise.resolve({
        charging: true,
        chargingTime: 0,
        dischargingTime: Infinity,
        level: Math.random(),
      });

      // Connection spoofing
      (navigator as any).connection = {
        downlink: 10,
        effectiveType: '4g',
        onchange: null,
        rtt: 100,
        saveData: false,
      };

      // Remove automation indicators
      try {
        delete (window.navigator as any).__proto__.webdriver;
      } catch (e) {
        // Ignore
      }
    });

    return page;
  }

  /**
   * Simulate human-like behavior before and during page interaction
   */
  async simulateHumanBehavior(page: Page): Promise<void> {
    try {
      // Random mouse movements using native Playwright
      const randomX = Math.random() * 300 + 100;
      const randomY = Math.random() * 300 + 100;
      
      // Smooth mouse movement
      await page.mouse.move(randomX, randomY);
      await page.waitForTimeout(100 + Math.random() * 200);
      
      // Random scroll with realistic timing
      await page.mouse.wheel(0, Math.random() * 500 + 200);
      await page.waitForTimeout(1000 + Math.random() * 2000);
      
      // More realistic mouse movement
      const newX = Math.random() * 200 + 150;
      const newY = Math.random() * 200 + 150;
      await page.mouse.move(newX, newY);
      
      // Random click on empty area (won't affect functionality)
      try {
        const bodyBox = await page.locator('body').boundingBox();
        if (bodyBox && bodyBox.width > 0 && bodyBox.height > 0) {
          const clickX = bodyBox.width * 0.8;
          const clickY = bodyBox.height * 0.1;
          await page.mouse.click(clickX, clickY);
          await page.waitForTimeout(200 + Math.random() * 300);
        }
      } catch (e) {
        // Ignore click errors
      }
      
    } catch (error) {
      this.logger.debug('Human behavior simulation error (non-critical):', error.message);
    }
  }

  /**
   * Enhanced page fetching with warm-up and behavior simulation
   */
  async fetchPageWithWarmup(url: string, session: IBrowserSession, options?: { infiniteScroll?: boolean, warmup?: boolean }): Promise<any> {
    try {
      // Warm-up navigation (30% chance)
      if (options?.warmup && Math.random() < 0.3) {
        await this.performWarmupNavigation(session);
      }
      
      // Pre-navigation behavior simulation
      await this.simulateHumanBehavior(session.page);
      
      // Add random delay before navigation
      await session.page.waitForTimeout(Math.random() * 3000 + 2000);
      
      // Perform the actual fetch
      return await this.fetchPage(url, session, options);
      
    } catch (error) {
      this.logger.error('Enhanced fetch failed:', error.message);
      throw error;
    }
  }

  /**
   * Perform warm-up navigation to build session trust
   */
  private async performWarmupNavigation(session: IBrowserSession): Promise<void> {
    try {
      this.logger.debug('Performing warm-up navigation');
      
      // Navigate to homepage first
      const baseUrl = session.config.siteName === 'jobs.bg' ? 'https://www.jobs.bg' : 'https://dev.bg';
      await session.page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      
      // Simulate reading
      await session.page.waitForTimeout(3000 + Math.random() * 4000);
      
      // Human-like interactions
      await this.simulateHumanBehavior(session.page);
      
      // Small delay before actual navigation
      await session.page.waitForTimeout(2000 + Math.random() * 3000);
      
    } catch (error) {
      this.logger.warn('Warm-up navigation failed (non-critical):', error.message);
    }
  }

  /**
   * Get random browser configuration
   */
  private getRandomBrowserConfig() {
    return this.browserConfigs[Math.floor(Math.random() * this.browserConfigs.length)];
  }

  /**
   * Generate realistic Sec-CH-UA header
   */
  private generateSecChUa(): string {
    const brands = [
      '"Not_A Brand";v="8", "Chromium";v="121", "Google Chrome";v="121"',
      '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
      '"Not?A_Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    ];
    return brands[Math.floor(Math.random() * brands.length)];
  }
}