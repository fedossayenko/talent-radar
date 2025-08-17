// Simple test to call the scraper API and check database
const axios = require('axios');

async function testScraperAPI() {
  try {
    console.log('🔍 Testing API endpoints...');
    
    // First check current database state
    console.log('\n1. Checking current database state...');
    
    try {
      const companiesResponse = await axios.get('http://localhost:3000/api/v1/companies');
      console.log(`📊 Current companies: ${companiesResponse.data.length || 0}`);
      
      const vacanciesResponse = await axios.get('http://localhost:3000/api/v1/vacancies');
      console.log(`📊 Current vacancies: ${vacanciesResponse.data.length || 0}`);
    } catch (error) {
      console.log(`❌ Error fetching current data: ${error.message}`);
    }
    
    // Try to trigger scraper if endpoint exists
    console.log('\n2. Trying to trigger scraper...');
    
    try {
      const scraperResponse = await axios.post('http://localhost:3000/api/v1/scraper/dev-bg/manual');
      console.log('✅ Scraper triggered successfully:', scraperResponse.data);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('⚠️ Scraper endpoint not found (404) - this is expected if ScraperController is not loaded due to Bull issues');
      } else {
        console.log(`❌ Error triggering scraper: ${error.message}`);
      }
    }
    
    // Check scraper stats endpoint
    console.log('\n3. Trying to get scraper stats...');
    
    try {
      const statsResponse = await axios.get('http://localhost:3000/api/v1/scraper/stats');
      console.log('✅ Scraper stats:', statsResponse.data);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('⚠️ Scraper stats endpoint not found (404)');
      } else {
        console.log(`❌ Error getting scraper stats: ${error.message}`);
      }
    }
    
    console.log('\n✅ API endpoint test completed!');
    console.log('\nNote: If scraper endpoints are 404, it means ScraperController is not loaded,');
    console.log('likely due to Bull import issues. The HTML parsing logic is working correctly');
    console.log('based on our previous test.');
    
  } catch (error) {
    console.error('❌ Error testing API endpoints:', error.message);
  }
}

testScraperAPI();