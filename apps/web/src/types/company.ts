import { ParsedVacancy } from './vacancy'

// Company scoring and analysis types
export interface ScoringFactors {
  // Developer Experience (0-10)
  techInnovation: number
  developmentPractices: number
  toolsAndInfrastructure: number
  techCultureMaturity: number
  
  // Culture & Values (0-10)
  cultureAlignment: number
  workEnvironment: number
  leadership: number
  transparency: number
  
  // Growth Opportunities (0-10)
  careerAdvancement: number
  learningSupport: number
  mentorship: number
  skillDevelopment: number
  
  // Compensation & Benefits (0-10)
  salaryCompetitiveness: number
  equityParticipation: number
  benefitsQuality: number
  perksValue: number
  
  // Work-Life Balance (0-10)
  workFlexibility: number
  timeOffPolicy: number
  workloadManagement: number
  wellnessSupport: number
  
  // Company Stability (0-10)
  financialStability: number
  marketPosition: number
  growthTrajectory: number
  layoffRisk: number
}

export interface CompanyScore {
  overallScore: number
  factors: ScoringFactors
  categories: {
    developerExperience: number
    cultureAndValues: number
    growthOpportunities: number
    compensationBenefits: number
    workLifeBalance: number
    companyStability: number
  }
  scoringMetadata: {
    version: string
    scoredAt: string
    dataSourcesUsed: string[]
    confidenceLevel: number
    dataCompleteness: number
    industryContext: string
    companySize: string
  }
  strengths: string[]
  concerns: string[]
  recommendations: string[]
  industryPercentile: number
  sizePercentile: number
}

export interface CompanyAnalysis {
  id: string
  companyId: string
  sourceSite: string | null
  
  // Legacy scoring
  cultureScore: number | null
  retentionRate: number | null
  workLifeBalance: number | null
  careerGrowth: number | null
  salaryCompetitiveness: number | null
  benefitsScore: number | null
  techCulture: number | null
  
  // Modern scoring
  overallScore: number | null
  scoringFactors: ScoringFactors | null
  categoryScores: CompanyScore['categories'] | null
  industryPercentile: number | null
  sizePercentile: number | null
  scoringMetadata: CompanyScore['scoringMetadata'] | null
  scoreStrengths: string[] | null
  scoreConcerns: string[] | null
  scoreRecommendations: string[] | null
  scoreCalculatedAt: string | null
  
  // Detailed analysis
  pros: string[] | null
  cons: string[] | null
  hiringProcess: string | null
  techStack: string[] | null
  benefits: string[] | null
  interviewProcess: string | null
  growthOpportunities: string[] | null
  companyValues: string[] | null
  workEnvironment: string | null
  
  // Meta
  analysisSource: string
  confidenceScore: number | null
  dataCompleteness: number | null
  recommendationScore: number | null
  rawData: Record<string, unknown> | null
  sourceDataSummary: string | null
  createdAt: string
  updatedAt: string
}

export interface SalaryRange {
  min?: number
  max?: number
  currency?: string
}

export interface ContactInfo {
  phone?: string | null
  email?: string | null
  address?: string | null
}

export interface CompanyDetails {
  companyType?: string | null
  services?: string[] | null
  businessLicense?: string | null
}

export interface Company {
  id: string
  name: string
  website: string | null
  originalWebsite: string | null
  description: string | null
  industry: string | null
  size: string | null
  location: string | null
  logo: string | null
  founded: number | null
  linkedinUrl: string | null
  githubUrl: string | null
  employeeCount: number | null
  lastAnalyzedAt: string | null
  createdAt: string
  updatedAt: string
  
  // Relations
  analyses?: CompanyAnalysis[]
  _count?: {
    vacancies: number
  }
}

export interface CompanyWithLatestAnalysis extends Company {
  latestAnalysis: CompanyAnalysis | null
  activeVacanciesCount: number
  hasAnalysis: boolean
  
  // Additional properties for detailed company view
  salaryRange?: SalaryRange | null
  vacancies?: ParsedVacancy[] | null
  contactInfo?: ContactInfo | null
  companyDetails?: CompanyDetails | null
}

export interface CompanyFilters {
  page?: number
  limit?: number
  search?: string
  industry?: string
  size?: string
  sortBy?: 'name' | 'overall' | 'culture' | 'workLife' | 'career' | 'tech' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
  hasAnalysis?: boolean
  minScore?: number
  maxScore?: number
  hasActiveVacancies?: boolean
}

export interface CompanyListResponse {
  success: boolean
  data: CompanyWithLatestAnalysis[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface CompanyDetailResponse {
  success: boolean
  data: CompanyWithLatestAnalysis
}

export interface CompanyInsights {
  summary: {
    overallScore: number | null
    industryRank: string
    sizeRank: string
    keyStrengths: string[]
    mainConcerns: string[]
  }
  metrics: {
    totalVacancies: number
    activeVacancies: number
    avgSalary: number | null
    topTechnologies: string[]
    workModels: string[]
  }
  trends: {
    scoreImprovement: 'improving' | 'declining' | 'stable' | 'unknown'
    hiringTrend: 'increasing' | 'decreasing' | 'stable' | 'unknown'
  }
}

export interface CompanyInsightsResponse {
  success: boolean
  data: CompanyInsights
}

// Utility types for UI
export type ScoreLevel = 'excellent' | 'good' | 'average' | 'below-average' | 'poor'
export type CompanySize = 'startup' | 'small' | 'medium' | 'large' | 'enterprise'
export type SortField = CompanyFilters['sortBy']

// Helper for parsing company size
export const parseCompanySize = (size: string | null): CompanySize => {
  if (!size) return 'startup'
  const sizeStr = size.toLowerCase()
  if (sizeStr.includes('1-10') || sizeStr.includes('startup')) return 'startup'
  if (sizeStr.includes('11-50') || sizeStr.includes('small')) return 'small'
  if (sizeStr.includes('51-200') || sizeStr.includes('medium')) return 'medium'
  if (sizeStr.includes('201-1000') || sizeStr.includes('large')) return 'large'
  return 'enterprise'
}

// Helper for score level classification
export const getScoreLevel = (score: number | null): ScoreLevel => {
  if (score === null || score === undefined) return 'poor'
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'average'
  if (score >= 20) return 'below-average'
  return 'poor'
}

// Helper for score colors
export const getScoreColor = (score: number | null): string => {
  const level = getScoreLevel(score)
  switch (level) {
    case 'excellent': return 'text-green-600 bg-green-50 border-green-200'
    case 'good': return 'text-blue-600 bg-blue-50 border-blue-200'
    case 'average': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    case 'below-average': return 'text-orange-600 bg-orange-50 border-orange-200'
    case 'poor': return 'text-red-600 bg-red-50 border-red-200'
  }
}