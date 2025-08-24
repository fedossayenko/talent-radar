import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StealthConfig, EvasionStrategy } from '../interfaces/browser-scraper.interface';

/**
 * Service for managing stealth configuration and browser fingerprinting evasion
 */
@Injectable()
export class StealthConfigService {
  private readonly logger = new Logger(StealthConfigService.name);

  // Modern realistic user agents (updated for 2024/2025)
  private readonly userAgents = [
    // Chrome 131 (Latest)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    
    // Chrome 130
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    
    // Firefox 132
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0',
    
    // Edge
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  ];

  // Realistic viewport sizes
  private readonly viewports = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1536, height: 864 },
    { width: 1280, height: 720 },
    { width: 1600, height: 900 },
  ];

  // Realistic languages
  private readonly languages = [
    ['en-US', 'en'],
    ['en-GB', 'en'],
    ['bg-BG', 'bg', 'en'],
    ['en-US', 'bg', 'en'],
  ];

  constructor(private readonly configService: ConfigService) {}

  /**
   * Get stealth configuration for a specific site
   */
  getStealthConfig(siteName: string): StealthConfig {
    const siteKey = this.convertSiteNameToConfigKey(siteName);
    
    return {
      hideWebdriver: this.configService.get<boolean>(`scraper.sites.${siteKey}.stealth.hideWebdriver`, true),
      spoofUserAgent: this.configService.get<boolean>(`scraper.sites.${siteKey}.stealth.spoofUserAgent`, true),
      spoofWebGL: this.configService.get<boolean>(`scraper.sites.${siteKey}.stealth.spoofWebGL`, true),
      spoofPlugins: this.configService.get<boolean>(`scraper.sites.${siteKey}.stealth.spoofPlugins`, true),
      spoofLanguages: this.configService.get<boolean>(`scraper.sites.${siteKey}.stealth.spoofLanguages`, true),
      randomizeViewport: this.configService.get<boolean>(`scraper.sites.${siteKey}.stealth.randomizeViewport`, true),
      realisticTiming: this.configService.get<boolean>(`scraper.sites.${siteKey}.stealth.realisticTiming`, true),
      addMouseMovements: this.configService.get<boolean>(`scraper.sites.${siteKey}.stealth.addMouseMovements`, false), // Disabled by default for performance
    };
  }

  /**
   * Get evasion strategy for a specific site
   */
  getEvasionStrategy(siteName: string): EvasionStrategy {
    const siteKey = this.convertSiteNameToConfigKey(siteName);
    
    // Site-specific strategies
    if (siteName === 'jobs.bg') {
      return {
        randomDelay: { min: 2000, max: 5000 }, // Longer delays for jobs.bg
        scrollPage: true,
        mouseMovements: false,
        maxSessionRequests: 20, // Rotate sessions more frequently
        sessionRotationInterval: 30, // 30 minutes
      };
    }
    
    if (siteName === 'dev.bg') {
      return {
        randomDelay: { min: 1000, max: 3000 }, // Shorter delays for dev.bg
        scrollPage: false, // Less aggressive for dev.bg
        mouseMovements: false,
        maxSessionRequests: 50, // Can handle more requests
        sessionRotationInterval: 60, // 1 hour
      };
    }

    // Default strategy
    return {
      randomDelay: {
        min: this.configService.get<number>(`scraper.sites.${siteKey}.evasion.minDelay`, 1500),
        max: this.configService.get<number>(`scraper.sites.${siteKey}.evasion.maxDelay`, 4000),
      },
      scrollPage: this.configService.get<boolean>(`scraper.sites.${siteKey}.evasion.scrollPage`, true),
      mouseMovements: this.configService.get<boolean>(`scraper.sites.${siteKey}.evasion.mouseMovements`, false),
      maxSessionRequests: this.configService.get<number>(`scraper.sites.${siteKey}.evasion.maxSessionRequests`, 30),
      sessionRotationInterval: this.configService.get<number>(`scraper.sites.${siteKey}.evasion.sessionRotationInterval`, 45),
    };
  }

  /**
   * Get a random realistic user agent
   */
  getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  /**
   * Get a random realistic viewport
   */
  getRandomViewport(): { width: number; height: number } {
    return this.viewports[Math.floor(Math.random() * this.viewports.length)];
  }

  /**
   * Get random realistic language settings
   */
  getRandomLanguages(): string[] {
    return this.languages[Math.floor(Math.random() * this.languages.length)];
  }

  /**
   * Get comprehensive browser headers for stealth
   */
  getRealisticHeaders(userAgent: string): Record<string, string> {
    const isMobile = userAgent.includes('Mobile');
    const isFirefox = userAgent.includes('Firefox');
    const isChrome = userAgent.includes('Chrome') && !userAgent.includes('Firefox');

    const headers: Record<string, string> = {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9,bg;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Cache-Control': 'max-age=0',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
    };

    // Chrome-specific headers
    if (isChrome) {
      headers['sec-ch-ua'] = '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"';
      headers['sec-ch-ua-mobile'] = isMobile ? '?1' : '?0';
      headers['sec-ch-ua-platform'] = isMobile ? '"Android"' : '"Windows"';
    }

    // Firefox doesn't send sec-ch headers
    if (isFirefox) {
      delete headers['sec-ch-ua'];
      delete headers['sec-ch-ua-mobile'];
      delete headers['sec-ch-ua-platform'];
    }

    return headers;
  }

  /**
   * Get stealth plugin options for puppeteer-extra-plugin-stealth
   */
  getStealthPluginOptions() {
    return {
      enabledEvasions: new Set([
        'chrome.app',
        'chrome.csi',
        'chrome.loadTimes',
        'chrome.runtime',
        'defaultArgs',
        'iframe.contentWindow',
        'media.codecs',
        'navigator.hardwareConcurrency',
        'navigator.languages',
        'navigator.permissions',
        'navigator.plugins',
        'navigator.vendor',
        'navigator.webdriver',
        'sourceurl',
        'user-agent-override',
        'webgl.vendor',
        'window.outerdimensions',
      ]),
    };
  }

  /**
   * Generate realistic mouse movement patterns
   */
  generateMouseMovements(viewport: { width: number; height: number }): Array<{ x: number; y: number }> {
    const movements: Array<{ x: number; y: number }> = [];
    const numMovements = Math.floor(Math.random() * 5) + 3; // 3-7 movements

    for (let i = 0; i < numMovements; i++) {
      movements.push({
        x: Math.floor(Math.random() * viewport.width),
        y: Math.floor(Math.random() * viewport.height),
      });
    }

    return movements;
  }

  /**
   * Get random delay within range
   */
  getRandomDelay(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Check if session should be rotated based on usage
   */
  shouldRotateSession(requestCount: number, createdAt: Date, strategy: EvasionStrategy): boolean {
    const now = new Date();
    const sessionAgeMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

    return (
      requestCount >= strategy.maxSessionRequests ||
      sessionAgeMinutes >= strategy.sessionRotationInterval
    );
  }

  /**
   * Get configuration for specific anti-detection measures
   */
  getAntiDetectionConfig() {
    return {
      // Disable images for faster loading
      blockImages: this.configService.get<boolean>('scraper.performance.blockImages', true),
      
      // Block unnecessary resources
      blockResources: ['font', 'image', 'media', 'stylesheet'] as const,
      
      // JavaScript evaluation timeout
      jsTimeout: this.configService.get<number>('scraper.performance.jsTimeout', 30000),
      
      // Network idle timeout
      networkIdleTimeout: this.configService.get<number>('scraper.performance.networkIdleTimeout', 2000),
      
      // Maximum page load timeout
      maxLoadTimeout: this.configService.get<number>('scraper.performance.maxLoadTimeout', 60000),
    };
  }

  /**
   * Convert site name to configuration key
   */
  private convertSiteNameToConfigKey(siteName: string): string {
    return siteName
      .replace(/[.-]/g, '') // Remove dots and dashes
      .replace(/bg$/i, 'Bg'); // Capitalize 'Bg' suffix
  }
}