#!/usr/bin/env npx ts-node

import { ConfigService } from '@nestjs/config';
import { JobsBgScraper } from '../src/modules/scraper/scrapers/jobs-bg.scraper';
import { StealthBrowserEngineService } from '../src/modules/scraper/services/stealth-browser-engine.service';

async function testJobsBgScraperQuick() {
  console.log('Starting quick jobs.bg stealth test...');
  
  try {
    // Create mock config service
    const configService = new ConfigService({
      'scraper.sites.jobsBg.baseUrl': 'https://www.jobs.bg',
      'scraper.sites.jobsBg.searchUrl': 'https://www.jobs.bg/en/front_job_search.php',
      'scraper.sites.jobsBg.maxPages': 10,
      'scraper.sessionDir': './scraper-sessions',
      'scraper.sites.jobsBg.stealth.warmupNavigation': 0,  // Disable warmup for quick test
    });
    
    // Create stealth browser engine service
    const stealthBrowserEngine = new StealthBrowserEngineService(configService);
    
    // Create scraper
    const scraper = new JobsBgScraper(configService, stealthBrowserEngine);
    
    console.log('Starting quick scraping (no warm-up)...');
    
    // Quick test - just check if we can get through DataDome
    const result = await scraper.scrapeJobs({
      page: 1,
      limit: 3,
      keywords: ['Java'],
    });
    
    console.log(`Success: ${result.jobs.length > 0 ? 'YES' : 'NO'}`);
    console.log(`Jobs found: ${result.jobs.length}`);
    console.log(`Errors: ${result.errors.join(', ')}`);
    
    if (result.jobs.length > 0) {
      console.log('First job:', {
        title: result.jobs[0].title,
        company: result.jobs[0].company,
        location: result.jobs[0].location,
      });
    }
    
    await stealthBrowserEngine.onModuleDestroy();
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testJobsBgScraperQuick().catch(console.error);