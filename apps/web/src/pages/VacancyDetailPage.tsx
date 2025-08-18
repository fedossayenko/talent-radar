import { useParams, useNavigate, Link } from 'react-router-dom'
import { useVacancy } from '@/hooks/useVacancies'
import { parseVacancy } from '@/lib/utils'
import VacancyHeader from '@/components/vacancy-detail/VacancyHeader'
import VacancyOverview from '@/components/vacancy-detail/VacancyOverview'
import VacancyContent from '@/components/vacancy-detail/VacancyContent'
import TechnologyStack from '@/components/vacancy-detail/TechnologyStack'
import CompanySection from '@/components/vacancy-detail/CompanySection'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useEffect } from 'react'

export default function VacancyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, isLoading, isError, error } = useVacancy(id!)

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Handle invalid ID
  if (!id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid Vacancy ID</h1>
          <Link
            to="/vacancies"
            className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back to Vacancies
          </Link>
        </div>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header Skeleton */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <div className="animate-pulse">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-6 h-6 bg-gray-200 rounded"></div>
                <div className="w-24 h-6 bg-gray-200 rounded"></div>
              </div>
              
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div className="flex-1">
                  <div className="w-3/4 h-8 bg-gray-200 rounded mb-4"></div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="w-48 h-6 bg-gray-200 rounded mb-2"></div>
                      <div className="w-32 h-4 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                  <div className="flex gap-3 mb-4">
                    <div className="w-32 h-6 bg-gray-200 rounded"></div>
                    <div className="w-20 h-6 bg-gray-200 rounded"></div>
                  </div>
                </div>
                <div className="flex flex-col gap-3 lg:min-w-[200px]">
                  <div className="w-full h-12 bg-gray-200 rounded-lg"></div>
                  <div className="w-full h-12 bg-gray-200 rounded-lg"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-8">
            <div className="bg-gray-200 h-32 rounded-lg"></div>
            <div className="bg-gray-200 h-48 rounded-lg"></div>
            <div className="bg-gray-200 h-32 rounded-lg"></div>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Vacancy Not Found</h1>
          <p className="text-gray-500 mb-6">
            {error?.message || 'The vacancy you\'re looking for doesn\'t exist or has been removed.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Go Back
            </button>
            <Link
              to="/vacancies"
              className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              Browse All Vacancies
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Success state
  if (data?.success && data.data) {
    const parsedVacancy = parseVacancy(data.data)

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Breadcrumb Navigation */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <nav className="flex items-center space-x-2 text-sm">
              <Link 
                to="/vacancies" 
                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Back to Vacancies
              </Link>
              <span className="text-gray-500">/</span>
              <span className="text-gray-700 truncate max-w-md">{parsedVacancy.title}</span>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-0">
          <VacancyHeader vacancy={parsedVacancy} />
          <VacancyOverview vacancy={parsedVacancy} />
          <VacancyContent vacancy={parsedVacancy} />
          <TechnologyStack vacancy={parsedVacancy} />
          <CompanySection company={parsedVacancy.company} />
        </div>

        {/* Sticky Apply Button (Mobile) */}
        {parsedVacancy.sourceUrl && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 lg:hidden">
            <div className="max-w-sm mx-auto">
              <a
                href={parsedVacancy.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Apply Now
              </a>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Fallback (shouldn't reach here)
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Something went wrong</h1>
        <Link
          to="/vacancies"
          className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Vacancies
        </Link>
      </div>
    </div>
  )
}