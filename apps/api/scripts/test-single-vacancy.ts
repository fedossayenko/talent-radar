#!/usr/bin/env npx ts-node

import { ConfigService } from '@nestjs/config';
import { JobsBgScraper } from '../src/modules/scraper/scrapers/jobs-bg.scraper';
import { StealthBrowserEngineService } from '../src/modules/scraper/services/stealth-browser-engine.service';
import * as fs from 'fs';

async function testSingleVacancy() {
  console.log('Starting single vacancy scraping from jobs.bg...');
  
  try {
    // Create mock config service
    const configService = new ConfigService({
      'scraper.sites.jobsBg.baseUrl': 'https://www.jobs.bg',
      'scraper.sites.jobsBg.searchUrl': 'https://www.jobs.bg/en/front_job_search.php',
      'scraper.sites.jobsBg.maxPages': 10,
      'scraper.sessionDir': './scraper-sessions',
      'scraper.sites.jobsBg.stealth.warmupNavigation': 0.5,  // 50% chance for better success
    });
    
    // Create stealth browser engine service
    const stealthBrowserEngine = new StealthBrowserEngineService(configService);
    
    // Create scraper
    const scraper = new JobsBgScraper(configService, stealthBrowserEngine);
    
    console.log('Starting scraping for a single vacancy...');
    
    // Get just 1 job
    const result = await scraper.scrapeJobs({
      page: 1,
      limit: 1,
      keywords: ['Java'],
    });
    
    console.log(`Success: ${result.jobs.length > 0 ? 'YES' : 'NO'}`);
    console.log(`Jobs found: ${result.jobs.length}`);
    console.log(`Errors: ${result.errors.join(', ')}`);
    
    if (result.jobs.length > 0) {
      const vacancy = result.jobs[0];
      console.log('Vacancy found:', {
        title: vacancy.title,
        company: vacancy.company,
        location: vacancy.location,
        url: vacancy.url,
      });
      
      // Save to file
      const fileName = `vacancy-${Date.now()}.json`;
      const filePath = `./debug-responses/${fileName}`;
      
      // Ensure directory exists
      if (!fs.existsSync('./debug-responses')) {
        fs.mkdirSync('./debug-responses', { recursive: true });
      }
      
      fs.writeFileSync(filePath, JSON.stringify(vacancy, null, 2));
      console.log(`Vacancy saved to: ${filePath}`);
      
      return filePath;
    } else {
      console.log('No vacancies found');
      return null;
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    return null;
  } finally {
    // Clean up
    try {
      const stealthBrowserEngine = new StealthBrowserEngineService(
        new ConfigService({
          'scraper.sites.jobsBg.baseUrl': 'https://www.jobs.bg',
          'scraper.sessionDir': './scraper-sessions',
        })
      );
      await stealthBrowserEngine.onModuleDestroy();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

testSingleVacancy()
  .then((filePath) => {
    if (filePath) {
      console.log(`\n✅ SUCCESS: Vacancy saved to ${filePath}`);
    } else {
      console.log('\n❌ FAILED: No vacancy could be scraped');
    }
  })
  .catch(console.error);