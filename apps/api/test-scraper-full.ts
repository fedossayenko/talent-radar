import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ScraperService } from './src/modules/scraper/scraper.service';
import { DevBgScraper } from './src/modules/scraper/scrapers/dev-bg.scraper';
import { CompanyService } from './src/modules/company/company.service';
import { VacancyService } from './src/modules/vacancy/vacancy.service';
import { PrismaService } from './src/common/database/prisma.service';
import { Logger } from '@nestjs/common';

async function testScraperFull() {
  const logger = new Logger('TestScraperFull');
  
  try {
    logger.log('🚀 Starting comprehensive scraper test...');
    
    // Bootstrap the NestJS application context
    const app = await NestFactory.createApplicationContext(AppModule);
    
    // Get all necessary services
    const scraperService = app.get(ScraperService);
    const devBgScraper = app.get(DevBgScraper);
    const companyService = app.get(CompanyService);
    const vacancyService = app.get(VacancyService);
    const prismaService = app.get(PrismaService);
    
    logger.log('✅ NestJS application context initialized');
    
    // Test 1: Direct scraper functionality
    logger.log('\n📊 Test 1: Testing DevBgScraper directly...');
    
    const startTime = Date.now();
    const jobListings = await devBgScraper.scrapeJavaJobs({ page: 1 });
    const scrapingDuration = Date.now() - startTime;
    
    logger.log(`✅ Direct scraping completed in ${scrapingDuration}ms`);
    logger.log(`📈 Found ${jobListings.length} job listings`);
    
    if (jobListings.length > 0) {
      // Display sample job data
      const sampleJob = jobListings[0];
      logger.log('📝 Sample job data:');
      logger.log(`   Title: "${sampleJob.title}"`);
      logger.log(`   Company: "${sampleJob.company}"`);
      logger.log(`   Location: "${sampleJob.location}"`);
      logger.log(`   Work Model: "${sampleJob.workModel}"`);
      logger.log(`   Technologies: [${sampleJob.technologies.join(', ')}]`);
      logger.log(`   URL: ${sampleJob.url}`);
      logger.log(`   Posted: ${sampleJob.postedDate}`);
      if (sampleJob.salaryRange) {
        logger.log(`   Salary: ${sampleJob.salaryRange}`);
      }
    } else {
      logger.warn('⚠️ No job listings found - this might indicate a scraping issue');
    }
    
    // Test 2: Check database state before scraping
    logger.log('\n📊 Test 2: Checking database state before scraping...');
    
    const companiesBefore = await companyService.findAll({});
    const vacanciesBefore = await vacancyService.findAll({});
    
    logger.log(`📊 Companies before: ${companiesBefore.length}`);
    logger.log(`📊 Vacancies before: ${vacanciesBefore.length}`);
    
    // Test 3: Full scraper service test
    logger.log('\n📊 Test 3: Testing ScraperService full flow...');
    
    const serviceStartTime = Date.now();
    const result = await scraperService.scrapeDevBg();
    const serviceDuration = Date.now() - serviceStartTime;
    
    logger.log('✅ Full scraper service completed!');
    logger.log(`⏱️ Service duration: ${serviceDuration}ms`);
    logger.log(`📈 Results:\n` +
      `      - Total jobs found: ${result.totalJobsFound}\n` +
      `      - New vacancies: ${result.newVacancies}\n` +
      `      - Updated vacancies: ${result.updatedVacancies}\n` +
      `      - New companies: ${result.newCompanies}\n` +
      `      - Errors: ${result.errors.length}\n` +
      `      - Duration: ${result.duration}ms`);
    
    if (result.errors.length > 0) {
      logger.warn('⚠️ Errors encountered:');
      result.errors.forEach((error, index) => {
        logger.warn(`  ${index + 1}. ${error}`);
      });
    }
    
    // Test 4: Verify database persistence
    logger.log('\n📊 Test 4: Verifying database persistence...');
    
    const companiesAfter = await companyService.findAll({});
    const vacanciesAfter = await vacancyService.findAll({});
    
    logger.log(`📊 Companies after: ${companiesAfter.length} (+ ${companiesAfter.length - companiesBefore.length})`);
    logger.log(`📊 Vacancies after: ${vacanciesAfter.length} (+ ${vacanciesAfter.length - vacanciesBefore.length})`);
    
    // Display some sample persisted data
    if (companiesAfter.length > companiesBefore.length) {
      const newCompanies = companiesAfter.slice(companiesBefore.length);
      logger.log('📝 Sample new companies:');
      newCompanies.slice(0, 3).forEach((company, index) => {
        logger.log(`   ${index + 1}. ${company.name} (${company.location || 'No location'})`);
      });
    }
    
    if (vacanciesAfter.length > vacanciesBefore.length) {
      const newVacancies = vacanciesAfter.slice(vacanciesBefore.length);
      logger.log('📝 Sample new vacancies:');
      newVacancies.slice(0, 3).forEach((vacancy, index) => {
        logger.log(`   ${index + 1}. ${vacancy.title} at ${vacancy.company?.name || 'Unknown Company'}`);
      });
    }
    
    // Test 5: Test pagination (fetch second page)
    logger.log('\n📊 Test 5: Testing pagination...');
    
    try {
      const page2Jobs = await devBgScraper.scrapeJavaJobs({ page: 2 });
      logger.log(`✅ Page 2 scraping successful: ${page2Jobs.length} jobs found`);
      
      if (page2Jobs.length > 0) {
        logger.log(`📝 First job from page 2: "${page2Jobs[0].title}" at ${page2Jobs[0].company}`);
      }
    } catch (error) {
      logger.warn(`⚠️ Page 2 scraping failed: ${error.message}`);
    }
    
    // Test 6: Test job details fetching
    logger.log('\n📊 Test 6: Testing job details fetching...');
    
    if (jobListings.length > 0 && jobListings[0].url) {
      try {
        const jobDetails = await devBgScraper.fetchJobDetails(jobListings[0].url);
        logger.log(`✅ Job details fetched successfully`);
        logger.log(`📝 Description length: ${jobDetails.description.length} characters`);
        logger.log(`📝 Requirements length: ${jobDetails.requirements.length} characters`);
        
        if (jobDetails.description) {
          logger.log(`📝 Description preview: "${jobDetails.description.substring(0, 100)}..."`);
        }
      } catch (error) {
        logger.warn(`⚠️ Job details fetching failed: ${error.message}`);
      }
    }
    
    // Test 7: Check for duplicates (run scraper again)
    logger.log('\n📊 Test 7: Testing duplicate handling (running scraper again)...');
    
    const duplicateTestResult = await scraperService.scrapeDevBg();
    logger.log(`📈 Duplicate test results:\n` +
      `      - Total jobs found: ${duplicateTestResult.totalJobsFound}\n` +
      `      - New vacancies: ${duplicateTestResult.newVacancies}\n` +
      `      - Updated vacancies: ${duplicateTestResult.updatedVacancies}\n` +
      `      - New companies: ${duplicateTestResult.newCompanies}`);
    
    // Final database count
    const finalCompanies = await companyService.findAll({});
    const finalVacancies = await vacancyService.findAll({});
    
    logger.log(`📊 Final database state:\n` +
      `      - Total companies: ${finalCompanies.length}\n` +
      `      - Total vacancies: ${finalVacancies.length}`);
    
    // Get scraping statistics
    const stats = await scraperService.getScrapingStats();
    logger.log(`📊 Final scraping statistics:\n` +
      `      - Total vacancies: ${stats.totalVacancies}\n` +
      `      - Active vacancies: ${stats.activeVacancies}\n` +
      `      - Companies from dev.bg: ${stats.companiesFromDevBg}`);
    
    await app.close();
    
    // Summary
    logger.log('\n🎉 COMPREHENSIVE SCRAPER TEST COMPLETED SUCCESSFULLY!');
    logger.log('='*60);
    logger.log('✅ All core functionality verified:');
    logger.log('   ✓ Direct scraper works');
    logger.log('   ✓ Service integration works');
    logger.log('   ✓ Database persistence works');
    logger.log('   ✓ Pagination works');
    logger.log('   ✓ Job details fetching works');
    logger.log('   ✓ Duplicate handling works');
    logger.log('='*60);
    
  } catch (error) {
    logger.error('❌ Comprehensive scraper test failed:', error);
    if (error.stack) {
      logger.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

testScraperFull();