import { useScrapingStats, useTriggerScraping } from '@/hooks/useScrapingOperations'
import { ArrowPathIcon, ChartBarIcon } from '@heroicons/react/24/outline'

export default function AdminPage() {
  const { data: statsData, isLoading: isStatsLoading, isError: isStatsError, error: statsError } = useScrapingStats()
  const { mutate: triggerScraping, isPending: isScrapingPending, isError: isScrapingError, error: scrapingError, isSuccess: isScrapingSuccess } = useTriggerScraping()

  const handleTriggerScraping = () => {
    triggerScraping()
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Admin Panel
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage scraping and system operations
          </p>
        </div>
      </div>

      {/* Statistics Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <ChartBarIcon className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Scraping Statistics</h2>
        </div>

        {isStatsLoading ? (
          <div className="animate-pulse">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : isStatsError ? (
          <div className="text-red-600">
            Error loading statistics: {statsError?.message}
          </div>
        ) : statsData?.data ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-900">
                {statsData.data.totalVacancies}
              </div>
              <div className="text-sm text-blue-700">Total Vacancies</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-900">
                {statsData.data.activeVacancies}
              </div>
              <div className="text-sm text-green-700">Active Vacancies</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-900">
                {statsData.data.companiesFromDevBg}
              </div>
              <div className="text-sm text-purple-700">Companies</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm font-bold text-gray-900">
                {formatDate(statsData.data.lastScrapedAt)}
              </div>
              <div className="text-sm text-gray-700">Last Scraped</div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Manual Scraping Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <ArrowPathIcon className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Manual Scraping</h2>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Trigger manual scraping of job vacancies from dev.bg. This will process all available vacancies with AI extraction enabled.
          </p>

          {/* Success Message */}
          {isScrapingSuccess && (
            <div className="rounded-lg bg-green-50 p-4">
              <div className="text-sm text-green-700">
                Scraping job triggered successfully! Statistics will update automatically once the job completes.
              </div>
            </div>
          )}

          {/* Error Message */}
          {isScrapingError && (
            <div className="rounded-lg bg-red-50 p-4">
              <div className="text-sm text-red-700">
                Failed to trigger scraping: {scrapingError?.message}
              </div>
            </div>
          )}

          {/* Trigger Button */}
          <div>
            <button
              onClick={handleTriggerScraping}
              disabled={isScrapingPending}
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isScrapingPending ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                  Triggering Scraping...
                </>
              ) : (
                <>
                  <ArrowPathIcon className="w-4 h-4 mr-2" />
                  Trigger Scraping
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}