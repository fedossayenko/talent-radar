import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Browser, BrowserContext, Page } from 'playwright';
import { promises as fs } from 'fs';
import { join } from 'path';
import * as crypto from 'crypto';

// Import playwright-extra and stealth plugin
const playwrightExtra = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

// Get chromium with stealth capabilities
const chromium = playwrightExtra.chromium;

import {
  IBrowserEngine,
  IBrowserSession,
  BrowserSessionConfig,
  BrowserScrapingResponse,
  SessionPersistenceData,
} from '../interfaces/browser-scraper.interface';
import { StealthConfigService } from './stealth-config.service';

@Injectable()
export class BrowserEngineService implements IBrowserEngine, OnModuleDestroy {
  private readonly logger = new Logger(BrowserEngineService.name);
  
  private browser: Browser | null = null;
  private sessions = new Map<string, IBrowserSession>();
  private readonly sessionDir: string;
  private readonly stats = {
    totalRequests: 0,
    totalLoadTime: 0,
    successfulRequests: 0,
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly stealthConfig: StealthConfigService,
  ) {
    this.sessionDir = this.configService.get<string>(
      'scraper.sessionDir',
      './scraper-sessions'
    );
    
    // Initialize stealth plugin
    chromium.use(stealth);
    
    this.logger.log('BrowserEngineService initialized with stealth capabilities');
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
      
      // Check if session should be rotated
      const strategy = this.stealthConfig.getEvasionStrategy(config.siteName);
      if (this.stealthConfig.shouldRotateSession(session.requestCount, session.createdAt, strategy)) {
        this.logger.log(`Rotating session ${sessionId} due to usage limits`);
        await this.closeSession(sessionId);
        return this.createNewSession(config, sessionId);
      }
      
      session.lastActivity = new Date();
      return session;
    }

    // Try to load existing session from disk
    const loadedSession = await this.loadSession(config);
    if (loadedSession) {
      this.sessions.set(sessionId, loadedSession);
      return loadedSession;
    }

