import { Injectable, Logger } from '@nestjs/common';
import {
  CompanyScore,
  ScoringInput,
  ScoringFactors,
  ScoringWeights,
  DEFAULT_SCORING_WEIGHTS,
  INDUSTRY_WEIGHT_ADJUSTMENTS,
  SIZE_WEIGHT_ADJUSTMENTS,
} from '../interfaces/scoring.interface';

/**
 * Advanced Company Scoring Service
 * Implements 2025 best practices for evaluating tech companies and developer experience
 */
@Injectable()
export class CompanyScoringService {
  private readonly logger = new Logger(CompanyScoringService.name);
  private readonly scoringVersion = '2025.1.0';

  /**
   * Calculate comprehensive company score based on multiple factors
   */
  async calculateCompanyScore(input: ScoringInput): Promise<CompanyScore> {
    this.logger.log(`Calculating score for company: ${input.companyName}`);

    try {
      // Get appropriate scoring weights for this company
      const weights = this.getAdjustedScoringWeights(input.industry, input.size);
      
      // Calculate individual factor scores
      const factors = this.calculateScoringFactors(input);
      
      // Calculate category scores (weighted averages of factors)
      const categories = this.calculateCategoryScores(factors);
      
      // Calculate overall composite score
      const overallScore = this.calculateOverallScore(categories, weights);
      
      // Generate insights and recommendations
      const strengths = this.identifyStrengths(factors, input);
      const concerns = this.identifyConcerns(factors, input);
      const recommendations = this.generateRecommendations(factors, input);

      const score: CompanyScore = {
        overallScore,
        factors,
        categories,
        scoringMetadata: {
          version: this.scoringVersion,
          scoredAt: new Date(),
          dataSourcesUsed: this.getDataSources(input),
          confidenceLevel: this.calculateConfidenceLevel(input),
          dataCompleteness: input.dataCompleteness,
          industryContext: input.industry,
          companySize: input.size,
        },
        strengths,
        concerns,
        recommendations,
        industryPercentile: 0, // Will be calculated when benchmarking is implemented
        sizePercentile: 0,     // Will be calculated when benchmarking is implemented
      };

      this.logger.log(`Score calculated for ${input.companyName}: ${overallScore}/100 (confidence: ${score.scoringMetadata.confidenceLevel}%)`);
      
      return score;

    } catch (error) {
      this.logger.error(`Failed to calculate score for ${input.companyName}:`, error);
      throw error;
    }
  }

  /**
   * Calculate individual scoring factors (0-10 scale)
   */
  private calculateScoringFactors(input: ScoringInput): ScoringFactors {
    return {
      // Developer Experience factors
      techInnovation: this.calculateTechInnovationScore(input),
      developmentPractices: this.calculateDevelopmentPracticesScore(input),
      toolsAndInfrastructure: this.calculateToolsInfrastructureScore(input),
      techCultureMaturity: this.calculateTechCultureScore(input),
      
      // Culture & Values factors
      cultureAlignment: this.calculateCultureAlignmentScore(input),
      workEnvironment: this.calculateWorkEnvironmentScore(input),
      leadership: this.calculateLeadershipScore(input),
      transparency: this.calculateTransparencyScore(input),
      
      // Growth Opportunities factors
      careerAdvancement: this.calculateCareerAdvancementScore(input),
      learningSupport: this.calculateLearningSupportScore(input),
      mentorship: this.calculateMentorshipScore(input),
      skillDevelopment: this.calculateSkillDevelopmentScore(input),
      
      // Compensation & Benefits factors
      salaryCompetitiveness: this.calculateSalaryCompetitivenessScore(input),
      equityParticipation: this.calculateEquityParticipationScore(input),
      benefitsQuality: this.calculateBenefitsQualityScore(input),
      perksValue: this.calculatePerksValueScore(input),
      
      // Work-Life Balance factors
      workFlexibility: this.calculateWorkFlexibilityScore(input),
      timeOffPolicy: this.calculateTimeOffPolicyScore(input),
      workloadManagement: this.calculateWorkloadManagementScore(input),
      wellnessSupport: this.calculateWellnessSupportScore(input),
      
      // Company Stability factors
      financialStability: this.calculateFinancialStabilityScore(input),
      marketPosition: this.calculateMarketPositionScore(input),
      growthTrajectory: this.calculateGrowthTrajectoryScore(input),
      layoffRisk: this.calculateLayoffRiskScore(input),
    };
  }

