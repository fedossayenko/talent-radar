import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DevBgScraper } from '../src/modules/scraper/scrapers/dev-bg.scraper';
import { AiService } from '../src/modules/ai/ai.service';
import { Logger } from '@nestjs/common';

async function showAiResults() {
  const logger = new Logger('ShowAiResults');
  
  try {
    logger.log('🚀 Starting AI results demo...');
    
    // Bootstrap the NestJS application context
    const app = await NestFactory.createApplicationContext(AppModule);
    
    // Get necessary services
    const devBgScraper = app.get(DevBgScraper);
    const aiService = app.get(AiService);
    
    logger.log('✅ Services initialized');
    
    // Test 1: Scrape one job
    logger.log('\n📊 Scraping 1 Java job from dev.bg...');
    const jobListings = await devBgScraper.scrapeJavaJobs({ page: 1, limit: 1 });
    
    if (jobListings.length === 0) {
      logger.warn('⚠️ No job listings found');
      await app.close();
      return;
    }
    
    const job = jobListings[0];
    logger.log(`\n🔄 Processing: "${job.title}" at ${job.company}`);
    
    // Fetch detailed job content
    let htmlContent = '';
    if (job.url) {
      try {
        const jobDetails = await devBgScraper.fetchJobDetails(job.url);
        htmlContent = `
          <div class="job-listing">
            <h1>${job.title}</h1>
            <div class="company">${job.company}</div>
            <div class="location">${job.location}</div>
            <div class="work-model">${job.workModel}</div>
            <div class="technologies">${job.technologies.join(', ')}</div>
            ${job.salaryRange ? `<div class="salary">${job.salaryRange}</div>` : ''}
            <div class="description">${jobDetails.description}</div>
            <div class="requirements">${jobDetails.requirements}</div>
          </div>
        `;
      } catch (error) {
        logger.warn(`⚠️ Failed to fetch job details, using basic data`);
        htmlContent = `
          <div class="job-listing">
            <h1>${job.title}</h1>
            <div class="company">${job.company}</div>
            <div class="location">${job.location}</div>
            <div class="work-model">${job.workModel}</div>
            <div class="technologies">${job.technologies.join(', ')}</div>
            ${job.salaryRange ? `<div class="salary">${job.salaryRange}</div>` : ''}
          </div>
        `;
      }
    }
    
    logger.log(`\n📝 Content to be processed by AI:`);
    logger.log(`Content length: ${htmlContent.length} characters`);
    logger.log(`Content preview: ${htmlContent.substring(0, 200)}...`);
    
    // Process through AI
    logger.log(`\n🤖 Calling GPT-5 Nano for extraction...`);
    const startTime = Date.now();
    const extractionResult = await aiService.extractVacancyData(htmlContent, job.url);
    const duration = Date.now() - startTime;
    
    if (extractionResult) {
      logger.log(`\n✅ AI Extraction Successful! (${duration}ms)`);
      logger.log(`🎯 Confidence Score: ${extractionResult.confidenceScore}%`);
      logger.log(`📊 Quality Score: ${extractionResult.qualityScore}`);
      
      logger.log(`\n📋 EXTRACTED DATA:`);
      logger.log(`=`.repeat(50));
      logger.log(`Title: ${extractionResult.title || 'N/A'}`);
      logger.log(`Company: ${extractionResult.company || 'N/A'}`);
      logger.log(`Location: ${extractionResult.location || 'N/A'}`);
      logger.log(`Experience Level: ${extractionResult.experienceLevel || 'N/A'}`);
      logger.log(`Employment Type: ${extractionResult.employmentType || 'N/A'}`);
      logger.log(`Work Model: ${extractionResult.workModel || 'N/A'}`);
      logger.log(`Industry: ${extractionResult.industry || 'N/A'}`);
      
      if (extractionResult.salaryMin && extractionResult.salaryMax) {
        logger.log(`Salary: ${extractionResult.salaryMin}-${extractionResult.salaryMax} ${extractionResult.currency || ''}`);
      } else {
        logger.log(`Salary: N/A`);
      }
      
      if (extractionResult.technologies?.length) {
        logger.log(`Technologies (${extractionResult.technologies.length}): ${extractionResult.technologies.join(', ')}`);
      } else {
        logger.log(`Technologies: N/A`);
      }
      
      if (extractionResult.requirements?.length) {
        logger.log(`\nRequirements (${extractionResult.requirements.length}):`);
        extractionResult.requirements.forEach((req, idx) => {
          logger.log(`  ${idx + 1}. ${req}`);
        });
      } else {
        logger.log(`Requirements: N/A`);
      }
      
      if (extractionResult.responsibilities?.length) {
        logger.log(`\nResponsibilities (${extractionResult.responsibilities.length}):`);
        extractionResult.responsibilities.forEach((resp, idx) => {
          logger.log(`  ${idx + 1}. ${resp}`);
        });
      } else {
        logger.log(`Responsibilities: N/A`);
      }
      
      if (extractionResult.benefits?.length) {
        logger.log(`\nBenefits (${extractionResult.benefits.length}):`);
        extractionResult.benefits.forEach((benefit, idx) => {
          logger.log(`  ${idx + 1}. ${benefit}`);
        });
      } else {
        logger.log(`Benefits: N/A`);
      }
      
      logger.log(`\n📊 METADATA:`);
      logger.log(`=`.repeat(50));
      logger.log(`Source Type: ${extractionResult.extractionMetadata.sourceType}`);
      logger.log(`Content Length: ${extractionResult.extractionMetadata.contentLength}`);
      logger.log(`Has Structured Data: ${extractionResult.extractionMetadata.hasStructuredData}`);
      logger.log(`Language: ${extractionResult.extractionMetadata.language}`);
      
      // Show raw JSON for debugging
      logger.log(`\n🔧 RAW JSON RESULT:`);
      logger.log(`=`.repeat(50));
      logger.log(JSON.stringify(extractionResult, null, 2));
      
    } else {
      logger.error(`❌ AI extraction failed after ${duration}ms`);
    }
    
    await app.close();
    
    logger.log(`\n🎉 AI RESULTS DEMO COMPLETED!`);
    
  } catch (error) {
    logger.error('❌ AI results demo failed:', error);
    if (error.stack) {
      logger.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

showAiResults();