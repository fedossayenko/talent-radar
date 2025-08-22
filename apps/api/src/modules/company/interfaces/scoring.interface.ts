/**
 * Company Scoring System Interfaces
 * Based on 2025 best practices for evaluating tech companies and developer experience
 */

export interface ScoringWeights {
  // Primary scoring factors (should sum to 1.0)
  developerExperience: number;    // 25% - Tech stack, tools, practices
  cultureAndValues: number;       // 20% - Company values alignment, work environment
  growthOpportunities: number;    // 20% - Career paths, learning, mentorship
  compensationBenefits: number;   // 15% - Salary competitiveness, perks
  workLifeBalance: number;        // 15% - Remote work, flexibility, time off
  companyStability: number;       // 5%  - Size, funding, years in business
}

export interface ScoringFactors {
  // Developer Experience (0-10)
  techInnovation: number;         // Modern tech stack, cutting-edge tools
  developmentPractices: number;   // CI/CD, testing, code review practices
  toolsAndInfrastructure: number; // Development environment quality
  techCultureMaturity: number;    // Engineering culture, technical leadership
  
  // Culture & Values (0-10)
  cultureAlignment: number;       // Company values match developer values
  workEnvironment: number;        // Collaborative, inclusive, supportive
  leadership: number;             // Management quality, vision clarity
  transparency: number;           // Open communication, decision-making
  
  // Growth Opportunities (0-10)
  careerAdvancement: number;      // Clear promotion paths, role progression
  learningSupport: number;        // Training budget, conference attendance
  mentorship: number;             // Formal/informal mentoring programs
  skillDevelopment: number;       // Opportunities to learn new technologies
  
  // Compensation & Benefits (0-10)
  salaryCompetitiveness: number;  // Market-rate compensation
  equityParticipation: number;    // Stock options, profit sharing
  benefitsQuality: number;        // Health, dental, life insurance quality
  perksValue: number;             // Additional perks and benefits
  
  // Work-Life Balance (0-10)
  workFlexibility: number;        // Remote work, flexible hours
  timeOffPolicy: number;          // Vacation days, sick leave, sabbaticals
  workloadManagement: number;     // Reasonable hours, no crunch culture
  wellnessSupport: number;        // Mental health, fitness, wellness programs
  
  // Company Stability (0-10)
  financialStability: number;     // Company financial health
  marketPosition: number;         // Industry standing, competitive position
  growthTrajectory: number;       // Business growth, expansion plans
  layoffRisk: number;            // Employment security (reversed - lower is better)
}

export interface CompanyScore {
  // Overall composite score (0-100)
  overallScore: number;
  
  // Individual factor scores (0-10)
  factors: ScoringFactors;
  
  // Category scores (0-10) - weighted averages of factors
  categories: {
    developerExperience: number;
    cultureAndValues: number;
    growthOpportunities: number;
    compensationBenefits: number;
    workLifeBalance: number;
    companyStability: number;
  };
  
  // Metadata
  scoringMetadata: {
    version: string;            // Scoring algorithm version
    scoredAt: Date;            // When score was calculated
    dataSourcesUsed: string[]; // Which data sources contributed
    confidenceLevel: number;   // 0-100 confidence in score accuracy
    dataCompleteness: number;  // 0-100 how complete input data was
    industryContext: string;   // Industry for context-aware scoring
    companySize: string;       // Size category for peer comparison
  };
  
  // Scoring explanations
  strengths: string[];         // Top 5 company strengths
  concerns: string[];          // Top 3-5 areas of concern
  recommendations: string[];   // Improvement suggestions
  
  // Industry benchmarking
  industryPercentile: number;  // 0-100 percentile within industry
  sizePercentile: number;      // 0-100 percentile within size category
}

export interface ScoringCriteria {
  // Tech stack evaluation criteria
  techStackCriteria: {
    modernLanguages: string[];      // Languages considered modern
    cloudPlatforms: string[];       // Preferred cloud platforms
    devOpsPractices: string[];      // Modern DevOps practices
    frameworks: string[];           // Modern frameworks/libraries
    databases: string[];            // Modern database technologies
  };
  
