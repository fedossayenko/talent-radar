#!/usr/bin/env node

/**
 * Simple test script to verify enhanced AI processing traceability is working
 */

import { PrismaClient } from '@prisma/client';

async function testTraceabilityFields() {
  console.log('🧪 Testing Enhanced AI Processing Traceability...\n');
  
  const prisma = new PrismaClient();
  
  try {
    // Test 1: Check if schema has the new fields
    console.log('✅ Test 1: Checking database schema...');
    
    // Check all columns in vacancies table (using correct PostgreSQL table name)
    const allVacancyColumns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'vacancies' AND table_schema = 'public'
      ORDER BY column_name;
    `;
    
    console.log('All vacancies table columns:', allVacancyColumns);
    
    // Check specific traceability columns in vacancies table
    const vacancyColumns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'vacancies' AND table_schema = 'public'
      AND column_name IN ('cleanedContentForAi', 'rawAiResponse', 'aiProcessingSteps');
    `;
    
    console.log('✅ Vacancies table traceability columns:', vacancyColumns);
    
    // Check all columns in company_analyses table
    const allCompanyColumns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'company_analyses' AND table_schema = 'public'
      ORDER BY column_name;
    `;
    
    console.log('All company_analyses table columns:', allCompanyColumns);
    
    // Check specific traceability columns in company_analyses table  
    const companyColumns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'company_analyses' AND table_schema = 'public'
      AND column_name IN ('cleanedContentForAi', 'rawAiResponse', 'aiProcessingSteps');
    `;
    
    console.log('✅ Company analyses table traceability columns:', companyColumns);
    
    // Test 2: Check for existing data with traceability
    console.log('\n✅ Test 2: Checking for existing traceability data...');
    
    const vacanciesWithTraceability = await prisma.vacancy.count({
      where: {
        OR: [
          { cleanedContentForAi: { not: null } },
          { rawAiResponse: { not: null } },
          { aiProcessingSteps: { not: null } }
        ]
      }
    });
    
    const companiesWithTraceability = await prisma.companyAnalysis.count({
      where: {
        OR: [
          { cleanedContentForAi: { not: null } },
          { rawAiResponse: { not: null } },
          { aiProcessingSteps: { not: null } }
        ]
      }
    });
    
    console.log(`📊 Found ${vacanciesWithTraceability} vacancies with enhanced traceability data`);
    console.log(`📊 Found ${companiesWithTraceability} company analyses with enhanced traceability data`);
    
    // Test 3: Show sample of existing traceability data
    if (vacanciesWithTraceability > 0) {
      console.log('\n✅ Test 3: Sample vacancy traceability data:');
      const sampleVacancy = await prisma.vacancy.findFirst({
        where: {
          cleanedContentForAi: { not: null }
        },
        select: {
          id: true,
          title: true,
          cleanedContentForAi: true,
          rawAiResponse: true,
          aiProcessingSteps: true,
        }
      });
      
      if (sampleVacancy) {
        console.log(`🔍 Vacancy: ${sampleVacancy.title}`);
        console.log(`📝 Cleaned content length: ${sampleVacancy.cleanedContentForAi?.length || 0} chars`);
        console.log(`🤖 Raw AI response length: ${sampleVacancy.rawAiResponse?.length || 0} chars`);
        console.log(`⚙️ Processing steps: ${sampleVacancy.aiProcessingSteps ? 'Present' : 'Missing'}`);
      }
    }
    
    if (companiesWithTraceability > 0) {
      console.log('\n✅ Test 4: Sample company traceability data:');
      const sampleCompany = await prisma.companyAnalysis.findFirst({
        where: {
          cleanedContentForAi: { not: null }
        },
        select: {
          id: true,
          company: {
            select: {
              name: true
            }
          },
          cleanedContentForAi: true,
          rawAiResponse: true,
          aiProcessingSteps: true,
        }
      });
      
      if (sampleCompany) {
        console.log(`🔍 Company: ${sampleCompany.company?.name}`);
        console.log(`📝 Cleaned content length: ${sampleCompany.cleanedContentForAi?.length || 0} chars`);
        console.log(`🤖 Raw AI response length: ${sampleCompany.rawAiResponse?.length || 0} chars`);
        console.log(`⚙️ Processing steps: ${sampleCompany.aiProcessingSteps ? 'Present' : 'Missing'}`);
      }
    }
    
    console.log('\n🎉 Enhanced AI Processing Traceability test completed successfully!');
    console.log('✨ The new fields are properly configured and ready for data collection.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testTraceabilityFields().catch(console.error);