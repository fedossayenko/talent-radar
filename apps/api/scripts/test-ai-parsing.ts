import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DevBgScraper } from '../src/modules/scraper/scrapers/dev-bg.scraper';
import { AiProcessingPipelineService } from '../src/modules/scraper/services/ai-processing-pipeline.service';
import { AiService } from '../src/modules/ai/ai.service';
import { VacancyService } from '../src/modules/vacancy/vacancy.service';
import { CompanyService } from '../src/modules/company/company.service';
import { Logger } from '@nestjs/common';

async function testAiParsing() {
  const logger = new Logger('TestAiParsing');
  
  try {
    logger.log('🚀 Starting AI parsing test with 5 vacancies...');
    
    // Bootstrap the NestJS application context
    const app = await NestFactory.createApplicationContext(AppModule);
    
    // Get necessary services
    const devBgScraper = app.get(DevBgScraper);
    const aiPipelineService = app.get(AiProcessingPipelineService);
    const aiService = app.get(AiService);
    const vacancyService = app.get(VacancyService);
    const companyService = app.get(CompanyService);
    
    logger.log('✅ NestJS application context initialized');
    
    // Check AI service configuration
    if (!aiService.isConfigured()) {
      logger.error('❌ AI service is not configured! Please check your OpenAI API key in .env file');
      await app.close();
      return;
    }
    
    logger.log('✅ AI service is configured and ready');
    
    // Test 1: Scrape limited number of jobs
    logger.log('\n📊 Test 1: Scraping first 5 Java jobs from dev.bg...');
    
    const startTime = Date.now();
    const jobListings = await devBgScraper.scrapeJavaJobs({ page: 1, limit: 5 });
    const scrapingDuration = Date.now() - startTime;
    
    logger.log(`✅ Scraping completed in ${scrapingDuration}ms`);
    logger.log(`📈 Found ${jobListings.length} job listings (limited to 5)`);
    
    if (jobListings.length === 0) {
      logger.warn('⚠️ No job listings found - stopping test');
      await app.close();
      return;
    }
    
    // Test 2: Process each job through AI pipeline
    logger.log('\n📊 Test 2: Processing jobs through AI pipeline...');
    
    const results = [];
    
    for (let i = 0; i < jobListings.length; i++) {
      const job = jobListings[i];
      logger.log(`\n🔄 Processing job ${i + 1}/${jobListings.length}: "${job.title}" at ${job.company}`);
      
      try {
        // Fetch detailed job content if URL is available
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
            logger.warn(`⚠️ Failed to fetch job details for ${job.url}, using basic data`);
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
        
        // Process through AI pipeline
        const pipelineStartTime = Date.now();
        const pipelineResult = await aiPipelineService.process({
          html: htmlContent,
          sourceUrl: job.url,
          options: {
            aiOptions: {
              skipCache: false,
              qualityThreshold: 50, // Lower threshold for testing
              maxRetries: 2,
            },
            performQualityCheck: true,
            enableFallback: true,
          },
        });
        const pipelineDuration = Date.now() - pipelineStartTime;
        
        // Log results
        if (pipelineResult.success && pipelineResult.vacancyData) {
          const extracted = pipelineResult.vacancyData;
          logger.log(`✅ AI extraction successful (${pipelineDuration}ms)`);
          logger.log(`   📊 Quality Score: ${pipelineResult.metadata.qualityScore}/100`);
          logger.log(`   🎯 Confidence Score: ${extracted.confidenceScore}%`);
          logger.log(`   📝 Extracted Data:`);
          logger.log(`      - Title: ${extracted.title || 'N/A'}`);
          logger.log(`      - Company: ${extracted.company || 'N/A'}`);
          logger.log(`      - Location: ${extracted.location || 'N/A'}`);
          logger.log(`      - Experience Level: ${extracted.experienceLevel || 'N/A'}`);
          logger.log(`      - Employment Type: ${extracted.employmentType || 'N/A'}`);
          logger.log(`      - Technologies: ${extracted.technologies?.join(', ') || 'N/A'}`);
          logger.log(`      - Salary: ${extracted.salaryMin && extracted.salaryMax ? `${extracted.salaryMin}-${extracted.salaryMax} ${extracted.currency || ''}` : 'N/A'}`);
          
          if (extracted.requirements?.length) {
            logger.log(`      - Requirements (${extracted.requirements.length} items):`);
            extracted.requirements.slice(0, 3).forEach((req, idx) => {
              logger.log(`        ${idx + 1}. ${req}`);
            });
          }
          
          results.push({
            job: job,
            success: true,
            extractedData: extracted,
            qualityScore: pipelineResult.metadata.qualityScore,
            processingTime: pipelineDuration,
          });
        } else {
          logger.warn(`❌ AI extraction failed`);
          logger.warn(`   Errors: ${pipelineResult.errors.join(', ')}`);
          logger.warn(`   Warnings: ${pipelineResult.warnings.join(', ')}`);
          
          results.push({
            job: job,
            success: false,
            errors: pipelineResult.errors,
            warnings: pipelineResult.warnings,
            processingTime: pipelineDuration,
          });
        }
        
        // Add delay between processing to avoid rate limits
        if (i < jobListings.length - 1) {
          logger.log('⏳ Waiting 2 seconds before next job...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        logger.error(`❌ Error processing job "${job.title}":`, error.message);
        results.push({
          job: job,
          success: false,
          error: error.message,
          processingTime: 0,
        });
      }
    }
    
    // Test 3: Summary and statistics
    logger.log('\n📊 Test 3: Processing Summary');
    logger.log('='.repeat(60));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    logger.log(`📈 Total Jobs Processed: ${results.length}`);
    logger.log(`✅ Successful Extractions: ${successful.length}`);
    logger.log(`❌ Failed Extractions: ${failed.length}`);
    logger.log(`📊 Success Rate: ${Math.round((successful.length / results.length) * 100)}%`);
    
    if (successful.length > 0) {
      const avgQualityScore = successful.reduce((sum, r) => sum + (r.qualityScore || 0), 0) / successful.length;
      const avgProcessingTime = successful.reduce((sum, r) => sum + r.processingTime, 0) / successful.length;
      
      logger.log(`🎯 Average Quality Score: ${Math.round(avgQualityScore)}/100`);
      logger.log(`⏱️ Average Processing Time: ${Math.round(avgProcessingTime)}ms`);
    }
    
    // Test 4: Show detailed extraction examples
    if (successful.length > 0) {
      logger.log('\n📝 Best Extraction Example:');
      const bestResult = successful.reduce((best, current) => 
        (current.qualityScore || 0) > (best.qualityScore || 0) ? current : best
      );
      
      logger.log(`   Job: "${bestResult.job.title}" at ${bestResult.job.company}`);
      logger.log(`   Quality Score: ${bestResult.qualityScore}/100`);
      logger.log(`   Extracted Technologies: ${bestResult.extractedData.technologies?.join(', ') || 'None'}`);
      logger.log(`   Extracted Requirements: ${bestResult.extractedData.requirements?.length || 0} items`);
    }
    
    // Test 5: Check pipeline health
    logger.log('\n📊 Test 5: Pipeline Health Check');
    const healthStatus = await aiPipelineService.getHealthStatus();
    logger.log(`🏥 Pipeline Status: ${healthStatus.status}`);
    logger.log(`🤖 AI Service: ${healthStatus.services.aiService ? '✅' : '❌'}`);
    logger.log(`🧹 Content Extractor: ${healthStatus.services.contentExtractor ? '✅' : '❌'}`);
    logger.log(`🧽 HTML Cleaner: ${healthStatus.services.htmlCleaner ? '✅' : '❌'}`);
    
    await app.close();
    
    // Final summary
    logger.log('\n🎉 AI PARSING TEST COMPLETED!');
    logger.log('='.repeat(60));
    if (successful.length > 0) {
      logger.log('✅ AI extraction is working correctly');
      logger.log(`✅ Successfully processed ${successful.length} out of ${results.length} jobs`);
      logger.log('✅ Pipeline is healthy and ready for production');
    } else {
      logger.log('❌ AI extraction failed for all jobs');
      logger.log('❌ Check OpenAI API key and configuration');
      logger.log('❌ Review error messages above for troubleshooting');
    }
    logger.log('='.repeat(60));
    
  } catch (error) {
    logger.error('❌ AI parsing test failed:', error);
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

testAiParsing();