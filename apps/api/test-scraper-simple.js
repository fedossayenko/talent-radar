// Simple test to fetch dev.bg directly and check HTML structure
const axios = require('axios');
const cheerio = require('cheerio');

async function testDevBgScraping() {
  try {
    console.log('🔍 Testing direct dev.bg HTML scraping...');
    
    const url = 'https://dev.bg/company/jobs/java/';
    console.log(`Fetching URL: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'TalentRadar/1.0 (Job Aggregator)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 30000,
    });

    console.log(`✅ Response status: ${response.status}`);
    console.log(`📊 HTML length: ${response.data.length} characters`);
    
    // Parse with Cheerio
    const $ = cheerio.load(response.data);
    
    // Find job listings
    const jobElements = $('.job-list-item');
    console.log(`🎯 Found ${jobElements.length} job listings with .job-list-item selector`);
    
    if (jobElements.length === 0) {
      // Try alternative selectors
      const altSelectors = [
        '.job-item',
        '.job-listing',
        '[class*="job"]',
        'article[class*="job"]',
        '.card',
        '[data-job-id]'
      ];
      
      for (const selector of altSelectors) {
        const count = $(selector).length;
        console.log(`   Alternative selector "${selector}": ${count} elements`);
      }
    } else {
      // Analyze first few job listings
      console.log('📝 Analyzing first 3 job listings:');
      
      jobElements.slice(0, 3).each((index, element) => {
        const $element = $(element);
        
        console.log(`\n--- Job ${index + 1} ---`);
        console.log(`Job ID: ${$element.attr('data-job-id') || 'N/A'}`);
        
        // Try to find title
        const titleSelectors = ['h6.job-title a', 'h3.job-title a', '.job-title', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
        for (const selector of titleSelectors) {
          const title = $element.find(selector).text().trim();
          if (title) {
            console.log(`Title (${selector}): "${title}"`);
            break;
          }
        }
        
        // Try to find company
        const companySelectors = ['span.company-name', '.company-name', '.company', '[class*="company"]'];
        for (const selector of companySelectors) {
          const company = $element.find(selector).text().trim();
          if (company) {
            console.log(`Company (${selector}): "${company}"`);
            break;
          }
        }
        
        // Try to find location
        const locationSelectors = ['span.badge', '.badge', '.location', '[class*="location"]'];
        for (const selector of locationSelectors) {
          const location = $element.find(selector).text().trim();
          if (location) {
            console.log(`Location (${selector}): "${location}"`);
            break;
          }
        }
        
        // Try to find technologies
        const techImages = $element.find('img[title]');
        if (techImages.length > 0) {
          const techs = [];
          techImages.each((_, img) => {
            const title = $(img).attr('title');
            if (title) techs.push(title);
          });
          console.log(`Technologies: ${techs.join(', ')}`);
        }
        
        console.log('HTML snippet:', $element.html().substring(0, 200) + '...');
      });
    }
    
    console.log('\n✅ HTML structure analysis completed!');
    
  } catch (error) {
    console.error('❌ Error testing dev.bg scraping:', error.message);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response headers:`, error.response.headers);
    }
  }
}

testDevBgScraping();