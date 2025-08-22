#!/usr/bin/env node

/**
 * Test script to analyze extraction from a specific dev.bg vacancy URL
 * Usage: npx ts-node scripts/test-specific-vacancy.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../apps/api/src/app.module';
import { DevBgScraper } from '../apps/api/src/modules/scraper/scrapers/dev-bg.scraper';
import { AiService } from '../apps/api/src/modules/ai/ai.service';
import * as fs from 'fs';
import * as path from 'path';

const REDIS_VACANCY_URL = 'https://dev.bg/company/jobads/redis-java-software-engineer-cloud-unit/';

async function testSpecificVacancy() {
  console.log('🚀 Starting specific vacancy extraction test...');
  console.log(`📍 Target URL: ${REDIS_VACANCY_URL}`);
  
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    const devBgScraper = app.get(DevBgScraper);
    const aiService = app.get(AiService);
    
    console.log('\n📥 Step 1: Fetching job details from dev.bg...');
    const jobDetails = await devBgScraper.fetchJobDetails(REDIS_VACANCY_URL);
    
    console.log('\n📊 Step 2: Raw HTML Analysis');
    console.log(`- Description length: ${jobDetails.description?.length || 0} chars`);
    console.log(`- Requirements length: ${jobDetails.requirements?.length || 0} chars`);
    console.log(`- Raw HTML length: ${jobDetails.rawHtml?.length || 0} chars`);
    console.log(`- Company Profile URL: ${jobDetails.companyProfileUrl || 'Not found'}`);
    console.log(`- Company Website: ${jobDetails.companyWebsite || 'Not found'}`);
    
    // Save raw HTML for manual inspection
    if (jobDetails.rawHtml) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const htmlFile = path.join(process.cwd(), `logs/raw-html-${timestamp}.html`);
      await fs.promises.mkdir(path.dirname(htmlFile), { recursive: true });
      await fs.promises.writeFile(htmlFile, jobDetails.rawHtml);
      console.log(`\n💾 Raw HTML saved to: ${htmlFile}`);
    }
    
    console.log('\n🤖 Step 3: Running AI extraction...');
    const extractionResult = await aiService.extractVacancyData(
      jobDetails.rawHtml || jobDetails.description || '',
      REDIS_VACANCY_URL
    );
    
    if (extractionResult) {
      console.log('\n✅ AI Extraction Results:');
      console.log('=====================================');
      
      // Basic Information
      console.log('\n📋 Basic Information:');
      console.log(`- Title: ${extractionResult.title || 'Not extracted'}`);
      console.log(`- Company: ${extractionResult.company || 'Not extracted'}`);
      console.log(`- Location: ${extractionResult.location || 'Not extracted'}`);
      console.log(`- Experience Level: ${extractionResult.experienceLevel || 'Not extracted'}`);
      console.log(`- Employment Type: ${extractionResult.employmentType || 'Not extracted'}`);
      console.log(`- Work Model: ${extractionResult.workModel || 'Not extracted'}`);
      
      // Salary Information
      console.log('\n💰 Salary Information:');
      console.log(`- Salary Min: ${extractionResult.salaryMin || 'Not extracted'}`);
      console.log(`- Salary Max: ${extractionResult.salaryMax || 'Not extracted'}`);
      console.log(`- Currency: ${extractionResult.currency || 'Not extracted'}`);
      
      // Job Content
      console.log('\n📝 Job Content:');
      console.log(`- Description Length: ${extractionResult.description?.length || 0} chars`);
      console.log(`- Requirements Count: ${extractionResult.requirements?.length || 0} items`);
      console.log(`- Responsibilities Count: ${extractionResult.responsibilities?.length || 0} items`);
      console.log(`- Technologies Count: ${extractionResult.technologies?.length || 0} items`);
      console.log(`- Benefits Count: ${extractionResult.benefits?.length || 0} items`);
      
      // Company Information
      console.log('\n🏢 Company Information:');
      console.log(`- Industry: ${extractionResult.industry || 'Not extracted'}`);
      console.log(`- Company Size: ${extractionResult.companySize || 'Not extracted'}`);
      console.log(`- Team Size: ${extractionResult.teamSize || 'Not extracted'}`);
      
      // Quality Metrics
      console.log('\n📊 Quality Metrics:');
      console.log(`- Confidence Score: ${extractionResult.confidenceScore}%`);
      console.log(`- Quality Score: ${extractionResult.qualityScore}%`);
      
      // Detailed Arrays
      if (extractionResult.technologies && extractionResult.technologies.length > 0) {
        console.log(`\n🔧 Technologies Extracted: ${extractionResult.technologies.join(', ')}`);
      }
      
      if (extractionResult.requirements && extractionResult.requirements.length > 0) {
        console.log(`\n📋 Requirements (first 3):`);
        extractionResult.requirements.slice(0, 3).forEach((req, i) => {
          console.log(`  ${i + 1}. ${req}`);
        });
      }
      
      if (extractionResult.benefits && extractionResult.benefits.length > 0) {
        console.log(`\n🎁 Benefits: ${extractionResult.benefits.join(', ')}`);
      }
      
      // Save extraction results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const resultFile = path.join(process.cwd(), `logs/extraction-result-${timestamp}.json`);
      await fs.promises.writeFile(resultFile, JSON.stringify(extractionResult, null, 2));
      console.log(`\n💾 Extraction results saved to: ${resultFile}`);
      
    } else {
      console.log('\n❌ AI extraction failed - no results returned');
    }
    
    console.log('\n🎯 Step 4: Analysis Summary');
    console.log('=====================================');
    console.log('Current extraction covers:');
    console.log('✅ Basic job information (title, company, location)');
    console.log('✅ Employment details (type, experience level)');
    console.log('✅ Technologies and requirements');
    console.log('✅ Quality scoring');
    
    console.log('\n❌ Missing information that could be extracted:');
    console.log('- Number of open positions');
    console.log('- Visa sponsorship details');
    console.log('- Specific team/project information');
    console.log('- Interview process details');
    console.log('- Career growth opportunities');
    console.log('- Work environment specifics');
    console.log('- Office facilities and perks');
    console.log('- Remote work policies');
    console.log('- Travel requirements');
    console.log('- On-call expectations');
    
    console.log('\n📈 Next Steps:');
    console.log('1. Review saved HTML file to see full page content');
    console.log('2. Compare extraction results with actual job posting');
    console.log('3. Identify specific fields missing from current extraction');
    console.log('4. Implement enhanced HTML parsing and field expansion');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await app.close();
  }
}

// Run the test
testSpecificVacancy().catch(console.error);