#!/usr/bin/env npx ts-node

import { ConfigService } from '@nestjs/config';
import { JobsBgScraper } from '../src/modules/scraper/scrapers/jobs-bg.scraper';
import { StealthBrowserEngineService } from '../src/modules/scraper/services/stealth-browser-engine.service';

async function testJobsBgScraper() {
  console.log('Starting simplified jobs.bg scraper test...');
  
  try {
    // Create mock config service
    const configService = new ConfigService({
      'scraper.sites.jobsBg.baseUrl': 'https://www.jobs.bg',
      'scraper.sites.jobsBg.searchUrl': 'https://www.jobs.bg/en/front_job_search.php',
      'scraper.sites.jobsBg.maxPages': 10,
      'scraper.sessionDir': './scraper-sessions',
    });
    
    // Create stealth browser engine service
    const stealthBrowserEngine = new StealthBrowserEngineService(configService);
    
    // Create scraper
    const scraper = new JobsBgScraper(configService, stealthBrowserEngine);
    
    console.log('Jobs.bg scraper created, starting scraping...');
    
    // Test scraping with Java keywords
    const result = await scraper.scrapeJobs({
      page: 1,
      limit: 5,
      keywords: ['Java'],
    });
    
    console.log('Scraping result:', JSON.stringify(result, null, 2));
    
    if (result.errors.length > 0) {
      console.error('Errors encountered:', result.errors);
    }
    
    if (result.jobs.length > 0) {
      console.log(`Found ${result.jobs.length} jobs`);
      console.log('First job:', result.jobs[0]);
    } else {
      console.log('No jobs found');
    }
    
    console.log('Test completed');
    
    // Clean up
    await stealthBrowserEngine.onModuleDestroy();
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testJobsBgScraper().catch(console.error);