import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Browser, BrowserContext, Page, chromium } from 'playwright';
import * as crypto from 'crypto';

import {
  IBrowserEngine,
  IBrowserSession,
  BrowserSessionConfig,
  BrowserScrapingResponse,
} from '../interfaces/browser-scraper.interface';

// Enhanced browser configurations for stealth mode
interface BrowserConfig {
  viewport: { width: number; height: number };
  userAgent: string;
  platform: string;
  vendor: string;
}

@Injectable()
export class BrowserEngineService implements IBrowserEngine, OnModuleDestroy {
  protected readonly logger = new Logger(BrowserEngineService.name);
  
  protected browser: Browser | null = null;
  protected sessions = new Map<string, IBrowserSession>();
  protected readonly sessionDir: string;
  private readonly stats = {
    totalRequests: 0,
    totalLoadTime: 0,
    successfulRequests: 0,
  };
  
  // Pool of realistic browser configurations for stealth mode
  private readonly browserConfigs: BrowserConfig[] = [
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

  constructor(private readonly configService: ConfigService) {
    this.sessionDir = this.configService.get<string>(
      'scraper.sessionDir',
      './scraper-sessions'
    );
    
    this.logger.log('BrowserEngineService initialized with unified browser engine');
  }

  async onModuleDestroy() {
    await this.closeAllSessions();
    if (this.browser) {
      await this.browser.close();
      this.logger.log('Browser instance closed');
    }
  }

  /**
   * Get or create a browser session for a site
   */
  async getSession(config: BrowserSessionConfig): Promise<IBrowserSession> {
    const sessionId = this.generateSessionId(config);
    
    // Check if we have an existing session
    if (this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId)!;
      session.lastActivity = new Date();
      return session;
    }

    // Create new session
    return this.createNewSession(config, sessionId);
  }

  /**
   * Enhanced page fetching with stealth capabilities
   */
  async fetchPageWithStealth(url: string, session: IBrowserSession, options?: { infiniteScroll?: boolean; warmup?: boolean; stealth?: boolean }): Promise<BrowserScrapingResponse> {
    // If stealth mode is enabled, perform enhanced behavior
    if (options?.stealth) {
      try {
        // Warm-up navigation (30% chance)
        if (options.warmup && Math.random() < 0.3) {
          await this.performWarmupNavigation(session);
        }
        
        // Pre-navigation behavior simulation
        await this.simulateHumanBehavior(session.page);
        
        // Add random delay before navigation
        await session.page.waitForTimeout(Math.random() * 3000 + 2000);
      } catch (error) {
        this.logger.debug('Stealth behavior simulation error (non-critical):', error.message);
      }
    }
    
    return this.fetchPage(url, session, options);
  }

