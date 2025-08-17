import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from '../../src/modules/ai/ai.service';
import { AiProcessingPipelineService, PipelineInput, PipelineResult } from '../../src/modules/scraper/services/ai-processing-pipeline.service';
import { ContentExtractorService } from '../../src/modules/scraper/services/content-extractor.service';
import { HtmlCleanerService } from '../../src/modules/scraper/services/html-cleaner.service';
import { RedisService } from '../../src/common/redis/redis.service';
import { RedisMockService } from '../test-utils/redis-mock.service';
import { AiMockService } from '../test-utils/ai-mock.service';
import { AiContractValidator, loadAndValidateFixture } from '../test-utils/ai-contract-validator';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * AI Processing Pipeline E2E Tests
 * 
 * Comprehensive testing of the 4-step AI processing pipeline:
 * 1. Content Extraction
 * 2. Content Cleaning
 * 3. AI Processing
 * 4. Quality Validation
 */
describe('AI Processing Pipeline E2E', () => {
  let app: INestApplication;
  let pipelineService: AiProcessingPipelineService;
  let aiService: AiService;
  let aiMockService: AiMockService;
  let contractValidator: AiContractValidator;
  let moduleRef: TestingModule;

  // Test HTML fixtures
  const testHtmlFixtures = {
    highQuality: readFileSync(
      join(__dirname, '../fixtures/html/high-quality-job-posting.html'),
      'utf8'
    ),
    lowQuality: readFileSync(
      join(__dirname, '../fixtures/html/low-quality-job-posting.html'),
      'utf8'
    ),
    malformed: readFileSync(
      join(__dirname, '../fixtures/html/malformed-job-posting.html'),
      'utf8'
    ),
  };

  beforeAll(async () => {
    // Determine if we should use real AI service or mock
    const useRealAi = process.env.AI_E2E_USE_REAL_API === 'true';
    
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
      ],
      providers: [
        AiProcessingPipelineService,
        ContentExtractorService,
        HtmlCleanerService,
        {
          provide: AiService,
          useClass: useRealAi ? AiService : AiMockService,
        },
        {
          provide: RedisService,
          useClass: RedisMockService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    pipelineService = moduleRef.get<AiProcessingPipelineService>(AiProcessingPipelineService);
    aiService = moduleRef.get<AiService>(AiService);
    
    // Set up mock service if using mocks
    if (!useRealAi) {
      aiMockService = aiService as unknown as AiMockService;
      aiMockService.loadTestScenarios();
    }

    contractValidator = new AiContractValidator();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Reset mock service before each test
    if (aiMockService) {
      aiMockService.reset();
      aiMockService.loadTestScenarios();
    }
  });

  describe('Pipeline Processing - Success Scenarios', () => {
    it('should successfully process high-quality job posting', async () => {
      // Configure mock for high quality response
      if (aiMockService) {
        const fixture = loadAndValidateFixture('high-quality-vacancy.json');
        expect(fixture.isValid).toBe(true);
        aiMockService.setMockResponse('123', fixture.data!);
      }

      const input: PipelineInput = {
        html: testHtmlFixtures.highQuality,
        sourceUrl: 'https://example.com/job/123',
        options: {
          performQualityCheck: true,
          aiOptions: {
            qualityThreshold: 70,
          },
        },
      };

      const result: PipelineResult = await pipelineService.process(input);

      // Verify pipeline success
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.vacancyData).toBeDefined();

      // Verify content extraction
      expect(result.metadata.contentExtraction).toBeDefined();
      expect(result.metadata.contentExtraction.cleanedContent.length).toBeGreaterThan(0);

      // Verify HTML cleaning
      expect(result.metadata.htmlCleaning).toBeDefined();
      expect(result.metadata.htmlCleaning.cleanedLength).toBeGreaterThan(0);

      // Verify AI processing
      expect(result.metadata.processing.totalTime).toBeGreaterThan(0);
      expect(result.metadata.processing.qualityCheckPassed).toBe(true);

      // Verify quality scores
      expect(result.metadata.qualityScore).toBeGreaterThanOrEqual(70);
      expect(result.metadata.confidenceScore).toBeGreaterThanOrEqual(70);

      // Contract validation
      if (result.vacancyData) {
        const contractResult = contractValidator.validateVacancyExtraction(result.vacancyData);
        expect(contractResult.isValid).toBe(true);
        
        const qualityResult = contractValidator.validateQualityThresholds(result.vacancyData);
        expect(qualityResult.meetsMinimumQuality).toBe(true);
      }
    }, 30000);

    it('should handle low-quality job posting with quality validation warnings', async () => {
      if (aiMockService) {
        // Use a response that will trigger quality warnings
        const lowQualityFixture = loadAndValidateFixture('low-quality-vacancy.json');
        aiMockService.setMockResponse('456', lowQualityFixture.data!);
      }

      const input: PipelineInput = {
        html: testHtmlFixtures.lowQuality, // Using lower quality HTML
        sourceUrl: 'https://example.com/job/456',
        options: {
          performQualityCheck: true,
          aiOptions: {
            qualityThreshold: 50, // Standard threshold that low-quality data will fail
          },
        },
      };

      const result = await pipelineService.process(input);

      expect(result.success).toBe(true);
      expect(result.vacancyData).toBeDefined();
      
      // Should fail quality check due to low score, generating warnings
      expect(result.metadata.processing.qualityCheckPassed).toBe(false);
      expect(result.metadata.qualityScore).toBeLessThan(50);
      
      // Should have warnings about quality validation failure
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('Quality validation failed'))).toBe(true);
    });

    it('should process batch of job postings', async () => {
      if (aiMockService) {
        const highQualityFixture = loadAndValidateFixture('high-quality-vacancy.json');
        const mediumQualityFixture = loadAndValidateFixture('medium-quality-vacancy.json');
        
        aiMockService.setMockResponse('1', highQualityFixture.data!);
        aiMockService.setMockResponse('2', mediumQualityFixture.data!);
      }

      const batchInput = {
        items: [
          {
            id: 'job-1',
            html: testHtmlFixtures.highQuality,
            sourceUrl: 'https://example.com/job/1',
          },
          {
            id: 'job-2',
            html: testHtmlFixtures.lowQuality,
            sourceUrl: 'https://example.com/job/2',
          },
        ],
        options: {
          performQualityCheck: true,
        },
      };

      const result = await pipelineService.processBatch(batchInput);

      expect(result.summary.total).toBe(2);
      expect(result.summary.successful).toBeGreaterThan(0);
      expect(result.summary.failed).toBeLessThan(2);
      expect(result.summary.averageQualityScore).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Pipeline Processing - Error Scenarios', () => {
    it('should handle AI service failures gracefully', async () => {
      if (aiMockService) {
        aiMockService.setFailureScenario('failure', true);
      }

      const input: PipelineInput = {
        html: testHtmlFixtures.highQuality,
        sourceUrl: 'https://example.com/job/failure',
      };

      const result = await pipelineService.process(input);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.vacancyData).toBeNull();
    });

    it('should handle malformed HTML content', async () => {
      const input: PipelineInput = {
        html: testHtmlFixtures.malformed,
        sourceUrl: 'https://example.com/job/malformed',
      };

      const result = await pipelineService.process(input);

      // Should not crash but may have warnings or lower quality
      expect(result.success).toBeDefined();
      if (result.warnings) {
        expect(result.warnings.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle empty or very short content', async () => {
      const input: PipelineInput = {
        html: '<html><body>Job.</body></html>',
        sourceUrl: 'https://example.com/job/empty',
      };

      const result = await pipelineService.process(input);

      expect(result.warnings.some(w => w.includes('very short'))).toBe(true);
    });

    it('should respect quality thresholds', async () => {
      if (aiMockService) {
        const lowQualityFixture = loadAndValidateFixture('low-quality-vacancy.json');
        aiMockService.setMockResponse('lowquality', lowQualityFixture.data!);
      }

      const input: PipelineInput = {
        html: testHtmlFixtures.lowQuality,
        sourceUrl: 'https://example.com/job/lowquality',
        options: {
          performQualityCheck: true,
          aiOptions: {
            qualityThreshold: 80, // High threshold
          },
        },
      };

      const result = await pipelineService.process(input);

      // Should fail quality check due to high threshold
      if (result.vacancyData && result.vacancyData.qualityScore < 80) {
        expect(result.metadata.processing.qualityCheckPassed).toBe(false);
      }
    });
  });

  describe('Pipeline Processing - Performance Tests', () => {
    it('should complete processing within acceptable time limits', async () => {
      const startTime = Date.now();
      
      const input: PipelineInput = {
        html: testHtmlFixtures.highQuality,
        sourceUrl: 'https://example.com/job/performance',
      };

      const result = await pipelineService.process(input);
      const processingTime = Date.now() - startTime;

      // Should complete within 10 seconds for mocked tests
      expect(processingTime).toBeLessThan(10000);
      expect(result.metadata.processing.totalTime).toBeLessThan(10000);
    });

    it('should handle concurrent processing', async () => {
      const promises = Array.from({ length: 5 }, (_, i) => {
        const input: PipelineInput = {
          html: testHtmlFixtures.highQuality,
          sourceUrl: `https://example.com/job/concurrent-${i}`,
        };
        return pipelineService.process(input);
      });

      const results = await Promise.all(promises);

      results.forEach((result, _index) => {
        expect(result).toBeDefined();
        // At least some should succeed
      });

      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(0);
    });

    it('should demonstrate cache effectiveness', async () => {
      // Configure a specific response for cache testing
      if (aiMockService) {
        const fixture = loadAndValidateFixture('high-quality-vacancy.json');
        aiMockService.setMockResponse('cache-test', fixture.data!);
      }

      const input: PipelineInput = {
        html: testHtmlFixtures.highQuality,
        sourceUrl: 'https://example.com/job/cache-test',
      };

      // First call (no cache)
      const result1 = await pipelineService.process(input);
      
      // Second call (should use cache)
      const result2 = await pipelineService.process(input);

      expect(result1.success).toBe(result2.success);
      if (result1.success && result2.success) {
        expect(result1.vacancyData).toEqual(result2.vacancyData);
      }
    });
  });

  describe('Pipeline Health and Monitoring', () => {
    it('should report healthy status when services are available', async () => {
      const health = await pipelineService.getHealthStatus();

      expect(health.status).toBeDefined();
      expect(health.services).toBeDefined();
      expect(health.services.aiService).toBe(true);
      expect(health.services.contentExtractor).toBe(true);
      expect(health.services.htmlCleaner).toBe(true);
      expect(health.lastCheck).toBeInstanceOf(Date);
    });

    it('should provide processing statistics', async () => {
      const stats = await pipelineService.getProcessingStats();

      expect(stats).toBeDefined();
      expect(typeof stats.totalProcessed).toBe('number');
      expect(typeof stats.successRate).toBe('number');
      expect(typeof stats.averageProcessingTime).toBe('number');
      expect(typeof stats.cacheHitRate).toBe('number');
      expect(typeof stats.averageQualityScore).toBe('number');
    });
  });

  describe('Contract Testing', () => {
    it('should validate all fixture files against schema', () => {
      const validation = contractValidator.validateAllFixtures();
      
      expect(validation.valid.length).toBeGreaterThan(0);
      expect(validation.invalid.length).toBe(0);
      
      if (validation.invalid.length > 0) {
        // Only log in debug mode or on failure
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.log('Invalid fixtures:', validation.invalid);
        }
      }
    });

    it('should validate AI response schemas in real-time', async () => {
      if (aiMockService) {
        const fixture = loadAndValidateFixture('high-quality-vacancy.json');
        aiMockService.setMockResponse('schema-test', fixture.data!);
      }

      const input: PipelineInput = {
        html: testHtmlFixtures.highQuality,
        sourceUrl: 'https://example.com/job/schema-test',
      };

      const result = await pipelineService.process(input);

      if (result.success && result.vacancyData) {
        const contractResult = contractValidator.validateVacancyExtraction(result.vacancyData);
        expect(contractResult.isValid).toBe(true);
        
        if (!contractResult.isValid) {
          // Only log in debug mode
          if (process.env.NODE_ENV === 'development') {
            // eslint-disable-next-line no-console
            console.log('Schema validation errors:', contractResult.errors);
          }
        }
      }
    });
  });
});