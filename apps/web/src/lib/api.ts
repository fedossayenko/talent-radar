import axios from 'axios'
import { VacancyListResponse, VacancyFilters, Vacancy } from '@/types/vacancy'
import { ScrapingResponse, ScrapingStatsResponse } from '@/types/scraper'

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

export default apiClient