  /**
   * Fetch a page using browser automation with optional infinite scroll
   */
  async fetchPage(url: string, session: IBrowserSession, options?: { infiniteScroll?: boolean }): Promise<BrowserScrapingResponse> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Fetching page: ${url} with session ${session.id}`);
      
      // Update session activity
      session.lastActivity = new Date();
      session.requestCount++;

      // Add random delay before navigation (human-like behavior)
      await session.page.waitForTimeout(Math.random() * 2000 + 1000);
      
      // Navigate to page with realistic timing
      const response = await session.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: session.config.timeout || 30000,
      });

      if (!response) {
        throw new Error('No response received from page navigation');
      }

      // Wait for network to be idle with human-like timing
      await session.page.waitForLoadState('networkidle');
      
      // Simulate human-like mouse movement
      await session.page.mouse.move(
        Math.random() * 200 + 100,
        Math.random() * 200 + 100
      );

      // For jobs.bg, wait for content to load
      if (session.config.siteName === 'jobs.bg') {
        try {
          // Wait for either job listings to appear or timeout after 10 seconds
          await session.page.waitForSelector('li .mdc-card, .job-item, .mdc-card', { timeout: 10000 });
          this.logger.debug('Job content detected, proceeding with scraping');
        } catch {
          this.logger.warn('No job content detected after waiting, proceeding anyway');
        }
      }

      // Handle infinite scroll if requested
      if (options?.infiniteScroll) {
        await this.performInfiniteScroll(session.page);
      }

      // Get page content and metadata
      const html = await session.page.content();
      const finalUrl = session.page.url();
      const cookies = await session.context.cookies();

      const loadTime = Date.now() - startTime;

      // Update statistics
      this.stats.totalRequests++;
      this.stats.totalLoadTime += loadTime;
      this.stats.successfulRequests++;

      this.logger.debug(`Successfully fetched ${url} in ${loadTime}ms`);

      return {
        html,
        finalUrl,
        status: response.status(),
        headers: response.headers(),
        success: true,
        loadTime,
        cookies: cookies.map(cookie => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires,
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
        })),
      };

    } catch (_error) {
      const loadTime = Date.now() - startTime;
      this.stats.totalRequests++;
      this.stats.totalLoadTime += loadTime;

      this.logger.error(`Failed to fetch ${url}:`, _error.message);

      return {
        html: '',
        finalUrl: url,
        status: 0,
        headers: {},
        success: false,
        error: _error.message,
        loadTime,
        cookies: [],
      };
    }
  }

  /**
   * Close a specific session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        await session.context.close();
        this.sessions.delete(sessionId);
        this.logger.debug(`Session ${sessionId} closed`);
      } catch (error) {
        this.logger.warn(`Error closing session ${sessionId}:`, error.message);
      }
    }
  }

  /**
   * Close all sessions
   */
  async closeAllSessions(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    await Promise.all(sessionIds.map(id => this.closeSession(id)));
    this.logger.log(`Closed ${sessionIds.length} sessions`);
  }

  /**
   * Get session statistics
   */
  getStats() {
    const averageLoadTime = this.stats.totalRequests > 0 
      ? this.stats.totalLoadTime / this.stats.totalRequests 
      : 0;
    
    const successRate = this.stats.totalRequests > 0 
      ? this.stats.successfulRequests / this.stats.totalRequests 
      : 0;

    return {
      activeSessions: this.sessions.size,
      totalRequests: this.stats.totalRequests,
      averageLoadTime: Math.round(averageLoadTime),
      successRate: Math.round(successRate * 100) / 100,
    };
  }

  /**
   * Create a new browser session
   */
  protected async createNewSession(config: BrowserSessionConfig, sessionId?: string): Promise<IBrowserSession> {
    const id = sessionId || this.generateSessionId(config);
    
    // Ensure browser is available
    if (!this.browser) {
      try {
        this.browser = await this.launchBrowser(config);
        
        this.logger.log(`Browser instance created with ${config.stealth ? 'enhanced stealth' : 'standard'} capabilities`);
      } catch (error) {
        this.logger.error('Failed to launch browser instance:', error.message);
        throw new Error(`Browser initialization failed for ${config.siteName}: ${error.message}. Browser automation is not available.`);
      }
    }

    // Create browser context with optional stealth enhancements
    const browserConfig = config.stealth ? this.getRandomBrowserConfig() : null;
    const context = await this.createBrowserContext(config, browserConfig);
    const page = await this.createBrowserPage(context, config);


    // Block unnecessary resources for better performance and stealth
    if (config.loadImages === false) {
      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          route.abort();
        } else {
          route.continue();
        }
      });
    }

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
    
    this.logger.log(`Created new browser session: ${id} for ${config.siteName} ${config.stealth ? '(stealth mode)' : '(standard mode)'}`);
    
    return session;
  }

  /**
   * Save session (simplified - no disk persistence)
   */
  async saveSession(session: IBrowserSession): Promise<void> {
    // In simplified implementation, sessions are already managed in memory
    this.logger.debug(`Session ${session.id} state maintained in memory`);
  }

  /**
   * Load session (simplified - returns null since we don't persist to disk)
   */
  async loadSession(_config: BrowserSessionConfig): Promise<IBrowserSession | null> {
    // In simplified implementation, we don't persist sessions to disk
    return null;
  }

  /**
   * Rotate session (close current and create new)
   */
  async rotateSession(sessionId: string): Promise<IBrowserSession> {
    const currentSession = this.sessions.get(sessionId);
    if (!currentSession) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const config = currentSession.config;
    await this.closeSession(sessionId);
    
    // Create new session with same config but new ID
    const newSessionId = this.generateSessionId(config, true);
    return this.createNewSession(config, newSessionId);
  }

  /**
   * Enhanced infinite scroll with human-like behavior
   */
  /* eslint-disable no-undef */
  private async performInfiniteScroll(page: Page): Promise<void> {
    this.logger.debug('Starting enhanced infinite scroll to load all jobs');
    
    let previousHeight = 0;
    let currentHeight = await page.evaluate(() => document.body.scrollHeight);
    let attempts = 0;
    const maxAttempts = 15; // Reduced to prevent detection
    const scrollStep = 0.8; // Scroll to 80% instead of bottom
    
    while (previousHeight !== currentHeight && attempts < maxAttempts) {
      previousHeight = currentHeight;
      
      // Human-like scroll behavior - scroll gradually
      const targetHeight = currentHeight * scrollStep;
      await page.evaluate((target) => {
        const currentScroll = window.pageYOffset;
        const step = (target - currentScroll) / 10;
        let scrolls = 0;
        
        const smoothScroll = () => {
          if (scrolls < 10) {
            window.scrollBy(0, step);
            scrolls++;
            setTimeout(smoothScroll, 50 + Math.random() * 50);
          }
        };
        smoothScroll();
      }, targetHeight);
      
      // Random wait time to simulate human reading
      const waitTime = 2000 + Math.random() * 3000;
      await page.waitForTimeout(waitTime);
      
      // Scroll to actual bottom
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      // Wait for new content with jitter
      await page.waitForTimeout(1500 + Math.random() * 1000);
      
      // Check new height
      currentHeight = await page.evaluate(() => document.body.scrollHeight);
      attempts++;
      
      this.logger.debug(`Enhanced scroll attempt ${attempts}: height ${previousHeight} -> ${currentHeight}`);
      
      // Add small mouse movements to simulate engagement
      if (attempts % 3 === 0) {
        await page.mouse.move(
          Math.random() * 300 + 100,
          Math.random() * 300 + 100
        );
      }
    }
    
    if (attempts >= maxAttempts) {
      this.logger.warn('Enhanced infinite scroll stopped due to max attempts reached');
    } else {
      this.logger.debug(`Enhanced infinite scroll completed in ${attempts} attempts`);
    }
    
    // Gradually scroll back to top with human-like behavior
    await page.evaluate(() => {
      const scrollToTop = () => {
        const currentScroll = window.pageYOffset;
        if (currentScroll > 0) {
          window.scrollTo(0, currentScroll - currentScroll * 0.1);
          setTimeout(scrollToTop, 50);
        }
      };
      scrollToTop();
    });
    
    await page.waitForTimeout(1000 + Math.random() * 500);
  }
  /* eslint-enable no-undef */

  /**
   * Generate session ID based on configuration
   */
  protected generateSessionId(config: BrowserSessionConfig, forceNew = false): string {
    const baseStr = `${config.siteName}-${config.userAgent || 'default'}-${config.headless}-${config.stealth || false}`;
    
    if (forceNew) {
      return crypto.createHash('md5').update(`${baseStr}-${Date.now()}-${Math.random()}`).digest('hex').substring(0, 8);
    }
    
    return crypto.createHash('md5').update(baseStr).digest('hex').substring(0, 8);
  }

  /**
   * Launch browser with optional stealth capabilities
   */
  private async launchBrowser(config: BrowserSessionConfig) {
    const baseArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox', 
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
    ];

    const stealthArgs = [
      '--disable-extensions-except=/path/to/extension',
      '--disable-extensions',
      '--disable-plugins-discovery', 
      '--disable-default-apps',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ];

    return await chromium.launch({
      headless: config.headless !== false,
      args: config.stealth ? [...baseArgs, ...stealthArgs] : baseArgs,
      ignoreDefaultArgs: config.stealth ? ['--enable-automation'] : undefined,
    });
  }

  /**
   * Create browser context with optional stealth enhancements
   */
  private async createBrowserContext(config: BrowserSessionConfig, browserConfig?: BrowserConfig) {
    const randomTimezone = this.timezones[Math.floor(Math.random() * this.timezones.length)];
    const randomLanguages = this.languages[Math.floor(Math.random() * this.languages.length)];

    return await this.browser!.newContext({
      userAgent: config.stealth && browserConfig 
        ? browserConfig.userAgent 
        : (config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'),
      viewport: config.stealth && browserConfig 
        ? browserConfig.viewport 
        : (config.viewport || { width: 1920, height: 1080 }),
      ignoreHTTPSErrors: true,
      // Enhanced fingerprint spoofing
      locale: config.stealth ? randomLanguages[0] : 'en-US',
      timezoneId: config.stealth ? randomTimezone : 'America/New_York',
      permissions: config.stealth 
        ? ['geolocation', 'notifications', 'microphone', 'camera'] 
        : ['geolocation'],
      colorScheme: 'light',
      reducedMotion: 'no-preference',
      forcedColors: 'none',
      // Add realistic browser features
      extraHTTPHeaders: config.stealth ? {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': randomLanguages.join(',') + ';q=0.9',
        'Cache-Control': 'max-age=0',
        'DNT': '1',
        'Sec-CH-UA': this.generateSecChUa(),
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': `"${browserConfig?.platform || 'Windows'}"`,
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      } : {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'max-age=0',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="121", "Google Chrome";v="121"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
    });
  }

  /**
   * Create browser page with optional stealth scripts
   */
  private async createBrowserPage(context: BrowserContext, config: BrowserSessionConfig) {
    const page = await context.newPage();

    // Stealth script injection
    if (config.stealth) {
      await this.injectStealthScripts(page);
    } else {
      await this.injectBasicScripts(page);
    }

    // Block unnecessary resources for better performance
    if (config.loadImages === false) {
      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          route.abort();
        } else {
          route.continue();
        }
      });
    }

    return page;
  }

  /**
   * Inject enhanced stealth scripts
   */
  /* eslint-disable no-undef */
  private async injectStealthScripts(page: Page) {
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
      } catch {
        // Ignore
      }
    });
  }
  /* eslint-enable no-undef */

  /**
   * Inject basic stealth scripts
   */
  /* eslint-disable no-undef, @typescript-eslint/no-unused-vars */
  private async injectBasicScripts(page: Page) {
    await page.addInitScript(() => {
      // Override navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Override navigator.plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Override navigator.languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      // Add realistic screen properties
      Object.defineProperty(screen, 'availHeight', {
        get: () => 1040,
      });
      Object.defineProperty(screen, 'availWidth', {
        get: () => 1920,
      });
      
      // Override chrome runtime
      (window as any).chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
      };
      
      // Remove automation indicators
      try {
        delete (window.navigator as any).__proto__.webdriver;
      } catch (_e) {
        // Ignore errors when trying to delete webdriver property
      }
    });
  }
  /* eslint-enable no-undef, @typescript-eslint/no-unused-vars */

  /**
   * Simulate human-like behavior for stealth mode
   */
  async simulateHumanBehavior(page: Page): Promise<void> {
    try {
      // Random mouse movements
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
      
      // Random click on empty area
      try {
        const bodyBox = await page.locator('body').boundingBox();
        if (bodyBox && bodyBox.width > 0 && bodyBox.height > 0) {
          const clickX = bodyBox.width * 0.8;
          const clickY = bodyBox.height * 0.1;
          await page.mouse.click(clickX, clickY);
          await page.waitForTimeout(200 + Math.random() * 300);
        }
      } catch {
        // Ignore click errors
      }
      
    } catch (error) {
      this.logger.debug('Human behavior simulation error (non-critical):', error.message);
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
   * Get random browser configuration for stealth mode
   */
  private getRandomBrowserConfig(): BrowserConfig {
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