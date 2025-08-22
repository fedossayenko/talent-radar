import axios from 'axios'
import { VacancyListResponse, VacancyFilters, Vacancy } from '@/types/vacancy'
import { ScrapingResponse, ScrapingStatsResponse } from '@/types/scraper'
import { 
  CompanyListResponse, 
  CompanyDetailResponse, 
  CompanyInsightsResponse,
  CompanyFilters,
  CompanyAnalysis 
} from '@/types/company'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for logging
apiClient.interceptors.request.use((config) => {
  return config
})

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

// Vacancy API functions
export const vacancyApi = {
  // Get paginated list of vacancies
  getVacancies: async (filters: VacancyFilters = {}): Promise<VacancyListResponse> => {
    const params = new URLSearchParams()
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          // Handle arrays (like technologies)
          params.append(key, value.join(','))
        } else {
          params.append(key, String(value))
        }
      }
    })

    const response = await apiClient.get(`/vacancies?${params.toString()}`)
    return response.data
  },

  // Get single vacancy by ID
  getVacancy: async (id: string): Promise<{ success: boolean; data: Vacancy }> => {
    const response = await apiClient.get(`/vacancies/${id}`)
    return response.data
  },

  // Update vacancy
  updateVacancy: async (id: string, data: Partial<Vacancy>): Promise<{ success: boolean; data: Vacancy }> => {
    const response = await apiClient.put(`/vacancies/${id}`, data)
    return response.data
  },
}

// Scraper API functions
export const scraperApi = {
  // Trigger manual scraping
  triggerManualScraping: async (): Promise<ScrapingResponse> => {
    const response = await apiClient.post('/scraper/dev-bg/manual')
    return response.data
  },

  // Get scraping statistics
  getScrapingStats: async (): Promise<ScrapingStatsResponse> => {
    const response = await apiClient.get('/scraper/stats')
    return response.data
  },
}

// Company API functions
export const companyApi = {
  // Get paginated list of companies
  getCompanies: async (filters: CompanyFilters = {}): Promise<CompanyListResponse> => {
    const params = new URLSearchParams()
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          // Handle arrays
          params.append(key, value.join(','))
        } else {
          params.append(key, String(value))
        }
      }
    })

    const response = await apiClient.get(`/companies?${params.toString()}`)
    return response.data
  },

  // Get single company by ID
  getCompany: async (id: string): Promise<CompanyDetailResponse> => {
    const response = await apiClient.get(`/companies/${id}`)
    return response.data
  },

  // Get company analysis data
  getCompanyAnalysis: async (id: string): Promise<{ success: boolean; data: CompanyAnalysis }> => {
    const response = await apiClient.get(`/companies/${id}/analysis`)
    return response.data
  },

  // Get latest company analysis
  getLatestAnalysis: async (id: string): Promise<{ success: boolean; data: CompanyAnalysis }> => {
    const response = await apiClient.get(`/companies/${id}/analysis/latest`)
    return response.data
  },

  // Get company insights and metrics
  getCompanyInsights: async (id: string): Promise<CompanyInsightsResponse> => {
    const response = await apiClient.get(`/companies/${id}/insights`)
    return response.data
  },

  // Get top-rated companies
  getTopRatedCompanies: async (
    limit: number = 20, 
    metric: string = 'overall'
  ): Promise<CompanyListResponse> => {
    const params = new URLSearchParams({
      limit: String(limit),
      metric,
    })
    
    const response = await apiClient.get(`/companies/top-rated?${params.toString()}`)
    return response.data
  },

  // Update company information
  updateCompany: async (
    id: string, 
    data: Record<string, unknown>
  ): Promise<{ success: boolean; data: CompanyDetailResponse['data'] }> => {
    const response = await apiClient.put(`/companies/${id}`, data)
    return response.data
  },

  // Analyze company with AI
  analyzeCompany: async (
    id: string, 
    options: { forceRefresh?: boolean } = {}
  ): Promise<{ success: boolean; data: CompanyAnalysis }> => {
    const response = await apiClient.post(`/companies/${id}/analyze`, options)
    return response.data
  },
}

export default apiClient