import { Test, TestingModule } from '@nestjs/testing';
import { CompanyProfileScraper } from '../../../src/modules/scraper/services/company-profile.scraper';
import { DevBgCompanyExtractor } from '../../../src/modules/scraper/services/devbg-company-extractor.service';
import { CompanyScoringService } from '../../../src/modules/company/services/company-scoring.service';
import { PrismaService } from '../../../src/common/database/prisma.service';
import { TestModule } from '../../test-utils/test.module';
import { DatabaseHelper } from '../../test-utils/database.helper';
import { MockDataFactory } from '../../test-utils/mock-data.factory';
import axios from 'axios';
import { ScoringInput } from '../../../src/modules/company/interfaces/scoring.interface';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Company Scoring Integration', () => {
  let moduleRef: TestingModule;
  let companyProfileScraper: CompanyProfileScraper;
  let devBgExtractor: DevBgCompanyExtractor;
  let scoringService: CompanyScoringService;
  let prismaService: PrismaService;

  beforeAll(async () => {
    moduleRef = await TestModule.createTestingModule([
      // Import necessary modules
    ], [
      CompanyProfileScraper,
      DevBgCompanyExtractor,
      CompanyScoringService,
    ]);

    companyProfileScraper = moduleRef.get<CompanyProfileScraper>(CompanyProfileScraper);
    devBgExtractor = moduleRef.get<DevBgCompanyExtractor>(DevBgCompanyExtractor);
    scoringService = moduleRef.get<CompanyScoringService>(CompanyScoringService);
    prismaService = moduleRef.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await TestModule.closeTestModule(moduleRef);
  });

  beforeEach(async () => {
    await TestModule.clearTestData();
    jest.clearAllMocks();
  });

  describe('end-to-end company scoring flow', () => {
    it('should extract, analyze and score a modern tech company', async () => {
      const mockHtml = `
        <html>
          <head><title>InnovateTech - Dev.bg</title></head>
          <body>
            <h1 class="company-name">InnovateTech</h1>
            <div class="company-description">
              <p>Leading software development company focused on modern web applications.</p>
              <p>We build scalable solutions using cutting-edge technologies.</p>
            </div>
            <div class="company-info">
              <div class="info-item">
                <span class="label">Industry:</span>
                <span class="value">Software Development</span>
              </div>
              <div class="info-item">
                <span class="label">Size:</span>
                <span class="value">51-200 employees</span>
              </div>
              <div class="info-item">
                <span class="label">Founded:</span>
                <span class="value">2018</span>
              </div>
              <div class="info-item">
                <span class="label">Location:</span>
                <span class="value">Sofia, Bulgaria</span>
              </div>
            </div>
            <div class="tech-stack">
              <h3>Technologies</h3>
              <div class="tech-tags">
                <span class="tech-tag">React</span>
                <span class="tech-tag">Node.js</span>
                <span class="tech-tag">TypeScript</span>
                <span class="tech-tag">Docker</span>
                <span class="tech-tag">Kubernetes</span>
                <span class="tech-tag">AWS</span>
                <span class="tech-tag">PostgreSQL</span>
                <span class="tech-tag">GraphQL</span>
              </div>
            </div>
            <div class="benefits-section">
              <h3>Benefits</h3>
              <ul class="benefits-list">
                <li>Remote work options</li>
                <li>Flexible working hours</li>
                <li>Health insurance</li>
                <li>Stock options</li>
                <li>Learning and development budget</li>
                <li>Conference attendance</li>
                <li>Wellness programs</li>
                <li>Parental leave</li>
              </ul>
            </div>
            <div class="company-values">
              <h3>Our Values</h3>
              <ul>
                <li>Innovation and creativity</li>
                <li>Work-life balance</li>
                <li>Continuous learning</li>
                <li>Team collaboration</li>
                <li>Technical excellence</li>
              </ul>
            </div>
            <div class="job-openings">
              <div class="job-item">Senior React Developer</div>
              <div class="job-item">DevOps Engineer</div>
              <div class="job-item">Product Manager</div>
              <div class="job-item">QA Engineer</div>
              <div class="job-item">Backend Developer</div>
            </div>
            <div class="awards-section">
              <span class="award">Best Employer 2023</span>
              <span class="award">Innovation Award 2022</span>
            </div>
          </body>
        </html>
      `;

      // Mock axios response
      mockedAxios.get.mockResolvedValue({
        data: mockHtml,
        status: 200,
      });

      // Step 1: Extract structured data
      const extractedData = await devBgExtractor.extractCompanyData(
        mockHtml, 
        'https://dev.bg/company/innovatetech/'
      );

      expect(extractedData.name).toBe('InnovateTech');
      expect(extractedData.technologies).toContain('React');
      expect(extractedData.technologies).toContain('TypeScript');
      expect(extractedData.benefits).toContain('Remote work options');
      expect(extractedData.values).toContain('Innovation and creativity');
      expect(extractedData.dataCompleteness).toBeGreaterThan(80);

      // Step 2: Create scoring input from extracted data
      const scoringInput: ScoringInput = {
        companyName: extractedData.name!,
        industry: extractedData.industry || 'Software Development',
        size: extractedData.size || '',
        founded: extractedData.founded,
        employeeCount: extractedData.employeeCount,
        technologies: extractedData.technologies,
        benefits: extractedData.benefits,
        values: extractedData.values,
        awards: extractedData.awards,
        workModel: 'hybrid', // Inferred from benefits
        jobOpenings: extractedData.jobOpenings,
        socialPresence: true,
        websiteQuality: 8,
        glassdoorRating: null,
        linkedinFollowers: null,
        githubActivity: null,
        dataCompleteness: extractedData.dataCompleteness,
        sourceReliability: 90,
      };

      // Step 3: Calculate comprehensive score
      const companyScore = await scoringService.calculateCompanyScore(scoringInput);

      // Verify scoring results
      expect(companyScore.overallScore).toBeGreaterThan(70);
      expect(companyScore.categories.developerExperience).toBeGreaterThan(7);
      expect(companyScore.categories.workLifeBalance).toBeGreaterThan(7);
      expect(companyScore.categories.cultureAndValues).toBeGreaterThan(6);

      expect(companyScore.factors.techInnovation).toBeGreaterThan(8);
      expect(companyScore.factors.workFlexibility).toBeGreaterThan(8);
      expect(companyScore.factors.learningSupport).toBeGreaterThan(7);

      expect(companyScore.strengths).toContain(expect.stringContaining('modern'));
      expect(companyScore.strengths).toContain(expect.stringContaining('remote'));

      expect(companyScore.scoringMetadata.version).toBe('2025.1');
      expect(companyScore.scoringMetadata.confidenceLevel).toBeGreaterThan(80);
      expect(companyScore.industryPercentile).toBeGreaterThan(60);
    });

    it('should handle a startup with limited data', async () => {
      const mockHtml = `
        <html>
          <body>
            <h1 class="company-name">EarlyStage Startup</h1>
            <div class="company-description">
              <p>Young fintech startup building payment solutions.</p>
            </div>
            <div class="company-info">
              <div class="info-item">
                <span class="label">Industry:</span>
                <span class="value">FinTech</span>
              </div>
              <div class="info-item">
                <span class="label">Size:</span>
                <span class="value">1-10 employees</span>
              </div>
              <div class="info-item">
                <span class="label">Founded:</span>
                <span class="value">2023</span>
              </div>
            </div>
            <div class="tech-stack">
              <span class="tech-tag">Python</span>
              <span class="tech-tag">Django</span>
              <span class="tech-tag">PostgreSQL</span>
            </div>
            <div class="benefits-section">
              <li>Stock options</li>
              <li>Flexible hours</li>
            </div>
            <div class="job-openings">
              <div class="job-item">Full-stack Developer</div>
              <div class="job-item">DevOps Engineer</div>
            </div>
          </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({
        data: mockHtml,
        status: 200,
      });

      const extractedData = await devBgExtractor.extractCompanyData(
        mockHtml, 
        'https://dev.bg/company/earlystage/'
      );

      const scoringInput: ScoringInput = {
        companyName: extractedData.name!,
        industry: extractedData.industry || 'FinTech',
        size: extractedData.size || '1-10',
        founded: extractedData.founded,
        employeeCount: extractedData.employeeCount,
        technologies: extractedData.technologies,
        benefits: extractedData.benefits,
        values: extractedData.values,
        awards: extractedData.awards,
        workModel: null,
        jobOpenings: extractedData.jobOpenings,
        socialPresence: false,
        websiteQuality: null,
        glassdoorRating: null,
        linkedinFollowers: null,
        githubActivity: null,
        dataCompleteness: extractedData.dataCompleteness,
        sourceReliability: 70,
      };

      const companyScore = await scoringService.calculateCompanyScore(scoringInput);

      // Startup should have different scoring characteristics
      expect(companyScore.overallScore).toBeGreaterThan(40);
      expect(companyScore.overallScore).toBeLessThan(75);

      // Growth opportunities should be high for startup
      expect(companyScore.categories.growthOpportunities).toBeGreaterThan(6);

      // Stability should be lower
      expect(companyScore.categories.companyStability).toBeLessThan(5);

      // Should have industry-specific adjustments for FinTech
      expect(companyScore.categories.compensationBenefits).toBeGreaterThan(5);

      // Lower confidence due to limited data
      expect(companyScore.scoringMetadata.confidenceLevel).toBeLessThan(70);

      expect(companyScore.concerns).toContain(expect.stringContaining('Limited'));
    });

    it('should handle legacy enterprise company', async () => {
      const mockHtml = `
        <html>
          <body>
            <h1 class="company-name">LegacyCorp</h1>
            <div class="company-description">
              <p>Established enterprise software company serving Fortune 500 clients.</p>
            </div>
            <div class="company-info">
              <div class="info-item">
                <span class="label">Industry:</span>
                <span class="value">Enterprise Software</span>
              </div>
              <div class="info-item">
                <span class="label">Size:</span>
                <span class="value">1000+ employees</span>
              </div>
              <div class="info-item">
                <span class="label">Founded:</span>
                <span class="value">1995</span>
              </div>
            </div>
            <div class="tech-stack">
              <span class="tech-tag">Java</span>
              <span class="tech-tag">Spring</span>
              <span class="tech-tag">Oracle</span>
              <span class="tech-tag">Maven</span>
              <span class="tech-tag">Jenkins</span>
            </div>
            <div class="benefits-section">
              <li>Health insurance</li>
              <li>Dental insurance</li>
              <li>Retirement 401k</li>
              <li>Paid time off</li>
              <li>Training programs</li>
              <li>Life insurance</li>
              <li>Employee assistance program</li>
            </div>
            <div class="company-values">
              <li>Customer satisfaction</li>
              <li>Integrity</li>
              <li>Excellence</li>
              <li>Reliability</li>
            </div>
            <div class="awards-section">
              <span class="award">Fortune 500 Partner</span>
              <span class="award">Industry Leader Award</span>
            </div>
          </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({
        data: mockHtml,
        status: 200,
      });

      const extractedData = await devBgExtractor.extractCompanyData(
        mockHtml, 
        'https://dev.bg/company/legacycorp/'
      );

      const scoringInput: ScoringInput = {
        companyName: extractedData.name!,
        industry: extractedData.industry || 'Enterprise Software',
        size: extractedData.size || '1000+',
        founded: extractedData.founded,
        employeeCount: extractedData.employeeCount,
        technologies: extractedData.technologies,
        benefits: extractedData.benefits,
        values: extractedData.values,
        awards: extractedData.awards,
        workModel: 'office', // Assumed for legacy enterprise
        jobOpenings: extractedData.jobOpenings,
        socialPresence: true,
        websiteQuality: 9,
        glassdoorRating: 3.8,
        linkedinFollowers: 50000,
        githubActivity: 100,
        dataCompleteness: extractedData.dataCompleteness,
        sourceReliability: 95,
      };

      const companyScore = await scoringService.calculateCompanyScore(scoringInput);

      // Enterprise characteristics
      expect(companyScore.categories.companyStability).toBeGreaterThan(7);
      expect(companyScore.categories.compensationBenefits).toBeGreaterThan(6);

      // May score lower on tech innovation and work-life balance
      expect(companyScore.categories.developerExperience).toBeLessThan(7);
      expect(companyScore.categories.workLifeBalance).toBeLessThan(7);

      // High confidence due to established reputation
      expect(companyScore.scoringMetadata.confidenceLevel).toBeGreaterThan(85);

      // Should have recommendations for modernization
      expect(companyScore.recommendations).toContain(expect.stringContaining('modern'));
    });

    it('should save complete analysis with scoring to database', async () => {
      // Create a test company first
      const company = await MockDataFactory.createCompany();

      const mockHtml = `
        <html>
          <body>
            <h1 class="company-name">TestCorp</h1>
            <div class="company-description"><p>Test company</p></div>
            <div class="tech-stack">
              <span class="tech-tag">React</span>
              <span class="tech-tag">Node.js</span>
            </div>
            <div class="benefits-section">
              <li>Remote work</li>
              <li>Health insurance</li>
            </div>
          </body>
        </html>
      `;

      const extractedData = await devBgExtractor.extractCompanyData(
        mockHtml, 
        'https://dev.bg/company/testcorp/'
      );

      const scoringInput: ScoringInput = {
        companyName: extractedData.name!,
        industry: 'Software Development',
        size: '51-200',
        founded: 2020,
        employeeCount: 100,
        technologies: extractedData.technologies,
        benefits: extractedData.benefits,
        values: ['Innovation'],
        awards: [],
        workModel: 'hybrid',
        jobOpenings: 5,
        socialPresence: true,
        websiteQuality: 7,
        glassdoorRating: 4.0,
        linkedinFollowers: 1000,
        githubActivity: 300,
        dataCompleteness: extractedData.dataCompleteness,
        sourceReliability: 80,
      };

      const companyScore = await scoringService.calculateCompanyScore(scoringInput);

      // Save analysis with scoring to database
      const analysisData = {
        companyId: company.id,
        sourceSite: 'dev.bg',
        
        // Legacy fields (for backward compatibility)
        cultureScore: companyScore.categories.cultureAndValues,
        workLifeBalance: companyScore.categories.workLifeBalance,
        careerGrowth: companyScore.categories.growthOpportunities,
        salaryCompetitiveness: companyScore.categories.compensationBenefits,
        benefitsScore: companyScore.categories.compensationBenefits,
        techCulture: companyScore.categories.developerExperience,
        
        // Modern comprehensive scoring
        overallScore: companyScore.overallScore,
        scoringFactors: companyScore.factors,
        categoryScores: companyScore.categories,
        industryPercentile: companyScore.industryPercentile,
        sizePercentile: companyScore.sizePercentile,
        scoringMetadata: companyScore.scoringMetadata,
        scoreStrengths: companyScore.strengths,
        scoreConcerns: companyScore.concerns,
        scoreRecommendations: companyScore.recommendations,
        scoreCalculatedAt: new Date(),
        
        // Other analysis fields
        confidenceScore: companyScore.scoringMetadata.confidenceLevel,
        dataCompleteness: extractedData.dataCompleteness,
        recommendationScore: companyScore.overallScore / 10, // Convert to 0-10 scale
        analysisSource: 'ai_generated',
        
        // Structured data
        techStack: extractedData.technologies,
        benefits: extractedData.benefits,
        companyValues: extractedData.values,
        pros: companyScore.strengths,
        cons: companyScore.concerns,
      };

      const savedAnalysis = await prismaService.companyAnalysis.create({
        data: analysisData,
      });

      expect(savedAnalysis).toBeDefined();
      expect(savedAnalysis.overallScore).toBe(companyScore.overallScore);
      expect(savedAnalysis.industryPercentile).toBe(companyScore.industryPercentile);
      expect(savedAnalysis.scoreCalculatedAt).toBeInstanceOf(Date);

      // Verify scoring factors are saved as JSON
      expect(savedAnalysis.scoringFactors).toBeDefined();
      expect(typeof savedAnalysis.scoringFactors).toBe('object');

      // Verify category scores are saved
      expect(savedAnalysis.categoryScores).toBeDefined();
      expect(savedAnalysis.categoryScores).toHaveProperty('developerExperience');

      // Verify metadata is saved
      expect(savedAnalysis.scoringMetadata).toBeDefined();
      expect(savedAnalysis.scoringMetadata).toHaveProperty('version');

      // Verify insights are saved
      expect(savedAnalysis.scoreStrengths).toBeDefined();
      expect(Array.isArray(savedAnalysis.scoreStrengths)).toBe(true);
      expect(savedAnalysis.scoreConcerns).toBeDefined();
      expect(Array.isArray(savedAnalysis.scoreConcerns)).toBe(true);
    });

    it('should handle network errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      await expect(async () => {
        await companyProfileScraper.scrapeCompanyProfile('https://dev.bg/company/nonexistent/');
      }).rejects.toThrow('Network error');
    });

    it('should handle malformed HTML gracefully', async () => {
      const malformedHtml = `
        <html><head><title>Broken</title>
        <body><h1>BrokenCorp
        <div>Unclosed tags everywhere
        <span>No proper structure
      `;

      const extractedData = await devBgExtractor.extractCompanyData(
        malformedHtml, 
        'https://dev.bg/company/broken/'
      );

      expect(extractedData).toBeDefined();
      expect(extractedData.name).toBe('BrokenCorp');
      expect(extractedData.dataCompleteness).toBeLessThan(30);

      // Should still be able to calculate a score
      const scoringInput: ScoringInput = {
        companyName: extractedData.name || 'Unknown',
        industry: '',
        size: '',
        founded: null,
        employeeCount: null,
        technologies: extractedData.technologies || [],
        benefits: extractedData.benefits || [],
        values: extractedData.values || [],
        awards: extractedData.awards || [],
        workModel: null,
        jobOpenings: 0,
        socialPresence: false,
        websiteQuality: null,
        glassdoorRating: null,
        linkedinFollowers: null,
        githubActivity: null,
        dataCompleteness: extractedData.dataCompleteness,
        sourceReliability: 50,
      };

      const companyScore = await scoringService.calculateCompanyScore(scoringInput);
      expect(companyScore).toBeDefined();
      expect(companyScore.overallScore).toBeGreaterThan(0);
      expect(companyScore.scoringMetadata.confidenceLevel).toBeLessThan(40);
    });
  });

  describe('performance tests', () => {
    it('should complete scoring within reasonable time', async () => {
      const mockInput: ScoringInput = {
        companyName: 'PerformanceCorp',
        industry: 'Software Development',
        size: '51-200',
        founded: 2018,
        employeeCount: 100,
        technologies: ['React', 'Node.js', 'TypeScript', 'Docker', 'AWS'],
        benefits: ['Remote work', 'Health insurance', 'Stock options'],
        values: ['Innovation', 'Work-life balance'],
        awards: ['Best Employer 2023'],
        workModel: 'hybrid',
        jobOpenings: 10,
        socialPresence: true,
        websiteQuality: 8,
        glassdoorRating: 4.0,
        linkedinFollowers: 5000,
        githubActivity: 500,
        dataCompleteness: 85,
        sourceReliability: 90,
      };

      const startTime = Date.now();
      const result = await scoringService.calculateCompanyScore(mockInput);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});