    // Create new session
    return this.createNewSession(config, sessionId);
  }

  /**
   * Fetch a page using browser automation
   */
  async fetchPage(url: string, session: IBrowserSession): Promise<BrowserScrapingResponse> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Fetching page: ${url} with session ${session.id}`);
      
      // Update session activity
      session.lastActivity = new Date();
      session.requestCount++;

      const strategy = this.stealthConfig.getEvasionStrategy(session.config.siteName);
      const antiDetection = this.stealthConfig.getAntiDetectionConfig();

      // Add random delay before request
      const delay = this.stealthConfig.getRandomDelay(strategy.randomDelay.min, strategy.randomDelay.max);
      this.logger.debug(`Adding random delay: ${delay}ms`);
      await this.sleep(delay);

      // Navigate to page with stealth settings
      const response = await session.page.goto(url, {
        waitUntil: 'networkidle',
        timeout: session.config.timeout || antiDetection.maxLoadTimeout,
      });

      if (!response) {
        throw new Error('No response received from page navigation');
      }

      // Add human-like interactions
      if (strategy.scrollPage) {
        await this.simulateHumanBehavior(session.page, session.config.viewport);
      }

      // Wait for network to be idle
      await session.page.waitForLoadState('networkidle', {
        timeout: antiDetection.networkIdleTimeout,
      });

      // Get page content and metadata
      const html = await session.page.content();
      const finalUrl = session.page.url();
      const cookies = await session.context.cookies();

      const loadTime = Date.now() - startTime;

      // Update statistics
      this.stats.totalRequests++;
      this.stats.totalLoadTime += loadTime;
      this.stats.successfulRequests++;

      // Save session if it's been significantly used
      if (session.requestCount % 5 === 0) {
        await this.saveSession(session);
      }

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

    } catch (error) {
      const loadTime = Date.now() - startTime;
      this.stats.totalRequests++;
      this.stats.totalLoadTime += loadTime;

      this.logger.error(`Failed to fetch ${url}:`, error.message);

      return {
        html: '',
        finalUrl: url,
        status: 0,
        headers: {},
        success: false,
        error: error.message,
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
        await this.saveSession(session);
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
   * Save session cookies to disk
   */
  async saveSession(session: IBrowserSession): Promise<void> {
    try {
      await fs.mkdir(this.sessionDir, { recursive: true });
      
      const sessionFile = join(this.sessionDir, `${session.config.siteName}-${session.id}.json`);
      const cookies = await session.context.cookies();
      
      // Get storage state
      const storageState = await session.context.storageState();

      const persistenceData: SessionPersistenceData = {
        cookies: cookies.map(cookie => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires,
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
        })),
        localStorage: storageState.origins.length > 0 && storageState.origins[0].localStorage ? 
          storageState.origins[0].localStorage.reduce((acc, item) => ({ ...acc, [item.name]: item.value }), {}) : {},
        sessionStorage: {}, // Session storage is not persisted by Playwright's storageState
        createdAt: session.createdAt.getTime(),
        lastUsed: Date.now(),
        siteName: session.config.siteName,
        userAgent: session.config.userAgent || '',
      };

      await fs.writeFile(sessionFile, JSON.stringify(persistenceData, null, 2));
      this.logger.debug(`Session saved: ${sessionFile}`);
      
    } catch (error) {
      this.logger.warn(`Failed to save session ${session.id}:`, error.message);
    }
  }

  /**
   * Load session cookies from disk
   */
  async loadSession(config: BrowserSessionConfig): Promise<IBrowserSession | null> {
    try {
      const sessionId = this.generateSessionId(config);
      const sessionFile = join(this.sessionDir, `${config.siteName}-${sessionId}.json`);
      
      const data = await fs.readFile(sessionFile, 'utf8');
      const persistenceData: SessionPersistenceData = JSON.parse(data);
      
      // Check if session is still valid (not too old)
      const sessionAgeHours = (Date.now() - persistenceData.lastUsed) / (1000 * 60 * 60);
      if (sessionAgeHours > 24) {
        this.logger.debug(`Session ${sessionId} is too old, creating new one`);
        return null;
      }

      // Create new session with loaded data
      const session = await this.createNewSession(config, sessionId);
      
      // Restore cookies
      if (persistenceData.cookies.length > 0) {
        await session.context.addCookies(persistenceData.cookies.map(cookie => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires,
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
          url: `https://${cookie.domain}`,
        })));
        
        this.logger.debug(`Restored ${persistenceData.cookies.length} cookies for session ${sessionId}`);
      }

      return session;

    } catch (error) {
      this.logger.debug(`Could not load session for ${config.siteName}:`, error.message);
      return null;
    }
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
  private async createNewSession(config: BrowserSessionConfig, sessionId?: string): Promise<IBrowserSession> {
    const id = sessionId || this.generateSessionId(config);
    
    // Ensure browser is available
    if (!this.browser) {
      try {
        this.browser = await chromium.launch({
          headless: config.headless !== false, // Default to headless
          executablePath: '/usr/lib/chromium/chromium',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--single-process', // Important for Docker
            '--disable-extensions',
            '--disable-default-apps',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            // Docker-specific fixes
            '--disable-software-rasterizer',
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-sync',
            '--disable-translate',
            '--hide-scrollbars',
            '--mute-audio',
            '--no-default-browser-check',
            '--no-first-run',
            '--disable-logging',
            '--disable-permissions-api',
            '--disable-presentation-api',
            '--disable-remote-fonts',
            '--disable-background-mode',
            '--disable-features=VizDisplayCompositor',
            '--run-all-compositor-stages-before-draw',
            '--disable-ipc-flooding-protection'
          ],
        });
        
        this.logger.log('Browser instance created with stealth mode');
      } catch (error) {
        this.logger.error('Failed to launch browser instance:', error.message);
        throw new Error(`Browser initialization failed for ${config.siteName}: ${error.message}. This site requires browser automation which is currently unavailable in this environment.`);
      }
    }

    // Get stealth configuration
    const stealthConfig = this.stealthConfig.getStealthConfig(config.siteName);
    const userAgent = config.userAgent || this.stealthConfig.getRandomUserAgent();
    const viewport = config.viewport || this.stealthConfig.getRandomViewport();
    const languages = this.stealthConfig.getRandomLanguages();

    // Create browser context with stealth settings
    const context = await this.browser.newContext({
      userAgent,
      viewport,
      locale: languages[0],
      timezoneId: 'Europe/Sofia', // Bulgarian timezone
      permissions: ['geolocation'],
      geolocation: { latitude: 42.6977, longitude: 23.3219 }, // Sofia coordinates
      proxy: config.proxy,
      extraHTTPHeaders: this.stealthConfig.getRealisticHeaders(userAgent),
    });

    // Set languages
    await context.addInitScript(`
      Object.defineProperty(navigator, 'languages', {
        get: function() { return ${JSON.stringify(languages)}; }
      });
    `);

    // Additional stealth measures
    await context.addInitScript(`
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Spoof chrome object
      window.chrome = {
        runtime: {},
        app: {
          isInstalled: false,
        },
      };
      
      // Spoof plugins
      Object.defineProperty(navigator, 'plugins', {
        get: function() {
          return [
            {
              0: {
                type: "application/x-google-chrome-pdf",
                suffixes: "pdf",
                description: "Portable Document Format"
              },
              description: "Portable Document Format",
              filename: "internal-pdf-viewer",
              length: 1,
              name: "Chrome PDF Plugin"
            }
          ];
        },
      });
    `);

    const page = await context.newPage();

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
    
    this.logger.log(`Created new browser session: ${id} for ${config.siteName}`);
    
    return session;
  }

  /**
   * Simulate human-like behavior on the page
   */
  private async simulateHumanBehavior(page: Page, viewport?: { width: number; height: number }): Promise<void> {
    try {
      const actualViewport = viewport || await page.viewportSize() || { width: 1366, height: 768 };
      
      // Random scroll
      const scrollDistance = Math.floor(Math.random() * 500) + 100;
      await page.evaluate((distance) => {
        window.scrollBy(0, distance);
      }, scrollDistance);

      // Small delay
      await this.sleep(Math.random() * 1000 + 500);

      // Scroll back up slightly
      await page.evaluate(() => {
        window.scrollBy(0, -Math.floor(Math.random() * 200) - 50);
      });

    } catch (error) {
      // Non-critical, don't throw
      this.logger.debug('Could not simulate human behavior:', error.message);
    }
  }

  /**
   * Generate session ID based on configuration
   */
  private generateSessionId(config: BrowserSessionConfig, forceNew = false): string {
    const baseStr = `${config.siteName}-${config.userAgent || 'default'}-${config.headless}`;
    
    if (forceNew) {
      return crypto.createHash('md5').update(`${baseStr}-${Date.now()}-${Math.random()}`).digest('hex').substring(0, 8);
    }
    
    return crypto.createHash('md5').update(baseStr).digest('hex').substring(0, 8);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}