  // Developer Experience Scoring Methods
  private calculateTechInnovationScore(input: ScoringInput): number {
    const modernTechs = [
      'React', 'Vue.js', 'Angular', 'Node.js', 'TypeScript', 'Go', 'Rust', 'Kotlin', 'Swift',
      'Docker', 'Kubernetes', 'AWS', 'Azure', 'Google Cloud', 'GraphQL', 'PostgreSQL', 'MongoDB',
      'Redis', 'Elasticsearch', 'Kafka', 'microservices', 'serverless'
    ];

    const technologies = input.technologies || [];
    const techMatches = technologies.filter(tech => 
      modernTechs.some(modern => tech.toLowerCase().includes(modern.toLowerCase()))
    ).length;

    const techScore = Math.min(10, (techMatches / modernTechs.length) * 20);
    
    // Bonus for cutting-edge technologies
    const cuttingEdgeTechs = ['Rust', 'Go', 'GraphQL', 'Kubernetes', 'serverless'];
    const cuttingEdgeMatches = technologies.filter(tech => 
      cuttingEdgeTechs.some(cutting => tech.toLowerCase().includes(cutting.toLowerCase()))
    ).length;

    return Math.min(10, techScore + (cuttingEdgeMatches * 0.5));
  }

  private calculateDevelopmentPracticesScore(input: ScoringInput): number {
    const practiceKeywords = [
      'agile', 'scrum', 'ci/cd', 'continuous integration', 'testing', 'code review',
      'pair programming', 'tdd', 'bdd', 'devops', 'automation'
    ];

    const values = input.values || [];
    const valuesText = values.join(' ').toLowerCase();
    const practiceMatches = practiceKeywords.filter(keyword => 
      valuesText.includes(keyword)
    ).length;

    return Math.min(10, (practiceMatches / practiceKeywords.length) * 15);
  }

  private calculateToolsInfrastructureScore(input: ScoringInput): number {
    const toolKeywords = [
      'github', 'gitlab', 'jenkins', 'docker', 'kubernetes', 'aws', 'azure',
      'monitoring', 'logging', 'metrics', 'observability'
    ];

    const technologies = input.technologies || [];
    const techText = technologies.join(' ').toLowerCase();
    const toolMatches = toolKeywords.filter(keyword => 
      techText.includes(keyword)
    ).length;

    return Math.min(10, (toolMatches / toolKeywords.length) * 12);
  }

  private calculateTechCultureScore(input: ScoringInput): number {
    const cultureKeywords = [
      'innovation', 'learning', 'growth', 'technical excellence', 'engineering',
      'open source', 'conferences', 'tech talks', 'knowledge sharing'
    ];

    const values = input.values || [];
    const benefits = input.benefits || [];
    const valuesText = (values.join(' ') + ' ' + benefits.join(' ')).toLowerCase();
    const cultureMatches = cultureKeywords.filter(keyword => 
      valuesText.includes(keyword)
    ).length;

    let score = Math.min(10, (cultureMatches / cultureKeywords.length) * 15);

    // Bonus for tech-focused benefits
    if (benefits.some(b => b.toLowerCase().includes('conference'))) score += 1;
    if (benefits.some(b => b.toLowerCase().includes('training'))) score += 1;
    if (benefits.some(b => b.toLowerCase().includes('certification'))) score += 1;

    return Math.min(10, score);
  }

