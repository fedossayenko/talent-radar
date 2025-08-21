import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { scraperApi } from '@/lib/api'
import { ScrapingStatsResponse, ScrapingResponse } from '@/types/scraper'

export function useScrapingStats() {
  return useQuery<ScrapingStatsResponse, Error>({
    queryKey: ['scraping-stats'],
    queryFn: () => scraperApi.getScrapingStats(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useTriggerScraping() {
  const queryClient = useQueryClient()

  return useMutation<ScrapingResponse, Error>({
    mutationFn: () => scraperApi.triggerManualScraping(),
    onSuccess: () => {
      // Invalidate and refetch scraping stats after successful scraping
      queryClient.invalidateQueries({ queryKey: ['scraping-stats'] })
      // Also invalidate vacancies as new ones might have been scraped
      queryClient.invalidateQueries({ queryKey: ['vacancies'] })
    },
  })
}