// Simple test script to verify scraper functionality
const axios = require('axios');

async function testScrapingAPI() {
  try {
    console.log('🔍 Testing scraper functionality...');
    
    // Test API health first
    console.log('1. Testing API health...');
    const healthResponse = await axios.get('http://localhost:3000/api/v1/health');
    console.log('✅ API is healthy:', healthResponse.data);
    
    // Check if we can get companies and vacancies before scraping
    console.log('\n2. Checking current database state...');
    
    try {
      const companiesResponse = await axios.get('http://localhost:3000/api/v1/companies');
      console.log(`📊 Current companies: ${companiesResponse.data.length || 0}`);
    } catch (error) {
      console.log('📊 Companies endpoint response:', error.response?.status);
    }
    
    try {
      const vacanciesResponse = await axios.get('http://localhost:3000/api/v1/vacancies');
      console.log(`📊 Current vacancies: ${vacanciesResponse.data.length || 0}`);
    } catch (error) {
      console.log('📊 Vacancies endpoint response:', error.response?.status);
    }
    
    console.log('\n✅ Basic API connectivity test completed!');
    console.log('\nNext steps to test scraper:');
    console.log('1. Manually trigger scraper in code');
    console.log('2. Check database content in Prisma Studio (http://localhost:5556)');
    console.log('3. Verify data persistence');
    
  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
}

testScrapingAPI();