  // Culture & Values Scoring Methods
  private calculateCultureAlignmentScore(input: ScoringInput): number {
    const positiveValues = [
      'collaboration', 'teamwork', 'respect', 'diversity', 'inclusion',
      'transparency', 'integrity', 'innovation', 'learning', 'growth'
    ];

    const values = input.values || [];
    const valuesText = values.join(' ').toLowerCase();
    const positiveMatches = positiveValues.filter(value => 
      valuesText.includes(value)
    ).length;

    return Math.min(10, (positiveMatches / positiveValues.length) * 12);
  }

  private calculateWorkEnvironmentScore(input: ScoringInput): number {
    const environmentKeywords = [
      'collaborative', 'supportive', 'inclusive', 'friendly', 'open',
      'creative', 'innovative', 'flexible', 'positive'
    ];

    const values = input.values || [];
    const valuesText = values.join(' ').toLowerCase();
    const envMatches = environmentKeywords.filter(keyword => 
      valuesText.includes(keyword)
    ).length;

    let score = Math.min(10, (envMatches / environmentKeywords.length) * 12);

    // Bonus for remote/hybrid work options
    if (input.workModel === 'remote' || input.workModel === 'hybrid') score += 1;

    return Math.min(10, score);
  }

  private calculateLeadershipScore(input: ScoringInput): number {
    const leadershipKeywords = [
      'leadership', 'vision', 'mission', 'strategy', 'guidance',
      'mentorship', 'coaching', 'development', 'empowerment'
    ];

    const values = input.values || [];
    const valuesText = values.join(' ').toLowerCase();
    const leadershipMatches = leadershipKeywords.filter(keyword => 
      valuesText.includes(keyword)
    ).length;

    return Math.min(10, (leadershipMatches / leadershipKeywords.length) * 15);
  }

  private calculateTransparencyScore(input: ScoringInput): number {
    const transparencyKeywords = [
      'transparency', 'open', 'communication', 'feedback', 'honest',
      'clear', 'straightforward', 'direct'
    ];

    const values = input.values || [];
    const valuesText = values.join(' ').toLowerCase();
    const transparencyMatches = transparencyKeywords.filter(keyword => 
      valuesText.includes(keyword)
    ).length;

    return Math.min(10, (transparencyMatches / transparencyKeywords.length) * 15);
  }

  // Growth Opportunities Scoring Methods
  private calculateCareerAdvancementScore(input: ScoringInput): number {
    const careerKeywords = [
      'career', 'advancement', 'promotion', 'growth', 'development',
      'progression', 'path', 'opportunity', 'leadership'
    ];

    const benefits = input.benefits || [];
    const benefitsText = benefits.join(' ').toLowerCase();
    const careerMatches = careerKeywords.filter(keyword => 
      benefitsText.includes(keyword)
    ).length;

    let score = Math.min(10, (careerMatches / careerKeywords.length) * 15);

    // Company size adjustment (larger companies often have clearer career paths)
    if (input.size === 'large' || input.size === 'enterprise') score += 1;
    if (input.size === 'startup') score -= 0.5;

    return Math.max(0, Math.min(10, score));
  }

  private calculateLearningSupportScore(input: ScoringInput): number {
    const learningKeywords = [
      'training', 'education', 'learning', 'course', 'certification',
      'conference', 'workshop', 'development budget', 'skill development'
    ];

    const benefits = input.benefits || [];
    const benefitsText = benefits.join(' ').toLowerCase();
    const learningMatches = learningKeywords.filter(keyword => 
      benefitsText.includes(keyword)
    ).length;

    return Math.min(10, (learningMatches / learningKeywords.length) * 15);
  }

