import { ParsedVacancy } from '@/types/vacancy'
import { getWorkModelClasses, getCompanyInitials, truncateText } from '@/lib/utils'
import { ArrowTopRightOnSquareIcon, ShareIcon } from '@heroicons/react/24/outline'

interface VacancyHeaderProps {
  vacancy: ParsedVacancy
}

export default function VacancyHeader({ vacancy }: VacancyHeaderProps) {
  const handleApply = () => {
    if (vacancy.sourceUrl) {
      window.open(vacancy.sourceUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({
          title: vacancy.title,
          text: `${vacancy.title} at ${vacancy.company.name}`,
          url: url,
        })
      } catch (err) {
        // Fallback to clipboard
        await navigator.clipboard.writeText(url)
        // You could add a toast notification here
      }
    } else {
      // Fallback to clipboard
      await navigator.clipboard.writeText(url)
      // You could add a toast notification here
    }
  }

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Main Header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          {/* Left Side - Job Info */}
          <div className="flex-1">
            {/* Job Title */}
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {vacancy.title}
            </h1>

            {/* Company Info */}
            <div className="flex items-center gap-3 mb-4">
              {/* Company Logo */}
              <div className="flex-shrink-0">
                {vacancy.company.logo ? (
                  <img
                    src={vacancy.company.logo}
                    alt={`${vacancy.company.name} logo`}
                    className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      const parent = target.parentElement
                      if (parent) {
                        parent.innerHTML = `
                          <div class="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 text-lg font-medium border border-gray-200">
                            ${getCompanyInitials(vacancy.company.name)}
                          </div>
                        `
                      }
                    }}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 text-lg font-medium border border-gray-200">
                    {getCompanyInitials(vacancy.company.name)}
                  </div>
                )}
              </div>

              {/* Company Details */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {vacancy.company.name}
                </h2>
                {vacancy.company.website && (
                  <a
                    href={vacancy.company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
                  >
                    {vacancy.company.website.replace(/^https?:\/\//, '')}
                    <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Location and Work Model */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center text-gray-600">
                <span className="text-lg mr-2">📍</span>
                <span className="font-medium">
                  {vacancy.location || 'Location not specified'}
                </span>
              </div>
              
              {vacancy.workModel && (
                <span className={getWorkModelClasses(vacancy.workModel)}>
                  {vacancy.workModel.charAt(0).toUpperCase() + vacancy.workModel.slice(1)}
                </span>
              )}

              {vacancy.experienceLevel && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  {vacancy.experienceLevel.replace('_', ' ')}
                </span>
              )}
            </div>

            {/* Salary */}
            {vacancy.formattedSalary && (
              <div className="flex items-center text-green-700 font-semibold text-lg mb-2">
                <span className="mr-2">💰</span>
                {vacancy.formattedSalary}
              </div>
            )}
          </div>

          {/* Right Side - Action Buttons */}
          <div className="flex flex-col gap-3 lg:min-w-[200px]">
            {/* Apply Button */}
            {vacancy.sourceUrl && (
              <button
                onClick={handleApply}
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Apply Now
                <ArrowTopRightOnSquareIcon className="w-4 h-4 ml-2" />
              </button>
            )}

            {/* Share Button */}
            <button
              onClick={handleShare}
              className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <ShareIcon className="w-4 h-4 mr-2" />
              Share
            </button>
          </div>
        </div>

        {/* Posted Date and Quality Indicator */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
          <div className="text-sm text-gray-500">
            Updated {vacancy.relativeTime}
          </div>
          
          {vacancy.extractionConfidence && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Data quality:</span>
              <div className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${
                  vacancy.qualityLevel === 'high' ? 'bg-green-500' :
                  vacancy.qualityLevel === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                }`}></span>
                <span className={`font-medium ${
                  vacancy.qualityLevel === 'high' ? 'text-green-700' :
                  vacancy.qualityLevel === 'medium' ? 'text-yellow-700' : 'text-red-700'
                }`}>
                  {Math.round(vacancy.extractionConfidence)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}