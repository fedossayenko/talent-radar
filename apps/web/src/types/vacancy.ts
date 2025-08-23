export interface Company {
  id: string
  name: string
  website?: string
  description?: string
  industry?: string
  size?: string
  location?: string
  logo?: string
  founded?: number
}

export interface Vacancy {
  id: string
  title: string
  description?: string
  requirements?: string
  location?: string
  salaryMin?: number
  salaryMax?: number
  currency?: string
  experienceLevel?: string
  employmentType?: string
  workModel?: string
  sourceUrl?: string
  sourceSite?: string
  status: string
  postedAt?: string
  createdAt: string
  updatedAt: string
  
  // AI-specific fields
  extractionConfidence?: number
  qualityScore?: number
  aiExtractedData?: string
  
  // Enhanced fields
  responsibilities?: string
  technologies?: string
  benefits?: string
  educationLevel?: string
  industry?: string
  teamSize?: string
  companySize?: string
  applicationDeadline?: string

  // Relations
  company: Company
}

export interface VacancyListResponse {
  success: boolean
  data: Vacancy[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface VacancyFilters {
  page?: number
  limit?: number
  search?: string
  technologies?: string[]
  location?: string
  experienceLevel?: string
  salaryMin?: number
  salaryMax?: number
  sortBy?: string
  order?: 'asc' | 'desc'
}

// Parsed types for frontend display
export interface ParsedVacancy extends Omit<Vacancy, 'technologies' | 'responsibilities' | 'benefits' | 'requirements'> {
  technologies: string[]
  responsibilities: string[]
  benefits: string[]
  requirements: string[]
  formattedSalary?: string
  relativeTime: string
  qualityLevel: 'high' | 'medium' | 'low'
}