  private calculateMentorshipScore(input: ScoringInput): number {
    const mentorshipKeywords = [
      'mentor', 'mentoring', 'mentorship', 'coaching', 'guidance',
      'buddy system', 'onboarding', 'senior developer'
    ];

    const benefits = input.benefits || [];
    const benefitsText = benefits.join(' ').toLowerCase();
    const mentorshipMatches = mentorshipKeywords.filter(keyword => 
      benefitsText.includes(keyword)
    ).length;

    return Math.min(10, (mentorshipMatches / mentorshipKeywords.length) * 20);
  }

  private calculateSkillDevelopmentScore(input: ScoringInput): number {
    const skillKeywords = [
      'skill development', 'learning', 'training', 'upskilling',
      'reskilling', 'professional development', 'tech talks', 'hackathon'
    ];

    const benefits = input.benefits || [];
    const values = input.values || [];
    const benefitsText = (benefits.join(' ') + ' ' + values.join(' ')).toLowerCase();
    const skillMatches = skillKeywords.filter(keyword => 
      benefitsText.includes(keyword)
    ).length;

    return Math.min(10, (skillMatches / skillKeywords.length) * 15);
  }

  // Compensation & Benefits Scoring Methods
  private calculateSalaryCompetitivenessScore(input: ScoringInput): number {
    // Base score on industry and company size
    let score = 6; // Baseline assumption

    // Industry adjustments
    const highPayingIndustries = ['Financial Technology', 'Finance', 'Tech', 'Consulting'];
    const industry = input.industry || '';
    if (highPayingIndustries.some(industryName => industry.includes(industryName))) {
      score += 1;
    }

    // Size adjustments
    if (input.size === 'large' || input.size === 'enterprise') score += 1;
    if (input.size === 'startup') score -= 0.5;

    // Look for salary-related benefits
    const salaryKeywords = ['competitive salary', 'market rate', 'bonus', 'equity', 'stock options'];
    const benefits = input.benefits || [];
    const benefitsText = benefits.join(' ').toLowerCase();
    const salaryBenefits = salaryKeywords.filter(keyword => 
      benefitsText.includes(keyword)
    ).length;

    score += salaryBenefits * 0.5;

    return Math.max(0, Math.min(10, score));
  }

  private calculateEquityParticipationScore(input: ScoringInput): number {
    const equityKeywords = [
      'equity', 'stock options', 'shares', 'ownership', 'profit sharing',
      'employee stock', 'vesting', 'RSU', 'ESPP'
    ];

    const benefits = input.benefits || [];
    const benefitsText = benefits.join(' ').toLowerCase();
    const equityMatches = equityKeywords.filter(keyword => 
      benefitsText.includes(keyword)
    ).length;

    let score = Math.min(10, (equityMatches / equityKeywords.length) * 20);

    // Startup bonus (more likely to offer meaningful equity)
    if (input.size === 'startup' && equityMatches > 0) score += 2;

    return Math.min(10, score);
  }

  private calculateBenefitsQualityScore(input: ScoringInput): number {
    const essentialBenefits = [
      'health insurance', 'dental', 'life insurance', 'disability insurance',
      'retirement', 'pension', '401k'
    ];

    const premiumBenefits = [
      'additional health insurance', 'supplemental insurance', 'vision',
      'mental health', 'wellness', 'family coverage'
    ];

    const benefits = input.benefits || [];
    const benefitsText = benefits.join(' ').toLowerCase();
    
    const essentialMatches = essentialBenefits.filter(benefit => 
      benefitsText.includes(benefit)
    ).length;

    const premiumMatches = premiumBenefits.filter(benefit => 
      benefitsText.includes(benefit)
    ).length;

    const essentialScore = (essentialMatches / essentialBenefits.length) * 6;
    const premiumScore = (premiumMatches / premiumBenefits.length) * 4;

    return Math.min(10, essentialScore + premiumScore);
  }

