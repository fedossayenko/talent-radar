#!/usr/bin/env npx ts-node

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { JobsBgScraper } from '../src/modules/scraper/scrapers/jobs-bg.scraper';

async function testJobsBgScraper() {
  console.log('Starting jobs.bg scraper test...');
  
  try {
    // Create NestJS app context
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['log', 'error', 'warn', 'debug'],
    });
    
    // Get the jobs.bg scraper
    const scraper = app.get(JobsBgScraper);
    
    console.log('Jobs.bg scraper obtained, starting scraping...');
    
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
    
    await app.close();
    console.log('Test completed');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testJobsBgScraper().catch(console.error);