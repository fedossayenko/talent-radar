import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as Bull from 'bull';
import { ScraperProcessor } from './scraper.processor';
import { ScraperService, CompanyAnalysisJobData } from '../scraper.service';
import { AiService } from '../../ai/ai.service';
import { AiProcessingPipelineService } from '../services/ai-processing-pipeline.service';
import { VacancyService } from '../../vacancy/vacancy.service';
import { CompanyService } from '../../company/company.service';
import { CompanySourceService } from '../../company/company-source.service';
import { CompanyProfileScraper } from '../services/company-profile.scraper';
import { CompanyValidationService } from '../services/company-validation.service';
import { CompanyScoringService } from '../../company/services/company-scoring.service';

describe('ScraperProcessor - Company Analysis', () => {
  let processor: ScraperProcessor;
  let aiService: jest.Mocked<AiService>;
  let companyService: jest.Mocked<CompanyService>;
  let companySourceService: jest.Mocked<CompanySourceService>;
  let companyProfileScraper: jest.Mocked<CompanyProfileScraper>;

  const mockJob = {
    id: 'job-123',
    progress: jest.fn(),
    opts: { attempts: 3 },
    attemptsMade: 0,
  } as any as Bull.Job<CompanyAnalysisJobData>;

  const mockCompanyAnalysisJobData: CompanyAnalysisJobData = {
    companyId: 'company-123',
    companyName: 'TechCorp',
    sourceSite: 'dev.bg',
    sourceUrl: 'https://dev.bg/company/techcorp/',
    analysisType: 'profile',
    priority: 1,
    maxRetries: 3,
  };

  const mockScrapingResult = {
    success: true,
    data: {
      rawContent: '<html><body>TechCorp is a leading technology company...</body></html>',
      extractedText: 'TechCorp is a leading technology company...',
      metadata: {
        title: 'TechCorp - Company Profile',
        description: 'Technology company profile',
        contentLength: 150,
        lastUpdated: new Date().toISOString(),
      },
    },
    error: null,
    duration: 2000,
  };

  const mockAnalysisResult = {
    name: 'TechCorp',
    description: 'Innovative technology company',
    industry: 'Technology',
    size: '51-200',
    location: 'Sofia, Bulgaria',
    website: 'https://techcorp.com',
    employeeCount: 120,
    founded: 2015,
    technologies: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
    benefits: ['Health insurance', 'Flexible hours', 'Remote work'],
    values: ['Innovation', 'Collaboration', 'Excellence'],
    pros: ['Great tech stack', 'Good work-life balance', 'Learning opportunities'],
    cons: ['Fast-paced environment', 'High expectations'],
    cultureScore: 8.5,
    workLifeBalance: 8.0,
    careerGrowth: 7.5,
    techCulture: 9.0,
    salaryCompetitiveness: 8.0,
    benefitsScore: 8.5,
    retentionRate: 85.0,
    recommendationScore: 8.3,
    workEnvironment: 'Modern office with flexible working arrangements',
    interviewProcess: 'Technical and HR interviews',
    growthOpportunities: ['Career advancement', 'Skill development'],
    confidenceScore: 85,
    dataCompleteness: 90,
  };

  let companyValidationService: jest.Mocked<CompanyValidationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScraperProcessor,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
              const config = {
                'SCRAPER_ENABLED': true,
                'scraper': { enabled: true },
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
        {
          provide: ScraperService,
          useValue: {
            scrapeDevBg: jest.fn(),
          },
        },
        {
          provide: AiService,
          useValue: {
            isConfigured: jest.fn(),
            analyzeCompanyProfile: jest.fn(),
            analyzeCompanyWebsite: jest.fn(),
          },
        },
        {
          provide: AiProcessingPipelineService,
          useValue: {
            process: jest.fn(),
          },
        },
        {
          provide: VacancyService,
          useValue: {
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: CompanyService,
          useValue: {
            findOrCreate: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            createOrUpdateAnalysis: jest.fn(),
          },
        },
        {
          provide: CompanySourceService,
          useValue: {
            saveCompanySource: jest.fn(),
            markSourceAsInvalid: jest.fn(),
          },
        },
        {
          provide: CompanyProfileScraper,
          useValue: {
            scrapeDevBgCompanyProfile: jest.fn(),
            scrapeCompanyWebsite: jest.fn(),
          },
        },
        {
          provide: CompanyValidationService,
          useValue: {
            validateCompanyProfile: jest.fn(),
            shouldUpdateCompanyName: jest.fn(),
          },
        },
        {
          provide: CompanyScoringService,
          useValue: {
            scoreCompany: jest.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get<ScraperProcessor>(ScraperProcessor);
    aiService = module.get(AiService);
    companyService = module.get(CompanyService);
    companySourceService = module.get(CompanySourceService);
    companyProfileScraper = module.get(CompanyProfileScraper);
    companyValidationService = module.get(CompanyValidationService);

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock implementations
    mockJob.progress.mockResolvedValue(undefined);
    companyService.findOne.mockResolvedValue({ success: true, data: null });
    companyValidationService.shouldUpdateCompanyName.mockReturnValue(true);
  });

  describe('handleCompanyAnalysis', () => {
    it('should successfully process dev.bg company profile analysis', async () => {
      // Arrange
      mockJob.data = { ...mockCompanyAnalysisJobData };
      aiService.isConfigured.mockReturnValue(true);
      companyProfileScraper.scrapeDevBgCompanyProfile.mockResolvedValue(mockScrapingResult);
      companySourceService.saveCompanySource.mockResolvedValue({} as any);
      aiService.analyzeCompanyProfile.mockResolvedValue(mockAnalysisResult);
      companyService.update.mockResolvedValue({} as any);
      companyService.createOrUpdateAnalysis.mockResolvedValue({} as any);

      // Act
      const result = await processor.handleCompanyAnalysis(mockJob);

      // Assert
      expect(result.success).toBe(true);
      expect(result.companyId).toBe(mockCompanyAnalysisJobData.companyId);
      expect(result.sourceSite).toBe(mockCompanyAnalysisJobData.sourceSite);
      expect(result.analysisResult).toEqual(mockAnalysisResult);

      // Verify all steps were called
      expect(aiService.isConfigured).toHaveBeenCalled();
      expect(companyProfileScraper.scrapeDevBgCompanyProfile).toHaveBeenCalledWith(mockCompanyAnalysisJobData.sourceUrl);
      expect(companySourceService.saveCompanySource).toHaveBeenCalledWith({
        companyId: mockCompanyAnalysisJobData.companyId,
        sourceSite: mockCompanyAnalysisJobData.sourceSite,
        sourceUrl: mockCompanyAnalysisJobData.sourceUrl,
        scrapedContent: mockScrapingResult.data?.rawContent,
        isValid: true,
      });
      expect(aiService.analyzeCompanyProfile).toHaveBeenCalledWith(
        mockScrapingResult.data?.rawContent,
        mockCompanyAnalysisJobData.sourceUrl
      );
      expect(companyService.update).toHaveBeenCalledWith(mockCompanyAnalysisJobData.companyId, {
        name: mockAnalysisResult.name,
        description: mockAnalysisResult.description,
        industry: mockAnalysisResult.industry,
        location: mockAnalysisResult.location,
        website: mockAnalysisResult.website,
        size: mockAnalysisResult.size,
        founded: mockAnalysisResult.founded,
        employeeCount: mockAnalysisResult.employeeCount,
        lastAnalyzedAt: expect.any(Date),
      });
      expect(companyService.createOrUpdateAnalysis).toHaveBeenCalled();

      // Verify progress updates
      expect(mockJob.progress).toHaveBeenCalledWith(10);
      expect(mockJob.progress).toHaveBeenCalledWith(20);
      expect(mockJob.progress).toHaveBeenCalledWith(50);
      expect(mockJob.progress).toHaveBeenCalledWith(70);
      expect(mockJob.progress).toHaveBeenCalledWith(90);
      expect(mockJob.progress).toHaveBeenCalledWith(100);
    });

    it('should successfully process company website analysis', async () => {
      // Arrange
      const websiteJobData = {
        ...mockCompanyAnalysisJobData,
        sourceUrl: 'https://techcorp.com',
        sourceSite: 'company_website',
        analysisType: 'website' as const,
      };
      mockJob.data = websiteJobData;

      aiService.isConfigured.mockReturnValue(true);
      companyProfileScraper.scrapeCompanyWebsite.mockResolvedValue(mockScrapingResult);
      companySourceService.saveCompanySource.mockResolvedValue({} as any);
      aiService.analyzeCompanyWebsite.mockResolvedValue(mockAnalysisResult);
      companyService.update.mockResolvedValue({} as any);
      companyService.createOrUpdateAnalysis.mockResolvedValue({} as any);

      // Act
      const result = await processor.handleCompanyAnalysis(mockJob);

      // Assert
      expect(result.success).toBe(true);
      expect(companyProfileScraper.scrapeCompanyWebsite).toHaveBeenCalledWith(websiteJobData.sourceUrl);
      expect(aiService.analyzeCompanyWebsite).toHaveBeenCalledWith(
        mockScrapingResult.data?.rawContent,
        websiteJobData.sourceUrl
      );
    });

    it('should return error when AI service is not configured', async () => {
      // Arrange
      mockJob.data = { ...mockCompanyAnalysisJobData };
      aiService.isConfigured.mockReturnValue(false);

      // Act
      const result = await processor.handleCompanyAnalysis(mockJob);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('AI service not configured');
      expect(result.companyId).toBe(mockCompanyAnalysisJobData.companyId);
      expect(result.sourceSite).toBe(mockCompanyAnalysisJobData.sourceSite);

      // Verify no scraping or analysis was performed
      expect(companyProfileScraper.scrapeDevBgCompanyProfile).not.toHaveBeenCalled();
      expect(aiService.analyzeCompanyProfile).not.toHaveBeenCalled();
    });

    it('should handle scraping failure and mark source as invalid', async () => {
      // Arrange
      const scrapingError = 'Failed to scrape content: Page not found';
      const failedScrapingResult = {
        success: false,
        data: null,
        error: scrapingError,
        duration: 1000,
      };

      mockJob.data = { ...mockCompanyAnalysisJobData };
      aiService.isConfigured.mockReturnValue(true);
      companyProfileScraper.scrapeDevBgCompanyProfile.mockResolvedValue(failedScrapingResult);
      companySourceService.markSourceAsInvalid.mockResolvedValue();

      // Act
      const result = await processor.handleCompanyAnalysis(mockJob);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe(scrapingError);
      expect(result.companyId).toBe(mockCompanyAnalysisJobData.companyId);
      expect(result.sourceSite).toBe(mockCompanyAnalysisJobData.sourceSite);

      // Verify source was marked as invalid
      expect(companySourceService.markSourceAsInvalid).toHaveBeenCalledWith(
        mockCompanyAnalysisJobData.companyId,
        mockCompanyAnalysisJobData.sourceSite,
        scrapingError
      );

      // Verify no analysis was performed
      expect(aiService.analyzeCompanyProfile).not.toHaveBeenCalled();
      expect(companyService.createOrUpdateAnalysis).not.toHaveBeenCalled();
    });

    it('should handle AI analysis failure', async () => {
      // Arrange
      mockJob.data = { ...mockCompanyAnalysisJobData };
      aiService.isConfigured.mockReturnValue(true);
      companyProfileScraper.scrapeDevBgCompanyProfile.mockResolvedValue(mockScrapingResult);
      companySourceService.saveCompanySource.mockResolvedValue({} as any);
      aiService.analyzeCompanyProfile.mockResolvedValue(null);

      // Act
      const result = await processor.handleCompanyAnalysis(mockJob);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('AI analysis failed');
      expect(result.companyId).toBe(mockCompanyAnalysisJobData.companyId);
      expect(result.sourceSite).toBe(mockCompanyAnalysisJobData.sourceSite);

      // Verify scraping was performed but analysis failed
      expect(companyProfileScraper.scrapeDevBgCompanyProfile).toHaveBeenCalled();
      expect(companySourceService.saveCompanySource).toHaveBeenCalled();
      expect(aiService.analyzeCompanyProfile).toHaveBeenCalled();

      // Verify no analysis was saved
      expect(companyService.createOrUpdateAnalysis).not.toHaveBeenCalled();
    });

    it('should handle unsupported analysis type', async () => {
      // Arrange
      const invalidJobData = {
        ...mockCompanyAnalysisJobData,
        analysisType: 'unsupported' as any,
      };
      mockJob.data = invalidJobData;
      aiService.isConfigured.mockReturnValue(true);

      // Act & Assert
      await expect(processor.handleCompanyAnalysis(mockJob)).rejects.toThrow(
        'Unsupported analysis type: unsupported for source: dev.bg'
      );

      // Verify no scraping was performed
      expect(companyProfileScraper.scrapeDevBgCompanyProfile).not.toHaveBeenCalled();
      expect(companyProfileScraper.scrapeCompanyWebsite).not.toHaveBeenCalled();
    });

    it('should handle exceptions during scraping', async () => {
      // Arrange
      mockJob.data = { ...mockCompanyAnalysisJobData };
      aiService.isConfigured.mockReturnValue(true);
      companyProfileScraper.scrapeDevBgCompanyProfile.mockRejectedValue(new Error('Network timeout'));

      // Act & Assert
      await expect(processor.handleCompanyAnalysis(mockJob)).rejects.toThrow('Network timeout');

      // Verify progress was updated before failure
      expect(mockJob.progress).toHaveBeenCalledWith(10);
      expect(mockJob.progress).toHaveBeenCalledWith(20);
    });

    it('should handle exceptions during AI analysis', async () => {
      // Arrange
      mockJob.data = { ...mockCompanyAnalysisJobData };
      aiService.isConfigured.mockReturnValue(true);
      companyProfileScraper.scrapeDevBgCompanyProfile.mockResolvedValue(mockScrapingResult);
      companySourceService.saveCompanySource.mockResolvedValue({} as any);
      aiService.analyzeCompanyProfile.mockRejectedValue(new Error('OpenAI API error'));

      // Act & Assert
      await expect(processor.handleCompanyAnalysis(mockJob)).rejects.toThrow('OpenAI API error');
    });

    it('should handle exceptions during data persistence', async () => {
      // Arrange
      mockJob.data = { ...mockCompanyAnalysisJobData };
      aiService.isConfigured.mockReturnValue(true);
      companyProfileScraper.scrapeDevBgCompanyProfile.mockResolvedValue(mockScrapingResult);
      companySourceService.saveCompanySource.mockResolvedValue({} as any);
      aiService.analyzeCompanyProfile.mockResolvedValue(mockAnalysisResult);
      companyService.update.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(processor.handleCompanyAnalysis(mockJob)).rejects.toThrow('Database connection failed');
    });

    it('should create proper analysis data for company analysis', async () => {
      // Arrange
      mockJob.data = { ...mockCompanyAnalysisJobData };
      aiService.isConfigured.mockReturnValue(true);
      companyProfileScraper.scrapeDevBgCompanyProfile.mockResolvedValue(mockScrapingResult);
      companySourceService.saveCompanySource.mockResolvedValue({} as any);
      aiService.analyzeCompanyProfile.mockResolvedValue(mockAnalysisResult);
      companyService.update.mockResolvedValue({} as any);
      companyService.createOrUpdateAnalysis.mockResolvedValue({} as any);

      // Act
      await processor.handleCompanyAnalysis(mockJob);

      // Assert
      expect(companyService.createOrUpdateAnalysis).toHaveBeenCalledWith({
        companyId: mockCompanyAnalysisJobData.companyId,
        analysisSource: "ai_generated",
        recommendationScore: mockAnalysisResult.recommendationScore,
        pros: JSON.stringify(mockAnalysisResult.pros),
        cons: JSON.stringify(mockAnalysisResult.cons),
        cultureScore: mockAnalysisResult.cultureScore,
        workLifeBalance: mockAnalysisResult.workLifeBalance,
        careerGrowth: mockAnalysisResult.careerGrowth,
        salaryCompetitiveness: mockAnalysisResult.salaryCompetitiveness,
        benefitsScore: mockAnalysisResult.benefitsScore,
        techCulture: mockAnalysisResult.techCulture,
        retentionRate: mockAnalysisResult.retentionRate,
        workEnvironment: mockAnalysisResult.workEnvironment,
        interviewProcess: mockAnalysisResult.interviewProcess,
        growthOpportunities: JSON.stringify(mockAnalysisResult.growthOpportunities),
        benefits: JSON.stringify(mockAnalysisResult.benefits),
        techStack: JSON.stringify(mockAnalysisResult.technologies),
        companyValues: JSON.stringify(mockAnalysisResult.values),
        confidenceScore: mockAnalysisResult.confidenceScore,
        dataCompleteness: mockAnalysisResult.dataCompleteness,
        sourceSite: mockCompanyAnalysisJobData.sourceSite,
        rawData: JSON.stringify({
          ...mockAnalysisResult,
          companyScore: null,
          structuredData: null,
          enhancedAnalysis: false,
        }),
      });
    });

    it('should skip company updates when analysis has no basic info', async () => {
      // Arrange
      const analysisWithoutBasicInfo = {
        ...mockAnalysisResult,
        name: undefined,
        description: undefined,
        industry: undefined,
        location: undefined,
        website: undefined,
        size: undefined,
        founded: undefined,
        employeeCount: undefined,
      };

      mockJob.data = { ...mockCompanyAnalysisJobData };
      aiService.isConfigured.mockReturnValue(true);
      companyProfileScraper.scrapeDevBgCompanyProfile.mockResolvedValue(mockScrapingResult);
      companySourceService.saveCompanySource.mockResolvedValue({} as any);
      aiService.analyzeCompanyProfile.mockResolvedValue(analysisWithoutBasicInfo);
      companyService.createOrUpdateAnalysis.mockResolvedValue({} as any);

      // Act
      const result = await processor.handleCompanyAnalysis(mockJob);

      // Assert
      expect(result.success).toBe(true);
      
      // Verify company update was not called (no basic info to update)
      expect(companyService.update).not.toHaveBeenCalled();
      
      // But analysis should still be saved
      expect(companyService.createOrUpdateAnalysis).toHaveBeenCalled();
    });

    it('should handle retry logic for failed jobs', async () => {
      // Arrange
      mockJob.data = { ...mockCompanyAnalysisJobData };
      mockJob.attemptsMade = 1; // Simulate first retry
      mockJob.opts.attempts = 3; // Total attempts allowed

      aiService.isConfigured.mockReturnValue(true);
      companyProfileScraper.scrapeDevBgCompanyProfile.mockRejectedValue(new Error('Temporary failure'));

      // Act & Assert
      await expect(processor.handleCompanyAnalysis(mockJob)).rejects.toThrow('Retry attempt 2/3: Temporary failure');
    });

    it('should not retry when max retries exceeded', async () => {
      // Arrange
      mockJob.data = { ...mockCompanyAnalysisJobData };
      mockJob.attemptsMade = 3; // All attempts used
      mockJob.opts.attempts = 3;

      aiService.isConfigured.mockReturnValue(true);
      companyProfileScraper.scrapeDevBgCompanyProfile.mockRejectedValue(new Error('Final failure'));

      // Act & Assert
      await expect(processor.handleCompanyAnalysis(mockJob)).rejects.toThrow('Final failure');
      // Should not include retry message
    });

    it('should handle empty scraped content gracefully', async () => {
      // Arrange
      const emptyScrapingResult = {
        ...mockScrapingResult,
        data: {
          ...mockScrapingResult.data!,
          rawContent: '',
        },
      };

      mockJob.data = { ...mockCompanyAnalysisJobData };
      aiService.isConfigured.mockReturnValue(true);
      companyProfileScraper.scrapeDevBgCompanyProfile.mockResolvedValue(emptyScrapingResult);
      companySourceService.saveCompanySource.mockResolvedValue({} as any);
      aiService.analyzeCompanyProfile.mockResolvedValue(mockAnalysisResult);
      companyService.update.mockResolvedValue({} as any);
      companyService.createOrUpdateAnalysis.mockResolvedValue({} as any);

      // Act
      const result = await processor.handleCompanyAnalysis(mockJob);

      // Assert
      expect(result.success).toBe(true);
      
      // Verify AI was called with empty content
      expect(aiService.analyzeCompanyProfile).toHaveBeenCalledWith('', mockCompanyAnalysisJobData.sourceUrl);
    });
  });

  describe('saveCompanyAnalysis private method', () => {
    it('should handle analysis data persistence errors gracefully', async () => {
      // Arrange
      mockJob.data = { ...mockCompanyAnalysisJobData };
      aiService.isConfigured.mockReturnValue(true);
      companyProfileScraper.scrapeDevBgCompanyProfile.mockResolvedValue(mockScrapingResult);
      companySourceService.saveCompanySource.mockResolvedValue({} as any);
      aiService.analyzeCompanyProfile.mockResolvedValue(mockAnalysisResult);
      companyService.update.mockResolvedValue({} as any);
      companyService.createOrUpdateAnalysis.mockRejectedValue(new Error('Analysis save failed'));

      // Act & Assert
      await expect(processor.handleCompanyAnalysis(mockJob)).rejects.toThrow('Analysis save failed');
    });
  });
});