  private calculatePerksValueScore(input: ScoringInput): number {
    const perkKeywords = [
      'free lunch', 'free breakfast', 'snacks', 'coffee', 'kitchen',
      'gym', 'fitness', 'sports', 'massage', 'game room', 'parking',
      'team building', 'parties', 'events', 'office perks'
    ];

    const benefits = input.benefits || [];
    const benefitsText = benefits.join(' ').toLowerCase();
    const perkMatches = perkKeywords.filter(keyword => 
      benefitsText.includes(keyword)
    ).length;

    return Math.min(10, (perkMatches / perkKeywords.length) * 15);
  }

  // Work-Life Balance Scoring Methods
  private calculateWorkFlexibilityScore(input: ScoringInput): number {
    let score = 5; // Baseline

    // Work model scoring
    if (input.workModel === 'remote') score += 3;
    else if (input.workModel === 'hybrid') score += 2;
    else if (input.workModel === 'office') score += 0;

    // Look for flexibility keywords
    const flexibilityKeywords = [
      'flexible hours', 'flexible working', 'work from home', 'remote work',
      'flexible schedule', 'core hours', 'flexi time'
    ];

    const benefits = input.benefits || [];
    const benefitsText = benefits.join(' ').toLowerCase();
    const flexMatches = flexibilityKeywords.filter(keyword => 
      benefitsText.includes(keyword)
    ).length;

    score += flexMatches * 0.8;

    return Math.min(10, score);
  }

  private calculateTimeOffPolicyScore(input: ScoringInput): number {
    const timeOffKeywords = [
      'vacation', 'annual leave', 'paid time off', 'PTO', 'holidays',
      'sabbatical', 'unlimited vacation', 'flexible time off'
    ];

    const benefits = input.benefits || [];
    const benefitsText = benefits.join(' ').toLowerCase();
    const timeOffMatches = timeOffKeywords.filter(keyword => 
      benefitsText.includes(keyword)
    ).length;

    let score = Math.min(10, (timeOffMatches / timeOffKeywords.length) * 15);

    // Bonus for generous time off
    if (benefitsText.includes('25') || benefitsText.includes('30')) score += 1;
    if (benefitsText.includes('unlimited')) score += 2;

    return Math.min(10, score);
  }

  private calculateWorkloadManagementScore(input: ScoringInput): number {
    // Base score - assume reasonable workload unless indicated otherwise
    let score = 7;

    // Look for workload-related indicators
    const positiveKeywords = ['work life balance', 'reasonable hours', 'no overtime'];
    const negativeKeywords = ['crunch', 'long hours', 'overtime', 'demanding'];

    const benefits = input.benefits || [];
    const values = input.values || [];
    const allText = (benefits.join(' ') + ' ' + values.join(' ')).toLowerCase();
    
    const positiveMatches = positiveKeywords.filter(keyword => 
      allText.includes(keyword)
    ).length;

    const negativeMatches = negativeKeywords.filter(keyword => 
      allText.includes(keyword)
    ).length;

    score += positiveMatches * 1;
    score -= negativeMatches * 2;

    return Math.max(0, Math.min(10, score));
  }

  private calculateWellnessSupportScore(input: ScoringInput): number {
    const wellnessKeywords = [
      'wellness', 'mental health', 'fitness', 'gym', 'health',
      'wellbeing', 'mindfulness', 'stress', 'support', 'counseling'
    ];

    const benefits = input.benefits || [];
    const benefitsText = benefits.join(' ').toLowerCase();
    const wellnessMatches = wellnessKeywords.filter(keyword => 
      benefitsText.includes(keyword)
    ).length;

    return Math.min(10, (wellnessMatches / wellnessKeywords.length) * 15);
  }

  // Company Stability Scoring Methods
  private calculateFinancialStabilityScore(input: ScoringInput): number {
    let score = 6; // Baseline assumption

    // Age-based stability (older companies generally more stable)
    const currentYear = new Date().getFullYear();
    const age = input.founded ? currentYear - input.founded : 0;

    if (age >= 20) score += 2;
    else if (age >= 10) score += 1;
    else if (age >= 5) score += 0.5;
    else if (age < 2) score -= 1;

    // Size-based stability
    if (input.size === 'enterprise') score += 2;
    else if (input.size === 'large') score += 1;
    else if (input.size === 'startup') score -= 1;

    return Math.max(0, Math.min(10, score));
  }

