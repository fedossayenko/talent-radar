import { useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useVacancies } from '@/hooks/useVacancies'
import { parseVacancy } from '@/lib/utils'
import VacancyList from '@/components/vacancies/VacancyList'
import Pagination from '@/components/common/Pagination'
import { ParsedVacancy } from '@/types/vacancy'

export default function VacanciesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Get URL parameters or defaults
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '20', 10)
  const sortBy = searchParams.get('sortBy') || 'updatedAt'
  const order = (searchParams.get('order') || 'desc') as 'asc' | 'desc'
  
  // Fetch data using the custom hook
  const { 
    data, 
    isLoading, 
    isError, 
    error, 
    isPreviousData 
  } = useVacancies({
    page,
    limit,
    sortBy,
    order,
  })

  // Parse vacancies for display
  const parsedVacancies: ParsedVacancy[] = data?.data.map(parseVacancy) || []
  
  // Handle page change
  const handlePageChange = useCallback((newPage: number) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('page', newPage.toString())
    setSearchParams(newParams)
  }, [searchParams, setSearchParams])

  // Handle page size change
  const handlePageSizeChange = useCallback((newLimit: number) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('limit', newLimit.toString())
    newParams.set('page', '1') // Reset to first page when changing page size
    setSearchParams(newParams)
  }, [searchParams, setSearchParams])

  // Handle vacancy click (future: navigate to detail page)
  const handleVacancyClick = useCallback((vacancy: ParsedVacancy) => {
    console.log('Vacancy clicked:', vacancy)
    // Future: navigate to detail page
    // navigate(`/vacancies/${vacancy.id}`)
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Job Vacancies
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            AI-powered job tracking and analysis
          </p>
        </div>
        
        {/* Stats */}
        <div className="mt-4 sm:mt-0">
          <div className="flex items-center text-sm text-gray-500">
            {isLoading ? (
              <div className="animate-pulse">Loading...</div>
            ) : data ? (
              <div>
                {data.pagination.total} total vacancies
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Filters Section (Future enhancement) */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Sorted by: <span className="font-medium">Updated Date (newest first)</span>
          </div>
          
          {/* Future: Add filter controls here */}
          <div className="text-xs text-gray-400">
            Filters coming soon...
          </div>
        </div>
      </div>

      {/* Loading overlay for pagination transitions */}
      <div className={`transition-opacity duration-200 ${isPreviousData ? 'opacity-50' : 'opacity-100'}`}>
        {/* Vacancy List */}
        <VacancyList
          vacancies={parsedVacancies}
          isLoading={isLoading}
          isError={isError}
          error={error}
          onVacancyClick={handleVacancyClick}
        />
      </div>

      {/* Pagination */}
      {data && data.pagination.pages > 1 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <Pagination
            currentPage={data.pagination.page}
            totalPages={data.pagination.pages}
            onPageChange={handlePageChange}
            pageSize={data.pagination.limit}
            onPageSizeChange={handlePageSizeChange}
            totalItems={data.pagination.total}
            isLoading={isLoading || isPreviousData}
          />
        </div>
      )}
    </div>
  )
}