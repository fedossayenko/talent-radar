import { CompanyScoringService } from '../../../src/modules/company/services/company-scoring.service';
import { ScoringInput, CompanyScore } from '../../../src/modules/company/interfaces/scoring.interface';

describe('CompanyScoringService', () => {
  let service: CompanyScoringService;

  beforeEach(() => {
    service = new CompanyScoringService();
  });

  describe('calculateCompanyScore', () => {
    it('should calculate complete score for a tech company with modern stack', async () => {
      const input: ScoringInput = {
        companyName: 'ModernTech Corp',
        industry: 'Software Development',
        size: '51-200',
        founded: 2015,
        employeeCount: 125,
        technologies: [
          'React', 'Node.js', 'TypeScript', 'Docker', 'Kubernetes', 
          'AWS', 'PostgreSQL', 'GraphQL', 'Jest', 'CI/CD'
        ],
        benefits: [
          'Remote work options', 'Flexible hours', 'Health insurance',
          'Stock options', 'Learning budget', 'Conference attendance',
          'Wellness programs', 'Parental leave'
        ],
        values: [
          'Innovation', 'Work-life balance', 'Diversity and inclusion',
          'Continuous learning', 'Open communication'
        ],
        awards: ['Best Employer 2023', 'Tech Innovation Award'],
        workModel: 'hybrid',
        jobOpenings: 15,
        socialPresence: true,
        websiteQuality: 8,
        glassdoorRating: 4.2,
        linkedinFollowers: 5000,
        githubActivity: 850,
        dataCompleteness: 95,
        sourceReliability: 90,
      };

      const result = await service.calculateCompanyScore(input);

      expect(result).toBeDefined();
      expect(result.overallScore).toBeGreaterThan(70);
      expect(result.overallScore).toBeLessThanOrEqual(100);

      // Verify category scores
      expect(result.categories.developerExperience).toBeGreaterThan(7);
      expect(result.categories.cultureAndValues).toBeGreaterThan(6);
      expect(result.categories.growthOpportunities).toBeGreaterThan(6);
      expect(result.categories.compensationBenefits).toBeGreaterThan(6);
      expect(result.categories.workLifeBalance).toBeGreaterThan(7);
      expect(result.categories.companyStability).toBeGreaterThan(5);

      // Verify individual factors
      expect(result.factors.techInnovation).toBeGreaterThan(7);
      expect(result.factors.workFlexibility).toBeGreaterThan(8);
      expect(result.factors.salaryCompetitiveness).toBeGreaterThan(5);

      // Verify metadata
      expect(result.scoringMetadata.version).toBe('2025.1');
      expect(result.scoringMetadata.scoredAt).toBeInstanceOf(Date);
      expect(result.scoringMetadata.confidenceLevel).toBeGreaterThan(80);
      expect(result.scoringMetadata.industryContext).toBe('Software Development');
      expect(result.scoringMetadata.companySize).toBe('51-200');

      // Verify insights
      expect(result.strengths).toHaveLength(5);
      expect(result.concerns).toHaveLength(3);
      expect(result.recommendations).toHaveLength(3);

      // Verify percentiles
      expect(result.industryPercentile).toBeGreaterThan(0);
      expect(result.industryPercentile).toBeLessThanOrEqual(100);
      expect(result.sizePercentile).toBeGreaterThan(0);
      expect(result.sizePercentile).toBeLessThanOrEqual(100);
    });

    it('should calculate score for a startup with limited data', async () => {
      const input: ScoringInput = {
        companyName: 'EarlyStage Startup',
        industry: 'FinTech',
        size: '1-10',
        founded: 2023,
        employeeCount: 8,
        technologies: ['Python', 'Django', 'PostgreSQL'],
        benefits: ['Stock options', 'Flexible hours'],
        values: ['Innovation', 'Speed'],
        awards: [],
        workModel: 'remote',
        jobOpenings: 3,
        socialPresence: false,
        websiteQuality: 6,
        glassdoorRating: null,
        linkedinFollowers: 150,
        githubActivity: 45,
        dataCompleteness: 60,
        sourceReliability: 70,
      };

      const result = await service.calculateCompanyScore(input);

      expect(result).toBeDefined();
      expect(result.overallScore).toBeGreaterThan(40);
      expect(result.overallScore).toBeLessThan(80);

      // Startup should score higher on growth opportunities despite lower stability
      expect(result.categories.growthOpportunities).toBeGreaterThan(result.categories.companyStability);

      // Work-life balance should be decent due to remote work
      expect(result.categories.workLifeBalance).toBeGreaterThan(6);

      // Lower confidence due to limited data
      expect(result.scoringMetadata.confidenceLevel).toBeLessThan(80);
    });

    it('should calculate score for an enterprise company', async () => {
      const input: ScoringInput = {
        companyName: 'BigCorp Enterprise',
        industry: 'Financial Services',
        size: '1000+',
        founded: 1995,
        employeeCount: 5000,
        technologies: ['Java', 'Spring', 'Oracle', 'Maven', 'Jenkins'],
        benefits: [
          'Health insurance', 'Dental insurance', 'Retirement 401k',
          'Paid time off', 'Training programs', 'Life insurance',
          'Employee discount', 'Wellness programs'
        ],
        values: ['Stability', 'Customer first', 'Integrity', 'Excellence'],
        awards: ['Fortune 500', 'Best Corporate Benefits'],
        workModel: 'office',
        jobOpenings: 50,
        socialPresence: true,
        websiteQuality: 9,
        glassdoorRating: 3.8,
        linkedinFollowers: 100000,
        githubActivity: 200,
        dataCompleteness: 90,
        sourceReliability: 95,
      };

      const result = await service.calculateCompanyScore(input);

      expect(result).toBeDefined();
      
      // Enterprise should score high on stability and benefits
      expect(result.categories.companyStability).toBeGreaterThan(7);
      expect(result.categories.compensationBenefits).toBeGreaterThan(7);

      // May score lower on tech innovation due to legacy tech stack
      expect(result.categories.developerExperience).toBeLessThan(8);

      // Work-life balance may be lower due to office-only model
      expect(result.categories.workLifeBalance).toBeLessThan(7);

      // High confidence due to lots of data and reputation
      expect(result.scoringMetadata.confidenceLevel).toBeGreaterThan(85);
    });

    it('should handle minimal data gracefully', async () => {
      const input: ScoringInput = {
        companyName: 'Unknown Corp',
        industry: '',
        size: '',
        founded: null,
        employeeCount: null,
        technologies: [],
        benefits: [],
        values: [],
        awards: [],
        workModel: null,
        jobOpenings: 0,
        socialPresence: false,
        websiteQuality: null,
        glassdoorRating: null,
        linkedinFollowers: null,
        githubActivity: null,
        dataCompleteness: 20,
        sourceReliability: 50,
      };

      const result = await service.calculateCompanyScore(input);

      expect(result).toBeDefined();
      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.overallScore).toBeLessThan(50);

      // All category scores should be low but not zero
      Object.values(result.categories).forEach(score => {
        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThan(6);
      });

      // Very low confidence due to minimal data
      expect(result.scoringMetadata.confidenceLevel).toBeLessThan(40);

      // Should have concerns about data availability
      expect(result.concerns).toContain(expect.stringContaining('Limited data'));
    });

    it('should apply industry-specific scoring adjustments', async () => {
      const baseInput: ScoringInput = {
        companyName: 'Test Corp',
        industry: 'Software Development',
        size: '51-200',
        founded: 2018,
        employeeCount: 100,
        technologies: ['JavaScript', 'React', 'Node.js'],
        benefits: ['Health insurance', 'Stock options'],
        values: ['Innovation'],
        awards: [],
        workModel: 'hybrid',
        jobOpenings: 5,
        socialPresence: true,
        websiteQuality: 7,
        glassdoorRating: 4.0,
        linkedinFollowers: 1000,
        githubActivity: 300,
        dataCompleteness: 80,
        sourceReliability: 85,
      };

      // Test FinTech industry (higher compensation emphasis)
      const fintechInput = { ...baseInput, industry: 'Financial Technology' };
      const fintechResult = await service.calculateCompanyScore(fintechInput);

      // Test Gaming industry (higher developer experience emphasis)
      const gamingInput = { ...baseInput, industry: 'Gaming' };
      const gamingResult = await service.calculateCompanyScore(gamingInput);

      // FinTech should weight compensation more heavily
      // Gaming should weight developer experience more heavily
      expect(fintechResult.categories.compensationBenefits).toBeGreaterThanOrEqual(
        gamingResult.categories.compensationBenefits
      );
      expect(gamingResult.categories.developerExperience).toBeGreaterThanOrEqual(
        fintechResult.categories.developerExperience
      );
    });

    it('should apply size-specific scoring adjustments', async () => {
      const baseInput: ScoringInput = {
        companyName: 'Test Corp',
        industry: 'Software Development',
        size: '51-200',
        founded: 2018,
        employeeCount: 100,
        technologies: ['JavaScript', 'React'],
        benefits: ['Health insurance'],
        values: ['Innovation'],
        awards: [],
        workModel: 'remote',
        jobOpenings: 5,
        socialPresence: true,
        websiteQuality: 7,
        glassdoorRating: 4.0,
        linkedinFollowers: 1000,
        githubActivity: 300,
        dataCompleteness: 80,
        sourceReliability: 85,
      };

      // Test startup vs enterprise
      const startupInput = { ...baseInput, size: '1-10', employeeCount: 8 };
      const enterpriseInput = { ...baseInput, size: '1000+', employeeCount: 2000 };

      const startupResult = await service.calculateCompanyScore(startupInput);
      const enterpriseResult = await service.calculateCompanyScore(enterpriseInput);

      // Startups should emphasize growth opportunities
      // Enterprise should emphasize stability
      expect(startupResult.categories.growthOpportunities).toBeGreaterThan(
        enterpriseResult.categories.growthOpportunities
      );
      expect(enterpriseResult.categories.companyStability).toBeGreaterThan(
        startupResult.categories.companyStability
      );
    });
  });

  describe('technology scoring', () => {
    it('should score modern tech stack higher than legacy', () => {
      const modernTech = ['React', 'TypeScript', 'Docker', 'Kubernetes', 'GraphQL', 'AWS'];
      const legacyTech = ['jQuery', 'PHP', 'MySQL', 'FTP'];

      const modernScore = service['scoreTechStack'](modernTech);
      const legacyScore = service['scoreTechStack'](legacyTech);

      expect(modernScore).toBeGreaterThan(legacyScore);
      expect(modernScore).toBeGreaterThan(7);
      expect(legacyScore).toBeLessThan(6);
    });

    it('should recognize and score various technology categories', () => {
      const frontendTech = ['React', 'Vue.js', 'Angular'];
      const backendTech = ['Node.js', 'Express', 'NestJS'];
      const databaseTech = ['PostgreSQL', 'MongoDB', 'Redis'];
      const devOpsTech = ['Docker', 'Kubernetes', 'Jenkins'];
      const cloudTech = ['AWS', 'Azure', 'Google Cloud'];

      expect(service['scoreTechStack'](frontendTech)).toBeGreaterThan(6);
      expect(service['scoreTechStack'](backendTech)).toBeGreaterThan(6);
      expect(service['scoreTechStack'](databaseTech)).toBeGreaterThan(6);
      expect(service['scoreTechStack'](devOpsTech)).toBeGreaterThan(7);
      expect(service['scoreTechStack'](cloudTech)).toBeGreaterThan(7);
    });

    it('should handle empty technology list', () => {
      const score = service['scoreTechStack']([]);
      expect(score).toBe(3); // Default baseline score
    });
  });

  describe('benefits scoring', () => {
    it('should score comprehensive benefits higher', () => {
      const basicBenefits = ['Health insurance'];
      const comprehensiveBenefits = [
        'Health insurance', 'Remote work', 'Stock options', 'Learning budget',
        'Flexible hours', 'Wellness programs', 'Parental leave'
      ];

      const basicScore = service['scoreBenefits'](basicBenefits);
      const comprehensiveScore = service['scoreBenefits'](comprehensiveBenefits);

      expect(comprehensiveScore).toBeGreaterThan(basicScore);
      expect(comprehensiveScore).toBeGreaterThan(7);
      expect(basicScore).toBeLessThan(5);
    });

    it('should recognize different benefit categories', () => {
      const healthBenefits = ['Health insurance', 'Dental insurance', 'Vision insurance'];
      const workLifeBenefits = ['Remote work', 'Flexible hours', 'Unlimited PTO'];
      const careerBenefits = ['Learning budget', 'Conference attendance', 'Mentorship'];
      const financialBenefits = ['Stock options', 'Bonus', 'Retirement plan'];

      expect(service['scoreBenefits'](healthBenefits)).toBeGreaterThan(5);
      expect(service['scoreBenefits'](workLifeBenefits)).toBeGreaterThan(6);
      expect(service['scoreBenefits'](careerBenefits)).toBeGreaterThan(6);
      expect(service['scoreBenefits'](financialBenefits)).toBeGreaterThan(6);
    });
  });

  describe('company values scoring', () => {
    it('should score developer-friendly values higher', () => {
      const developerFriendlyValues = [
        'Innovation', 'Continuous learning', 'Work-life balance',
        'Open communication', 'Technical excellence'
      ];
      const genericValues = ['Customer first', 'Integrity', 'Excellence'];

      const devScore = service['scoreCompanyValues'](developerFriendlyValues);
      const genericScore = service['scoreCompanyValues'](genericValues);

      expect(devScore).toBeGreaterThan(genericScore);
      expect(devScore).toBeGreaterThan(7);
    });

    it('should handle empty values list', () => {
      const score = service['scoreCompanyValues']([]);
      expect(score).toBe(5); // Neutral score for no values
    });
  });

  describe('work model scoring', () => {
    it('should score remote and hybrid work models higher', () => {
      const remoteScore = service['scoreWorkFlexibility']('remote');
      const hybridScore = service['scoreWorkFlexibility']('hybrid');
      const officeScore = service['scoreWorkFlexibility']('office');

      expect(remoteScore).toBe(10);
      expect(hybridScore).toBe(8);
      expect(officeScore).toBe(5);
    });

    it('should handle unknown work models', () => {
      const unknownScore = service['scoreWorkFlexibility'](null);
      expect(unknownScore).toBe(6); // Default neutral score
    });
  });

  describe('company age and stability scoring', () => {
    it('should score established companies higher for stability', () => {
      const establishedScore = service['scoreCompanyStability'](1995, '1000+');
      const youngScore = service['scoreCompanyStability'](2023, '1-10');

      expect(establishedScore).toBeGreaterThan(youngScore);
      expect(establishedScore).toBeGreaterThan(7);
      expect(youngScore).toBeLessThan(5);
    });

    it('should balance age and size for stability', () => {
      const oldSmallScore = service['scoreCompanyStability'](1990, '1-10');
      const youngLargeScore = service['scoreCompanyStability'](2020, '501-1000');

      // Young large company might be more stable than old small one
      expect(youngLargeScore).toBeGreaterThanOrEqual(oldSmallScore);
    });
  });

  describe('percentile calculation', () => {
    it('should calculate reasonable percentiles', () => {
      const mockInput: ScoringInput = {
        companyName: 'Test',
        industry: 'Software Development',
        size: '51-200',
        founded: 2018,
        employeeCount: 100,
        technologies: ['React', 'Node.js'],
        benefits: ['Health insurance', 'Remote work'],
        values: ['Innovation'],
        awards: [],
        workModel: 'hybrid',
        jobOpenings: 5,
        socialPresence: true,
        websiteQuality: 7,
        glassdoorRating: 4.0,
        linkedinFollowers: 1000,
        githubActivity: 300,
        dataCompleteness: 80,
        sourceReliability: 85,
      };

      const industryPercentile = service['calculateIndustryPercentile'](mockInput, 75);
      const sizePercentile = service['calculateSizePercentile'](mockInput, 75);

      expect(industryPercentile).toBeGreaterThan(0);
      expect(industryPercentile).toBeLessThanOrEqual(100);
      expect(sizePercentile).toBeGreaterThan(0);
      expect(sizePercentile).toBeLessThanOrEqual(100);
    });
  });

  describe('insights generation', () => {
    it('should generate meaningful strengths and concerns', async () => {
      const input: ScoringInput = {
        companyName: 'InnovativeCorp',
        industry: 'Software Development',
        size: '51-200',
        founded: 2018,
        employeeCount: 100,
        technologies: ['React', 'Node.js', 'TypeScript', 'Docker', 'AWS'],
        benefits: ['Remote work', 'Stock options', 'Learning budget'],
        values: ['Innovation', 'Work-life balance'],
        awards: ['Best Employer 2023'],
        workModel: 'remote',
        jobOpenings: 8,
        socialPresence: true,
        websiteQuality: 8,
        glassdoorRating: 4.5,
        linkedinFollowers: 3000,
        githubActivity: 500,
        dataCompleteness: 90,
        sourceReliability: 90,
      };

      const result = await service.calculateCompanyScore(input);

      expect(result.strengths).toHaveLength(5);
      expect(result.concerns).toHaveLength(3);
      expect(result.recommendations).toHaveLength(3);

      // Strengths should reflect positive aspects
      expect(result.strengths.some(s => s.includes('remote') || s.includes('flexible'))).toBeTruthy();
      expect(result.strengths.some(s => s.includes('tech') || s.includes('modern'))).toBeTruthy();

      // Should have actionable recommendations
      expect(result.recommendations.some(r => r.length > 10)).toBeTruthy();
    });
  });

  describe('error handling', () => {
    it('should handle invalid input data gracefully', async () => {
      const invalidInputs = [
        { ...({} as ScoringInput), companyName: '', dataCompleteness: 0, sourceReliability: 0 },
        { companyName: 'Test', founded: -1, employeeCount: -10 } as ScoringInput,
      ];

      for (const input of invalidInputs) {
        const result = await service.calculateCompanyScore(input);
        expect(result).toBeDefined();
        expect(result.overallScore).toBeGreaterThanOrEqual(0);
        expect(result.overallScore).toBeLessThanOrEqual(100);
      }
    });

    it('should handle null and undefined values', async () => {
      const inputWithNulls: ScoringInput = {
        companyName: 'NullCorp',
        industry: null as any,
        size: null as any,
        founded: null,
        employeeCount: null,
        technologies: null as any,
        benefits: null as any,
        values: null as any,
        awards: null as any,
        workModel: null,
        jobOpenings: 0,
        socialPresence: false,
        websiteQuality: null,
        glassdoorRating: null,
        linkedinFollowers: null,
        githubActivity: null,
        dataCompleteness: 10,
        sourceReliability: 50,
      };

      expect(async () => {
        await service.calculateCompanyScore(inputWithNulls);
      }).not.toThrow();

      const result = await service.calculateCompanyScore(inputWithNulls);
      expect(result).toBeDefined();
      expect(result.overallScore).toBeGreaterThan(0);
    });
  });
});