  private calculateMarketPositionScore(input: ScoringInput): number {
    let score = 6; // Baseline

    // Awards and recognition indicate good market position
    const awards = input.awards || [];
    const awardCount = awards.length;
    score += Math.min(2, awardCount * 0.5);

    // Employee count indicates market presence
    if (input.employeeCount) {
      if (input.employeeCount > 1000) score += 2;
      else if (input.employeeCount > 500) score += 1;
      else if (input.employeeCount > 100) score += 0.5;
    }

    return Math.max(0, Math.min(10, score));
  }

  private calculateGrowthTrajectoryScore(input: ScoringInput): number {
    let score = 6; // Baseline assumption

    // Job openings indicate growth
    if (input.jobOpenings > 10) score += 2;
    else if (input.jobOpenings > 5) score += 1;
    else if (input.jobOpenings > 0) score += 0.5;

    // Recent founding indicates growth potential (but also risk)
    const currentYear = new Date().getFullYear();
    const age = input.founded ? currentYear - input.founded : 0;

    if (age >= 2 && age <= 7) score += 1; // Sweet spot for growth
    else if (age < 2) score += 0.5; // High potential but risky

    return Math.max(0, Math.min(10, score));
  }

  private calculateLayoffRiskScore(input: ScoringInput): number {
    // Higher score means lower risk (this is reversed from other metrics)
    let score = 7; // Baseline assumption of low risk

    // Size-based risk assessment
    if (input.size === 'enterprise' || input.size === 'large') score += 1;
    else if (input.size === 'startup') score -= 2;

    // Industry risk factors (tech companies had layoffs in 2022-2023)
    const riskIndustries = ['Technology', 'Software', 'Social Media'];
    const industry = input.industry || '';
    if (riskIndustries.some(industryName => industry.includes(industryName))) {
      score -= 0.5;
    }

    // Stable industries
    const stableIndustries = ['Healthcare', 'Finance', 'Government'];
    if (stableIndustries.some(industryName => industry.includes(industryName))) {
      score += 0.5;
    }

    return Math.max(0, Math.min(10, score));
  }

  /**
   * Calculate category scores as weighted averages of factors
   */
  private calculateCategoryScores(factors: ScoringFactors): CompanyScore['categories'] {
    return {
      developerExperience: this.average([
        factors.techInnovation,
        factors.developmentPractices,
        factors.toolsAndInfrastructure,
        factors.techCultureMaturity
      ]),
      cultureAndValues: this.average([
        factors.cultureAlignment,
        factors.workEnvironment,
        factors.leadership,
        factors.transparency
      ]),
      growthOpportunities: this.average([
        factors.careerAdvancement,
        factors.learningSupport,
        factors.mentorship,
        factors.skillDevelopment
      ]),
      compensationBenefits: this.average([
        factors.salaryCompetitiveness,
        factors.equityParticipation,
        factors.benefitsQuality,
        factors.perksValue
      ]),
      workLifeBalance: this.average([
        factors.workFlexibility,
        factors.timeOffPolicy,
        factors.workloadManagement,
        factors.wellnessSupport
      ]),
      companyStability: this.average([
        factors.financialStability,
        factors.marketPosition,
        factors.growthTrajectory,
        factors.layoffRisk
      ]),
    };
  }

