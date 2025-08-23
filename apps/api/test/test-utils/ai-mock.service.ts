import { Injectable } from '@nestjs/common';
import { VacancyExtractionResult } from '../../src/modules/ai/ai.service';

/**
 * AI Mock Service for testing
 * 
 * Provides deterministic AI responses for testing without API costs.
 * Supports various scenarios including success, failure, and edge cases.
 */
@Injectable()
export class AiMockService {
  private mockResponses: Map<string, VacancyExtractionResult> = new Map();
  private failureScenarios: Set<string> = new Set();
  private delayScenarios: Map<string, number> = new Map();
  private staticTimestamp = '2025-08-17T17:58:40.500Z'; // Fixed timestamp for cache testing

  /**
   * Configure mock response for specific content hash
   */
  setMockResponse(contentHash: string, response: VacancyExtractionResult): void {
    this.mockResponses.set(contentHash, response);
  }

  /**
   * Configure failure scenario for specific content hash
   */
  setFailureScenario(contentHash: string, shouldFail: boolean = true): void {
    if (shouldFail) {
      this.failureScenarios.add(contentHash);
    } else {
      this.failureScenarios.delete(contentHash);
    }
  }

  /**
   * Configure delay for specific content hash (simulates API latency)
   */
  setDelayScenario(contentHash: string, delayMs: number): void {
    this.delayScenarios.set(contentHash, delayMs);
  }

  /**
   * Mock extraction method that replaces real AI service
   */
  async extractVacancyData(
    content: string,
    sourceUrl: string,
    _options: { skipCache?: boolean } = {},
  ): Promise<VacancyExtractionResult | null> {
    // Generate simple hash for mocking (matches real service behavior)
    const contentHash = this.generateSimpleHash(content + sourceUrl);

    // Also check for test scenario keys in the URL for easier testing
    const urlParts = sourceUrl.split('/');
    const testKey = urlParts[urlParts.length - 1]; // Get last part of URL

    // Check for failure scenarios (by hash or by test key)
    if (this.failureScenarios.has(contentHash) || this.failureScenarios.has(testKey)) {
      throw new Error('Simulated AI service failure');
    }

    // Simulate delay if configured
    const delay = this.delayScenarios.get(contentHash) || this.delayScenarios.get(testKey);
    if (delay) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Return configured mock response (check by hash first, then by test key)
    const response = this.mockResponses.get(contentHash) || 
                    this.mockResponses.get(testKey) || 
                    this.getDefaultMockResponse(sourceUrl);

    return response;
  }

  /**
   * Mock extraction method with raw response - Enhanced version for pipeline traceability
   */
  async extractVacancyDataWithRawResponse(
    content: string,
    sourceUrl: string,
    options: { skipCache?: boolean } = {},
  ): Promise<{ result: VacancyExtractionResult | null; rawResponse: string }> {
    // Call the existing method to get the result
    const result = await this.extractVacancyData(content, sourceUrl, options);
    
    // Generate mock raw response
    const mockRawResponse = result ? 
      JSON.stringify(result, null, 2) : 
      '{"error": "Failed to extract vacancy data"}';
    
    return { result, rawResponse: mockRawResponse };
  }

  /**
   * Mock content cleaning
   */
  async cleanContent(content: string): Promise<string> {
    // Simple mock implementation - just trim and remove extra whitespace
    return content.replace(/\s+/g, ' ').trim();
  }

  /**
   * Mock quality assessment
   */
  async assessContentQuality(content: string): Promise<any> {
    return {
      overallScore: content.length > 100 ? 85 : 45,
      completeness: 90,
      clarity: 80,
      specificity: 85,
      relevance: 90,
      professionalism: 85,
      issues: content.length < 100 ? ['Content too short'] : [],
      recommendations: ['Consider adding more details'],
    };
  }

  /**
   * Check if AI service is configured (always true for mock)
   */
  isConfigured(): boolean {
    return true;
  }

  /**
   * Clear all mock configurations
   */
  reset(): void {
    this.mockResponses.clear();
    this.failureScenarios.clear();
    this.delayScenarios.clear();
  }

