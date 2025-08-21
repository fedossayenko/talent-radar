export interface ScrapingStats {
  totalVacancies: number
  activeVacancies: number
  companiesFromDevBg: number
  lastScrapedAt: string | null
}

export interface ScrapingResponse {
  success: boolean
  message: string
  jobId?: string
}

export interface ScrapingStatsResponse {
  success: boolean
  data: ScrapingStats
}