  /**
   * Calculate overall weighted score
   */
  private calculateOverallScore(
    categories: CompanyScore['categories'], 
    weights: ScoringWeights
  ): number {
    const weightedScore = (
      categories.developerExperience * weights.developerExperience +
      categories.cultureAndValues * weights.cultureAndValues +
      categories.growthOpportunities * weights.growthOpportunities +
      categories.compensationBenefits * weights.compensationBenefits +
      categories.workLifeBalance * weights.workLifeBalance +
      categories.companyStability * weights.companyStability
    );

    // Convert to 0-100 scale
    return Math.round(weightedScore * 10);
  }

  /**
   * Get adjusted scoring weights based on industry and company size
   */
  private getAdjustedScoringWeights(industry: string, size: string): ScoringWeights {
    let weights = { ...DEFAULT_SCORING_WEIGHTS };

    // Apply industry adjustments
    const industryAdjustment = INDUSTRY_WEIGHT_ADJUSTMENTS[industry];
    if (industryAdjustment) {
      weights = { ...weights, ...industryAdjustment };
    }

    // Apply size adjustments
    const sizeAdjustment = SIZE_WEIGHT_ADJUSTMENTS[size];
    if (sizeAdjustment) {
      weights = { ...weights, ...sizeAdjustment };
    }

    // Ensure weights sum to 1.0
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    if (totalWeight !== 1.0) {
      const factor = 1.0 / totalWeight;
      Object.keys(weights).forEach(key => {
        weights[key as keyof ScoringWeights] *= factor;
      });
    }

    return weights;
  }

  /**
   * Identify company strengths
   */
  private identifyStrengths(factors: ScoringFactors, _input: ScoringInput): string[] {
    const strengths: string[] = [];
    const factorEntries = Object.entries(factors) as [keyof ScoringFactors, number][];
    
    // Find top-scoring factors (8+ score)
    const topFactors = factorEntries
      .filter(([_, score]) => score >= 8)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 5);

    const strengthMap: Record<keyof ScoringFactors, string> = {
      techInnovation: 'Cutting-edge technology stack and modern development practices',
      developmentPractices: 'Strong software development methodologies and processes',
      toolsAndInfrastructure: 'Excellent development tools and infrastructure',
      techCultureMaturity: 'Mature technical culture with focus on engineering excellence',
      cultureAlignment: 'Strong cultural values alignment with developer priorities',
      workEnvironment: 'Positive and collaborative work environment',
      leadership: 'Strong leadership and clear company vision',
      transparency: 'High level of transparency and open communication',
      careerAdvancement: 'Clear career advancement opportunities and growth paths',
      learningSupport: 'Excellent professional development and learning support',
      mentorship: 'Strong mentorship programs and senior developer guidance',
      skillDevelopment: 'Outstanding opportunities for skill development and learning',
      salaryCompetitiveness: 'Highly competitive salary and compensation packages',
      equityParticipation: 'Attractive equity participation and ownership opportunities',
      benefitsQuality: 'Comprehensive and high-quality benefits package',
      perksValue: 'Valuable workplace perks and additional benefits',
      workFlexibility: 'Excellent work flexibility and remote work options',
      timeOffPolicy: 'Generous time off and vacation policies',
      workloadManagement: 'Healthy work-life balance with reasonable workload',
      wellnessSupport: 'Strong focus on employee wellness and mental health',
      financialStability: 'Excellent financial stability and business health',
      marketPosition: 'Strong market position and industry recognition',
      growthTrajectory: 'Positive growth trajectory and expansion opportunities',
      layoffRisk: 'Low layoff risk and high employment security',
    };

    topFactors.forEach(([factor, _]) => {
      if (strengthMap[factor]) {
        strengths.push(strengthMap[factor]);
      }
    });

