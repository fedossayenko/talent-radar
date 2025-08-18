import { useQuery } from '@tanstack/react-query'
import { vacancyApi } from '@/lib/api'
import { VacancyFilters, VacancyListResponse } from '@/types/vacancy'

export function useVacancies(filters: VacancyFilters = {}) {
  const {
    page = 1,
    limit = 20,
    sortBy = 'updatedAt',
    order = 'desc',
    ...otherFilters
  } = filters

  return useQuery<VacancyListResponse, Error>({
    queryKey: ['vacancies', page, limit, sortBy, order, otherFilters],
    queryFn: () => vacancyApi.getVacancies({
      page,
      limit,
      sortBy,
      order,
      ...otherFilters
    }),
    keepPreviousData: true, // Smooth pagination transitions
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  })
}

export function useVacancy(id: string) {
  return useQuery({
    queryKey: ['vacancy', id],
    queryFn: () => vacancyApi.getVacancy(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}