  // Benefits evaluation criteria
  benefitsCriteria: {
    essentialBenefits: string[];    // Must-have benefits
    premiumBenefits: string[];      // Nice-to-have premium benefits
    wellnessBenefits: string[];     // Health and wellness benefits
    learningBenefits: string[];     // Professional development benefits
  };
  
  // Company size adjustments
  sizeAdjustments: {
    startup: ScoringWeights;        // Adjusted weights for startups
    small: ScoringWeights;          // Adjusted weights for small companies
    medium: ScoringWeights;         // Adjusted weights for medium companies
    large: ScoringWeights;          // Adjusted weights for large companies
    enterprise: ScoringWeights;     // Adjusted weights for enterprises
  };
  
  // Industry-specific adjustments
  industryModifiers: {
    [industry: string]: {
      factorMultipliers: Partial<ScoringFactors>; // Industry-specific factor adjustments
      additionalCriteria: string[];               // Industry-specific evaluation points
    };
  };
}

export interface ScoringInput {
  // Company basic info
  companyName: string;
  industry: string;
  size: string;
  founded: number | null;
  employeeCount: number | null;
  
  // Structured data from extraction
  technologies: string[];
  benefits: string[];
  values: string[];
  awards: string[];
  workModel: string | null;
  
  // Additional scoring data
  jobOpenings: number;
  socialPresence: boolean;
  websiteQuality: number | null;  // 0-10 rating if available
  
  // External data (if available)
  glassdoorRating: number | null;
  linkedinFollowers: number | null;
  githubActivity: number | null;
  
  // Data quality indicators
  dataCompleteness: number;       // 0-100 how complete the input data is
  sourceReliability: number;      // 0-100 reliability of data sources
}

export interface IndustryBenchmarks {
  industry: string;
  sampleSize: number;
  lastUpdated: Date;
  
  benchmarks: {
    averageScores: ScoringFactors;
    percentiles: {
      p25: ScoringFactors;
      p50: ScoringFactors;
      p75: ScoringFactors;
      p90: ScoringFactors;
    };
  };
  
  // Industry-specific insights
  keyDifferentiators: string[];   // What makes companies stand out in this industry
  commonChallenges: string[];     // Typical issues companies face
  trendingBenefits: string[];     // Benefits that are becoming popular
}

export interface CompanyScoreHistory {
  companyId: string;
  scores: Array<{
    score: CompanyScore;
    timestamp: Date;
    triggerReason: string;        // What caused the re-scoring
  }>;
  trends: {
    overallTrend: 'improving' | 'declining' | 'stable';
    categoryTrends: {
      [K in keyof ScoringFactors]: 'improving' | 'declining' | 'stable';
    };
    significantChanges: Array<{
      factor: keyof ScoringFactors;
      oldValue: number;
      newValue: number;
      changeDate: Date;
      reason: string;
    }>;
  };
}

// Default scoring weights based on 2025 developer priorities
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  developerExperience: 0.25,
  cultureAndValues: 0.20,
  growthOpportunities: 0.20,
  compensationBenefits: 0.15,
  workLifeBalance: 0.15,
  companyStability: 0.05,
};

// Industry-specific weight adjustments
export const INDUSTRY_WEIGHT_ADJUSTMENTS: Record<string, Partial<ScoringWeights>> = {
  'Financial Technology': {
    compensationBenefits: 0.20,  // FinTech typically pays more
    companyStability: 0.10,      // Stability more important in finance
  },
  'Gaming': {
    developerExperience: 0.30,   // Tech stack very important in gaming
    workLifeBalance: 0.10,       // Gaming can have work-life balance challenges
  },
  'Consulting': {
    growthOpportunities: 0.25,   // Career growth very important in consulting
    workLifeBalance: 0.10,       // Consulting often has demanding schedules
  },
  'Healthcare': {
    companyStability: 0.10,      // Stability important in healthcare
    cultureAndValues: 0.25,      // Mission-driven work important
  },
};

// Company size adjustments
export const SIZE_WEIGHT_ADJUSTMENTS: Record<string, Partial<ScoringWeights>> = {
  'startup': {
    companyStability: 0.02,      // Less emphasis on stability for startups
    growthOpportunities: 0.25,   // More emphasis on growth potential
  },
  'enterprise': {
    companyStability: 0.10,      // More emphasis on stability for large companies
    workLifeBalance: 0.20,       // Large companies often have better work-life balance
  },
};