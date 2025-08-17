import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ScraperService } from './src/modules/scraper/scraper.service';
import { Logger } from '@nestjs/common';

async function testScraperDirect() {
  const logger = new Logger('TestScraperDirect');
  
  try {
    logger.log('🚀 Starting direct scraper test...');
    
    // Bootstrap the NestJS application
    const app = await NestFactory.createApplicationContext(AppModule);
    
    // Get the scraper service
    const scraperService = app.get(ScraperService);
    
    logger.log('📊 Testing dev.bg scraper...');
    
    // Execute the scraper
    const result = await scraperService.scrapeDevBg();
    
    logger.log('✅ Scraping completed successfully!');
    logger.log(`📈 Results:
      - Total jobs found: ${result.totalJobsFound}
      - New vacancies: ${result.newVacancies}
      - Updated vacancies: ${result.updatedVacancies}
      - New companies: ${result.newCompanies}
      - Errors: ${result.errors.length}
      - Duration: ${result.duration}ms`);
    
    if (result.errors.length > 0) {
      logger.warn('⚠️ Errors encountered:');
      result.errors.forEach((error, index) => {
        logger.warn(`  ${index + 1}. ${error}`);
      });
    }
    
    // Get stats after scraping
    const stats = await scraperService.getScrapingStats();
    logger.log(`📊 Database stats after scraping:
      - Total vacancies: ${stats.totalVacancies}
      - Active vacancies: ${stats.activeVacancies}
      - Companies from dev.bg: ${stats.companiesFromDevBg}`);
    
    await app.close();
    logger.log('✅ Test completed successfully!');
    
  } catch (error) {
    logger.error('❌ Error during scraper test:', error);
    process.exit(1);
  }
}

testScraperDirect();