import { Link } from 'react-router-dom'
import { CompanyWithLatestAnalysis, getScoreColor } from '@/types/company'
import { getCompanyInitials, truncateText } from '@/lib/utils'
import { 
  BuildingOfficeIcon,
  MapPinIcon,
  BriefcaseIcon,
  ArrowTopRightOnSquareIcon,
  SparklesIcon,
  TrophyIcon
} from '@heroicons/react/24/outline'

interface CompanyCardProps {
  company: CompanyWithLatestAnalysis
  onClick?: (company: CompanyWithLatestAnalysis) => void
}

export default function CompanyCard({ company, onClick }: CompanyCardProps) {
  const analysis = company.latestAnalysis
  const overallScore = analysis?.overallScore ?? null
  const scoreColor = getScoreColor(overallScore)

  // Get top strengths for display
  const topStrengths = analysis?.scoreStrengths?.slice(0, 2) || []
  
  // Get category scores for mini chart
  const categoryScores = analysis?.categoryScores
  
  const handleClick = () => {
    if (onClick) {
      onClick(company)
    }
  }

  return (
    <Link 
      to={`/companies/${company.id}`} 
      className="block"
      onClick={handleClick}
    >
      <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg hover:border-blue-300 transition-all duration-200 group cursor-pointer">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Company Logo */}
            <div className="flex-shrink-0">
              {company.logo ? (
                <img
                  src={company.logo}
                  alt={`${company.name} logo`}
                  className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    const parent = target.parentElement
                    if (parent) {
                      parent.innerHTML = `
                        <div class="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 text-lg font-bold border border-gray-200">
                          ${getCompanyInitials(company.name)}
                        </div>
                      `
                    }
                  }}
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 text-lg font-bold border border-gray-200">
                  {getCompanyInitials(company.name)}
                </div>
              )}
            </div>

            {/* Company Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                {truncateText(company.name, 40)}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                {company.industry && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                    {company.industry}
                  </span>
                )}
                {company.size && (
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <BuildingOfficeIcon className="w-3 h-3" />
                    {company.size}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Overall Score Badge */}
          {overallScore !== null && overallScore !== undefined && (
            <div className={`px-3 py-1 rounded-full border text-sm font-medium ${scoreColor}`}>
              {Math.round(overallScore)}/100
            </div>
          )}
        </div>

        {/* Company Description */}
        {company.description && (
          <p className="text-gray-600 text-sm mb-4 line-clamp-2">
            {truncateText(company.description, 120)}
          </p>
        )}

        {/* Top Strengths */}
        {topStrengths.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-1 mb-2">
              <SparklesIcon className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium text-gray-700">Key Strengths</span>
            </div>
            <div className="space-y-1">
              {topStrengths.map((strength, index) => (
                <div key={index} className="text-sm text-gray-600 flex items-start gap-1">
                  <span className="text-green-500 font-medium">•</span>
                  {truncateText(strength, 60)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category Scores Mini Chart */}
        {categoryScores && (
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Score Breakdown</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-gray-500">Tech</div>
                <div className="font-medium text-blue-600">
                  {Math.round(categoryScores.developerExperience * 10)}/10
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-500">Culture</div>
                <div className="font-medium text-purple-600">
                  {Math.round(categoryScores.cultureAndValues * 10)}/10
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-500">Growth</div>
                <div className="font-medium text-green-600">
                  {Math.round(categoryScores.growthOpportunities * 10)}/10
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Row: Location, Vacancies, Website */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-4">
            {company.location && (
              <div className="flex items-center gap-1">
                <MapPinIcon className="w-4 h-4" />
                {truncateText(company.location, 20)}
              </div>
            )}
            
            {company.activeVacanciesCount > 0 && (
              <div className="flex items-center gap-1 text-green-600">
                <BriefcaseIcon className="w-4 h-4" />
                {company.activeVacanciesCount} opening{company.activeVacanciesCount !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Industry Ranking */}
          {analysis?.industryPercentile && analysis.industryPercentile >= 75 && (
            <div className="flex items-center gap-1 text-yellow-600">
              <TrophyIcon className="w-4 h-4" />
              <span className="text-xs">Top {Math.round(100 - analysis.industryPercentile)}%</span>
            </div>
          )}

          {/* Website Link */}
          {company.website && (
            <div className="flex items-center gap-1 text-blue-600 hover:text-blue-700">
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              <span className="text-xs">Visit</span>
            </div>
          )}
        </div>

        {/* Analysis Status */}
        {!company.hasAnalysis && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-400 text-center">
              Analysis pending - basic info only
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}