    return strengths;
  }

  /**
   * Identify areas of concern
   */
  private identifyConcerns(factors: ScoringFactors, _input: ScoringInput): string[] {
    const concerns: string[] = [];
    const factorEntries = Object.entries(factors) as [keyof ScoringFactors, number][];
    
    // Find low-scoring factors (5 or below)
    const lowFactors = factorEntries
      .filter(([_, score]) => score <= 5)
      .sort(([_, a], [__, b]) => a - b)
      .slice(0, 5);

    const concernMap: Record<keyof ScoringFactors, string> = {
      techInnovation: 'Limited use of modern technologies and development practices',
      developmentPractices: 'Potential gaps in software development methodologies',
      toolsAndInfrastructure: 'Development tools and infrastructure may need improvement',
      techCultureMaturity: 'Technical culture and engineering practices could be enhanced',
      cultureAlignment: 'Company culture may not fully align with developer values',
      workEnvironment: 'Work environment could be more collaborative or supportive',
      leadership: 'Leadership effectiveness or company vision may need strengthening',
      transparency: 'Communication transparency could be improved',
      careerAdvancement: 'Career advancement opportunities may be limited',
      learningSupport: 'Professional development support could be enhanced',
      mentorship: 'Mentorship programs may be lacking or underdeveloped',
      skillDevelopment: 'Skill development opportunities appear to be limited',
      salaryCompetitiveness: 'Compensation may not be competitive with market rates',
      equityParticipation: 'Limited equity or ownership participation opportunities',
      benefitsQuality: 'Benefits package may be basic or lacking key components',
      perksValue: 'Workplace perks and additional benefits appear minimal',
      workFlexibility: 'Work flexibility and remote work options may be limited',
      timeOffPolicy: 'Time off and vacation policies could be more generous',
      workloadManagement: 'Workload management and work-life balance may be challenging',
      wellnessSupport: 'Employee wellness and mental health support appears limited',
      financialStability: 'Financial stability of the company may be a concern',
      marketPosition: 'Market position and industry recognition could be stronger',
      growthTrajectory: 'Growth trajectory and future opportunities may be uncertain',
      layoffRisk: 'Higher risk of layoffs or employment instability',
    };

    lowFactors.forEach(([factor, _]) => {
      if (concernMap[factor]) {
        concerns.push(concernMap[factor]);
      }
    });

    return concerns;
  }

  /**
   * Generate improvement recommendations
   */
  private generateRecommendations(factors: ScoringFactors, _input: ScoringInput): string[] {
    const recommendations: string[] = [];

    // Analyze low-scoring areas and suggest improvements
    if (factors.techInnovation < 6) {
      recommendations.push('Consider adopting more modern technologies and development practices');
    }
    if (factors.learningSupport < 6) {
      recommendations.push('Invest in professional development programs and learning opportunities');
    }
    if (factors.workFlexibility < 6) {
      recommendations.push('Implement more flexible work arrangements and remote work options');
    }
    if (factors.benefitsQuality < 6) {
      recommendations.push('Enhance the benefits package to be more competitive');
    }
    if (factors.cultureAlignment < 6) {
      recommendations.push('Focus on building a stronger, more inclusive company culture');
    }

    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }

  /**
   * Calculate confidence level based on data completeness and source reliability
   */
  private calculateConfidenceLevel(input: ScoringInput): number {
    let confidence = input.dataCompleteness * 0.7; // Base on data completeness

    // Adjust for source reliability
    confidence += input.sourceReliability * 0.3;

    // Bonus for structured data
    if ((input.technologies || []).length > 0) confidence += 5;
    if ((input.benefits || []).length > 0) confidence += 5;
    if ((input.values || []).length > 0) confidence += 5;

    return Math.min(100, Math.round(confidence));
  }

  /**
   * Get data sources used in scoring
   */
  private getDataSources(input: ScoringInput): string[] {
    const sources = ['structured_extraction'];
    
    if (input.glassdoorRating) sources.push('glassdoor');
    if (input.linkedinFollowers) sources.push('linkedin');
    if (input.githubActivity) sources.push('github');
    
    return sources;
  }

  /**
   * Utility method to calculate average of an array
   */
  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const sum = numbers.reduce((acc, num) => acc + num, 0);
    return sum / numbers.length;
  }
}