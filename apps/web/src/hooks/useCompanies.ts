import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { companyApi } from '@/lib/api'
import { 
  CompanyFilters, 
  CompanyListResponse, 
  CompanyDetailResponse,
  CompanyInsightsResponse 
} from '@/types/company'

// Hook for fetching paginated companies list
export function useCompanies(filters: CompanyFilters = {}) {
  const {
    page = 1,
    limit = 20,
    sortBy = 'overall',
    sortOrder = 'desc',
    hasAnalysis = true, // Default to showing companies with analysis
    ...otherFilters
  } = filters

  return useQuery<CompanyListResponse, Error>({
    queryKey: ['companies', page, limit, sortBy, sortOrder, hasAnalysis, otherFilters],
    queryFn: () => companyApi.getCompanies({
      page,
      limit,
      sortBy,
      sortOrder,
      hasAnalysis,
      ...otherFilters
    }),
    placeholderData: keepPreviousData, // Smooth pagination transitions
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Hook for fetching single company details
export function useCompany(id: string) {
  return useQuery<CompanyDetailResponse, Error>({
    queryKey: ['company', id],
    queryFn: () => companyApi.getCompany(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

// Hook for fetching company analysis
export function useCompanyAnalysis(id: string) {
  return useQuery({
    queryKey: ['company', id, 'analysis'],
    queryFn: () => companyApi.getCompanyAnalysis(id),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // Analysis data is less frequently updated
    gcTime: 30 * 60 * 1000,
  })
}

// Hook for fetching latest company analysis
export function useLatestCompanyAnalysis(id: string) {
  return useQuery({
    queryKey: ['company', id, 'analysis', 'latest'],
    queryFn: () => companyApi.getLatestAnalysis(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })
}

// Hook for fetching company insights
export function useCompanyInsights(id: string) {
  return useQuery<CompanyInsightsResponse, Error>({
    queryKey: ['company', id, 'insights'],
    queryFn: () => companyApi.getCompanyInsights(id),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

// Hook for fetching top-rated companies
export function useTopRatedCompanies(limit: number = 20, metric: string = 'overall') {
  return useQuery<CompanyListResponse, Error>({
    queryKey: ['companies', 'top-rated', limit, metric],
    queryFn: () => companyApi.getTopRatedCompanies(limit, metric),
    staleTime: 15 * 60 * 1000, // Top companies change less frequently
    gcTime: 30 * 60 * 1000,
  })
}

// Mutation hook for updating company
export function useUpdateCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      companyApi.updateCompany(id, data),
    onSuccess: (_, { id }) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['company', id] })
      queryClient.invalidateQueries({ queryKey: ['companies'] })
    },
  })
}

// Mutation hook for analyzing company with AI
export function useAnalyzeCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, options }: { id: string; options?: { forceRefresh?: boolean } }) =>
      companyApi.analyzeCompany(id, options),
    onSuccess: (_, { id }) => {
      // Invalidate all analysis-related queries for this company
      queryClient.invalidateQueries({ queryKey: ['company', id, 'analysis'] })
      queryClient.invalidateQueries({ queryKey: ['company', id, 'insights'] })
      queryClient.invalidateQueries({ queryKey: ['company', id] })
      queryClient.invalidateQueries({ queryKey: ['companies'] })
    },
  })
}

// Hook for companies with filters and search
export function useCompaniesWithSearch(searchTerm: string, filters: Omit<CompanyFilters, 'search'> = {}) {
  const finalFilters = {
    ...filters,
    search: searchTerm.trim() || undefined
  }

  return useCompanies(finalFilters)
}

// Hook for companies by industry
export function useCompaniesByIndustry(industry: string, otherFilters: Omit<CompanyFilters, 'industry'> = {}) {
  return useCompanies({
    ...otherFilters,
    industry: industry || undefined
  })
}

// Hook for companies by size
export function useCompaniesBySize(size: string, otherFilters: Omit<CompanyFilters, 'size'> = {}) {
  return useCompanies({
    ...otherFilters,
    size: size || undefined
  })
}