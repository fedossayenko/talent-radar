import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/database/prisma.service';
import { CompanyValidationService } from '../src/modules/scraper/services/company-validation.service';
import { Logger } from '@nestjs/common';

interface CompanyFix {
  companyId: string;
  currentName: string;
  suggestedName: string;
  vacancyCount: number;
  sourceUrls: string[];
}

/**
 * Script to fix company names that were incorrectly set to job board names (like DEV.BG)
 * This script analyzes vacancies to infer the correct company names and updates company records
 */
async function fixCompanyNames() {
  const logger = new Logger('FixCompanyNames');
  
  try {
    logger.log('🚀 Starting company name fix process...');
    
    // Bootstrap the NestJS application context
    const app = await NestFactory.createApplicationContext(AppModule);
    
    // Get necessary services
    const prismaService = app.get(PrismaService);
    const validationService = app.get(CompanyValidationService);
    
    logger.log('✅ NestJS application context initialized');

    // Find companies with invalid names (job board names)
    logger.log('🔍 Finding companies with invalid names...');
    
    const companies = await prismaService.company.findMany({
      include: {
        vacancies: {
          select: {
            id: true,
            title: true,
            sourceUrl: true,
          }
        },
        _count: {
          select: {
            vacancies: true
          }
        }
      }
    });

    const companiesToFix: CompanyFix[] = [];

    for (const company of companies) {
      // Check if company name is invalid (job board name)
      if (!validationService.isValidCompanyName(company.name)) {
        logger.log(`❌ Found invalid company name: "${company.name}" (ID: ${company.id})`);
        
        // Try to infer correct company name from vacancy URLs
        const suggestedName = await inferCompanyNameFromVacancies(company.vacancies, logger);
        
        if (suggestedName && validationService.isValidCompanyName(suggestedName)) {
          companiesToFix.push({
            companyId: company.id,
            currentName: company.name,
            suggestedName,
            vacancyCount: company._count.vacancies,
            sourceUrls: company.vacancies.map(v => v.sourceUrl || '').filter(Boolean).slice(0, 3)
          });
        }
      }
    }

    logger.log(`📊 Found ${companiesToFix.length} companies to fix:`);
    
    // Display summary of fixes
    for (const fix of companiesToFix) {
      logger.log(`  • "${fix.currentName}" → "${fix.suggestedName}" (${fix.vacancyCount} vacancies)`);
      fix.sourceUrls.forEach(url => logger.log(`    - ${url}`));
    }

    if (companiesToFix.length === 0) {
      logger.log('🎉 No companies need fixing!');
      await app.close();
      return;
    }

    // Apply fixes
    logger.log('🔧 Applying fixes...');
    
    let fixedCount = 0;
    for (const fix of companiesToFix) {
      try {
        await prismaService.company.update({
          where: { id: fix.companyId },
          data: { 
            name: fix.suggestedName,
            updatedAt: new Date()
          }
        });
        
        logger.log(`✅ Fixed: "${fix.currentName}" → "${fix.suggestedName}"`);
        fixedCount++;
        
      } catch (error) {
        logger.error(`❌ Failed to fix company ${fix.companyId}:`, error.message);
      }
    }

    // Verify fixes
    logger.log('🔍 Verifying fixes...');
    
    const remainingInvalidCompanies = await prismaService.company.findMany({
      where: {
        name: {
          in: ['DEV.BG', 'dev.bg', 'Indeed', 'LinkedIn', 'Glassdoor', 'Jobs.bg']
        }
      }
    });

    logger.log(`📊 Summary:`);
    logger.log(`   - Companies fixed: ${fixedCount}`);
    logger.log(`   - Remaining invalid companies: ${remainingInvalidCompanies.length}`);
    
    if (remainingInvalidCompanies.length > 0) {
      logger.warn('⚠️  Some companies still have invalid names:');
      for (const company of remainingInvalidCompanies) {
        logger.warn(`     - ${company.name} (ID: ${company.id})`);
      }
    }

    await app.close();
    
    logger.log('🎉 COMPANY NAME FIX COMPLETED SUCCESSFULLY!');
    logger.log('='.repeat(60));
    
  } catch (error) {
    logger.error('❌ Company name fix failed:', error);
    if (error.stack) {
      logger.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

/**
 * Attempts to infer the correct company name from vacancy URLs
 */
async function inferCompanyNameFromVacancies(
  vacancies: Array<{ sourceUrl: string | null; title: string }>, 
  logger: Logger
): Promise<string | null> {
  
  for (const vacancy of vacancies) {
    if (!vacancy.sourceUrl) continue;
    
    try {
      // Extract company name from dev.bg URLs like:
      // https://dev.bg/company/jobads/technologica-senior-java-developer/
      // https://dev.bg/company/jobads/recruitment-bg-middle-full-stack-developer-java-node-js-react/
      
      const urlMatch = vacancy.sourceUrl.match(/\/company\/jobads\/([^\/]+)/);
      if (urlMatch) {
        const urlPart = urlMatch[1];
        
        // Extract potential company name from URL
        // Examples: "technologica-senior-java-developer" → "technologica"
        //          "recruitment-bg-middle-full-stack-developer" → "recruitment-bg"
        
        const parts = urlPart.split('-');
        
        // Try different combinations to find the company name
        const candidates = [
          parts[0], // First part (most common)
          parts.slice(0, 2).join('-'), // First two parts (for names like "recruitment-bg")
          parts.slice(0, 3).join('-'), // First three parts (for compound names)
        ];
        
        for (const candidate of candidates) {
          const companyName = formatCompanyName(candidate);
          if (companyName && companyName.length >= 3) {
            logger.log(`   Inferred company name: "${companyName}" from URL: ${vacancy.sourceUrl}`);
            return companyName;
          }
        }
      }
      
    } catch (error) {
      logger.warn(`   Failed to parse URL: ${vacancy.sourceUrl}`, error.message);
    }
  }
  
  return null;
}

/**
 * Formats a raw company name extracted from URL
 */
function formatCompanyName(raw: string): string | null {
  if (!raw || raw.length < 3) return null;
  
  // Clean up the name
  let name = raw
    .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
    .replace(/\b\w/g, char => char.toUpperCase()) // Title case
    .trim();
  
  // Special handling for known patterns
  if (name.toLowerCase() === 'recruitment bg') {
    return 'Recruitment.bg';
  }
  
  if (name.toLowerCase() === 'technologica') {
    return 'TechnoLogica';
  }
  
  // Avoid generic terms
  const genericTerms = ['senior', 'junior', 'developer', 'engineer', 'java', 'react', 'node', 'js', 'full', 'stack', 'middle', 'lead'];
  if (genericTerms.includes(name.toLowerCase())) {
    return null;
  }
  
  return name;
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

fixCompanyNames();