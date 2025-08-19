import { ParsedVacancy } from '@/types/vacancy'
import VacancyCard from './VacancyCard'
import { VacancySkeletonGrid } from './VacancySkeleton'

interface VacancyListProps {
  vacancies: ParsedVacancy[]
  isLoading: boolean
  isError: boolean
  error?: Error | null
  onVacancyClick?: (vacancy: ParsedVacancy) => void
}

export default function VacancyList({
  vacancies,
  isLoading,
  isError,
  error,
  onVacancyClick,
}: VacancyListProps) {
  // Loading state
  if (isLoading) {
    return (
      <div>
        <VacancySkeletonGrid count={6} />
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Failed to load vacancies
          </h3>
          <p className="text-gray-500 mb-4">
            {error?.message || 'An error occurred while fetching vacancy data.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Empty state
  if (!vacancies || vacancies.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No vacancies found
          </h3>
          <p className="text-gray-500 mb-4">
            We couldn't find any job vacancies matching your criteria. Try adjusting your filters or check back later.
          </p>
          <button
            onClick={() => window.location.href = '/vacancies'}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            View All Vacancies
          </button>
        </div>
      </div>
    )
  }

  // Success state - render vacancy grid
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {vacancies.map((vacancy) => (
        <VacancyCard
          key={vacancy.id}
          vacancy={vacancy}
          onClick={onVacancyClick}
        />
      ))}
    </div>
  )
}