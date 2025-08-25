#!/usr/bin/env npx ts-node

import * as fs from 'fs';
import * as cheerio from 'cheerio';

function extractFirstVacancy() {
  console.log('Extracting first vacancy from saved HTML...');
  
  try {
    // Read the HTML file
    const htmlFilePath = './debug-responses/jobs-bg-page-1-2025-08-25T08-33-45-384Z.html';
    if (!fs.existsSync(htmlFilePath)) {
      console.error('HTML file not found:', htmlFilePath);
      return null;
    }
    
    const html = fs.readFileSync(htmlFilePath, 'utf-8');
    const $ = cheerio.load(html);
    
    console.log('HTML loaded, looking for job listings...');
    
    // Find all job cards
    const jobCards = $('li .mdc-card');
    console.log(`Found ${jobCards.length} job cards`);
    
    if (jobCards.length > 0) {
      const firstJobCard = jobCards.first();
      const parentLi = firstJobCard.closest('li');
      
      console.log('Extracting data from first job card...');
      
      // Try multiple selectors for different parts
      const titleSelectors = ['.card-title', '[data-title]', '.job-title', 'h1', 'h2', 'h3'];
      const companySelectors = ['.card-logo-info', '.company-name', '[data-company]', '.company'];
      const locationSelectors = ['.card-info', '[data-location]', '.location'];
      
      let title = 'Title not found';
      let company = 'Company not found';
      let location = 'Location not found';
      
      // Extract title
      for (const selector of titleSelectors) {
        const element = firstJobCard.find(selector);
        if (element.length > 0) {
          title = element.text().trim();
          if (title) {
            console.log(`Found title with selector ${selector}: ${title}`);
            break;
          }
        }
      }
      
      // Extract company
      for (const selector of companySelectors) {
        const element = firstJobCard.find(selector);
        if (element.length > 0) {
          company = element.text().trim();
          if (company) {
            console.log(`Found company with selector ${selector}: ${company}`);
            break;
          }
        }
      }
      
      // Extract location  
      for (const selector of locationSelectors) {
        const element = firstJobCard.find(selector);
        if (element.length > 0) {
          location = element.text().trim();
          if (location) {
            console.log(`Found location with selector ${selector}: ${location}`);
            break;
          }
        }
      }
      
      const vacancy = {
        id: parentLi.attr('class') || 'unknown',
        title,
        company,
        location,
        url: firstJobCard.find('a').first().attr('href') || 'URL not found',
        extractedAt: new Date().toISOString(),
        rawHTML: firstJobCard.html()?.substring(0, 2000),
        allText: firstJobCard.text().substring(0, 1000)
      };
      
      // Save to file
      const fileName = `vacancy-extracted-${Date.now()}.json`;
      const filePath = `./debug-responses/${fileName}`;
      
      fs.writeFileSync(filePath, JSON.stringify(vacancy, null, 2));
      console.log(`Vacancy extracted and saved to: ${filePath}`);
      
      return filePath;
    }
    
    if (jobCards.length === 0) {
      console.log('No job cards found. Let\'s try different selectors...');
      
      // Try to understand the structure
      const liElements = $('li');
      console.log(`Found ${liElements.length} <li> elements`);
      
      // Look for elements with class numbers (like 121, 122, 123)
      const jobLis = $('li[class]').filter((i, el) => {
        const className = $(el).attr('class');
        return className && /^\d+$/.test(className);
      });
      
      console.log(`Found ${jobLis.length} numbered job <li> elements`);
      
      if (jobLis.length > 0) {
        const firstJob = jobLis.first();
        console.log('First job element HTML:');
        console.log(firstJob.html()?.substring(0, 500) + '...');
        
        // Try to extract basic info
        const vacancy = {
          id: firstJob.attr('class'),
          title: firstJob.find('.card-title, [data-title]').text().trim() || 'Title not found',
          company: firstJob.find('.card-logo-info, .company-name, [data-company]').text().trim() || 'Company not found',
          location: firstJob.find('.card-info, [data-location]').text().trim() || 'Location not found',
          url: firstJob.find('a').first().attr('href') || 'URL not found',
          extractedAt: new Date().toISOString(),
          rawHTML: firstJob.html()?.substring(0, 1000)
        };
        
        // Save to file
        const fileName = `vacancy-extracted-${Date.now()}.json`;
        const filePath = `./debug-responses/${fileName}`;
        
        fs.writeFileSync(filePath, JSON.stringify(vacancy, null, 2));
        console.log(`Vacancy extracted and saved to: ${filePath}`);
        
        return filePath;
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('Extraction failed:', error.message);
    return null;
  }
}

const filePath = extractFirstVacancy();
if (filePath) {
  console.log(`\n✅ SUCCESS: Vacancy extracted and saved to ${filePath}`);
} else {
  console.log('\n❌ FAILED: Could not extract vacancy');
}