  /**
   * Load predefined scenarios for comprehensive testing
   */
  loadTestScenarios(): void {
    // High quality vacancy scenario
    this.setMockResponse('high_quality_job', {
      title: 'Senior Software Engineer',
      company: 'TechCorp Ltd',
      location: 'Sofia, Bulgaria',
      salaryMin: 8000,
      salaryMax: 12000,
      currency: 'BGN',
      experienceLevel: 'senior',
      employmentType: 'full-time',
      workModel: 'hybrid',
      description: 'Exciting opportunity to work with cutting-edge technologies in a dynamic team environment.',
      requirements: [
        '5+ years experience with TypeScript/JavaScript',
        'Experience with Node.js and React',
        'Knowledge of cloud platforms (AWS/Azure)',
        'Strong problem-solving skills'
      ],
      responsibilities: [
        'Design and develop scalable web applications',
        'Mentor junior developers',
        'Collaborate with product teams',
        'Code review and testing'
      ],
      technologies: ['TypeScript', 'React', 'Node.js', 'AWS', 'Docker', 'PostgreSQL'],
      benefits: ['Health insurance', 'Flexible working hours', 'Professional development budget'],
      educationLevel: 'bachelor',
      industry: 'Technology',
      teamSize: '10-15',
      companySize: 'medium',
      applicationDeadline: null,
      postedDate: this.staticTimestamp,
      confidenceScore: 95,
      qualityScore: 92,
      extractionMetadata: {
        sourceType: 'job_board',
        contentLength: 1500,
        hasStructuredData: true,
        language: 'en',
      },
    });

    // Low quality vacancy scenario
    this.setMockResponse('low_quality_job', {
      title: 'Developer',
      company: null,
      location: null,
      salaryMin: null,
      salaryMax: null,
      currency: null,
      experienceLevel: 'not_specified',
      employmentType: 'not_specified',
      workModel: 'not_specified',
      description: 'Job available.',
      requirements: null,
      responsibilities: null,
      technologies: ['JavaScript'],
      benefits: null,
      educationLevel: 'not_specified',
      industry: null,
      teamSize: null,
      companySize: 'not_specified',
      applicationDeadline: null,
      postedDate: null,
      confidenceScore: 25,
      qualityScore: 15,
      extractionMetadata: {
        sourceType: 'other',
        contentLength: 50,
        hasStructuredData: false,
        language: 'en',
      },
    });

    // Medium quality scenario
    this.setMockResponse('medium_quality_job', {
      title: 'Frontend Developer',
      company: 'StartupCo',
      location: 'Remote',
      salaryMin: 4000,
      salaryMax: 6000,
      currency: 'BGN',
      experienceLevel: 'mid',
      employmentType: 'full-time',
      workModel: 'remote',
      description: 'Join our team to build amazing user interfaces.',
      requirements: [
        'Experience with React',
        'CSS/HTML knowledge'
      ],
      responsibilities: [
        'Build UI components',
        'Work with designers'
      ],
      technologies: ['React', 'CSS', 'HTML', 'JavaScript'],
      benefits: ['Remote work'],
      educationLevel: 'not_specified',
      industry: 'Technology',
      teamSize: '5-10',
      companySize: 'startup',
      applicationDeadline: null,
      postedDate: this.staticTimestamp,
      confidenceScore: 75,
      qualityScore: 68,
      extractionMetadata: {
        sourceType: 'company_website',
        contentLength: 800,
        hasStructuredData: true,
        language: 'en',
      },
    });
  }

  /**
   * Get default mock response for testing
   */
  private getDefaultMockResponse(_sourceUrl: string): VacancyExtractionResult {
    return {
      title: 'Software Developer',
      company: 'Default Company',
      location: 'Sofia, Bulgaria',
      salaryMin: 5000,
      salaryMax: 7000,
      currency: 'BGN',
      experienceLevel: 'mid',
      employmentType: 'full-time',
      workModel: 'hybrid',
      description: 'Default job description for testing purposes.',
      requirements: ['Programming experience', 'Team collaboration'],
      responsibilities: ['Write code', 'Test applications'],
      technologies: ['JavaScript', 'TypeScript'],
      benefits: ['Health insurance'],
      educationLevel: 'bachelor',
      industry: 'Technology',
      teamSize: '5-10',
      companySize: 'medium',
      applicationDeadline: null,
      postedDate: this.staticTimestamp,
      confidenceScore: 80,
      qualityScore: 75,
      extractionMetadata: {
        sourceType: 'job_board',
        contentLength: 500,
        hasStructuredData: true,
        language: 'en',
      },
    };
  }

  /**
   * Simple hash function for testing
   */
  private generateSimpleHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }
}