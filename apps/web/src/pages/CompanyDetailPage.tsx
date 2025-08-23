import { useParams } from 'react-router-dom'
import { useCompany } from '@/hooks/useCompanies'
import { getCompanyInitials } from '@/lib/utils'
import { getScoreColor } from '@/types/company'
import { ScoreRadarChart } from '@/components/charts/ScoreRadarChart'
import { ScoreFactorsBreakdown } from '@/components/charts/ScoreFactorsBreakdown'
import { 
  ArrowTopRightOnSquareIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  CalendarIcon,
  UsersIcon,
  GlobeAltIcon,
  BriefcaseIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  TrophyIcon,
  ArrowLeftIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: companyData, isLoading, error } = useCompany(id!)

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          {/* Header Skeleton */}
          <div className="bg-white rounded-lg p-8 mb-8">
            <div className="flex items-center gap-6 mb-6">
              <div className="w-20 h-20 bg-gray-200 rounded-lg"></div>
              <div className="flex-1">
                <div className="h-8 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
              <div className="w-20 h-12 bg-gray-200 rounded"></div>
            </div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>

          {/* Content Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="bg-white rounded-lg p-6">
                  <div className="h-6 bg-gray-200 rounded mb-4"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-4/5"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/5"></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-6">
              <div className="bg-white rounded-lg p-6">
                <div className="h-6 bg-gray-200 rounded mb-4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !companyData?.data) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <BuildingOfficeIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Company not found</h3>
          <p className="text-gray-500 mb-4">
            The company you're looking for doesn't exist or has been removed.
          </p>
          <Link 
            to="/companies"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Companies
          </Link>
        </div>
      </div>
    )
  }

  const company = companyData.data
  const analysis = company.latestAnalysis
  const overallScore = analysis?.overallScore ?? null
  const scoreColor = getScoreColor(overallScore)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link 
          to="/companies"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Companies
        </Link>
      </div>

      {/* Hero Section */}
      <div className="bg-white rounded-lg shadow-sm border p-8 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-6">
            {/* Company Logo */}
            <div className="flex-shrink-0">
              {company.logo ? (
                <img
                  src={company.logo}
                  alt={`${company.name} logo`}
                  className="w-20 h-20 rounded-lg object-cover border border-gray-200"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    const parent = target.parentElement
                    if (parent) {
                      parent.innerHTML = `
                        <div class="w-20 h-20 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 text-2xl font-bold border border-gray-200">
                          ${getCompanyInitials(company.name)}
                        </div>
                      `
                    }
                  }}
                />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 text-2xl font-bold border border-gray-200">
                  {getCompanyInitials(company.name)}
                </div>
              )}
            </div>

            {/* Company Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{company.name}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                {company.industry && (
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                    {company.industry}
                  </span>
                )}
                {company.size && (
                  <div className="flex items-center gap-1">
                    <UsersIcon className="w-4 h-4" />
                    {company.size}
                  </div>
                )}
                {company.location && (
                  <div className="flex items-center gap-1">
                    <MapPinIcon className="w-4 h-4" />
                    {company.location}
                  </div>
                )}
                {company.founded && (
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="w-4 h-4" />
                    Founded {company.founded}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Score and Actions */}
          <div className="flex flex-col items-center gap-4">
            {/* Overall Score */}
            {overallScore !== null && overallScore !== undefined && (
              <div className="text-center">
                <div className={`inline-flex items-center px-6 py-3 rounded-full border text-lg font-bold ${scoreColor}`}>
                  {Math.round(overallScore)}/100
                </div>
                <div className="text-sm text-gray-500 mt-1">Overall Score</div>
                {analysis?.industryPercentile && (
                  <div className="text-xs text-gray-400">
                    Top {Math.round(100 - analysis.industryPercentile)}% in {company.industry}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              {company.activeVacanciesCount > 0 && (
                <Link
                  to={`/vacancies?company=${company.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <BriefcaseIcon className="w-4 h-4" />
                  View {company.activeVacanciesCount} Opening{company.activeVacanciesCount !== 1 ? 's' : ''}
                </Link>
              )}
              
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <GlobeAltIcon className="w-4 h-4" />
                  Visit Website
                  <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Company Description */}
        {company.description && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-gray-700 leading-relaxed">
              {company.description}
            </p>
          </div>
        )}

        {/* Salary Range */}
        {company.salaryRange && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-600 font-semibold">💰 Salary Range</span>
              </div>
              <div className="text-2xl font-bold text-green-700">
                {company.salaryRange.min?.toLocaleString()} - {company.salaryRange.max?.toLocaleString()} {company.salaryRange.currency}
              </div>
              <div className="text-sm text-gray-600">Monthly (based on current openings)</div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Score Dashboard */}
          {analysis?.categoryScores && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center gap-2 mb-6">
                <TrophyIcon className="w-5 h-5 text-yellow-500" />
                <h2 className="text-xl font-semibold text-gray-900">Performance Scores</h2>
              </div>
              
              {/* Radar Chart */}
              <div className="mb-8">
                <ScoreRadarChart categoryScores={analysis.categoryScores} />
              </div>
              
              {/* Category Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(analysis.categoryScores).map(([category, score]) => {
                  const categoryNames = {
                    developerExperience: 'Developer Experience',
                    cultureAndValues: 'Culture & Values',
                    growthOpportunities: 'Growth Opportunities',
                    compensationBenefits: 'Compensation & Benefits',
                    workLifeBalance: 'Work-Life Balance',
                    companyStability: 'Company Stability'
                  }
                  
                  const colors = {
                    developerExperience: 'bg-blue-500',
                    cultureAndValues: 'bg-purple-500',
                    growthOpportunities: 'bg-green-500',
                    compensationBenefits: 'bg-yellow-500',
                    workLifeBalance: 'bg-pink-500',
                    companyStability: 'bg-gray-500'
                  }

                  const normalizedScore = Math.round(score) // Scores are already 0-100
                  
                  return (
                    <div key={category} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          {categoryNames[category as keyof typeof categoryNames]}
                        </span>
                        <span className="text-lg font-bold text-gray-900">
                          {normalizedScore}/100
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${colors[category as keyof typeof colors]}`}
                          style={{ width: `${normalizedScore}%` }}
                        ></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Detailed Score Factors */}
          {analysis?.scoringFactors && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center gap-2 mb-6">
                <ChartBarIcon className="w-5 h-5 text-blue-500" />
                <h2 className="text-xl font-semibold text-gray-900">Detailed Score Breakdown</h2>
                <span className="text-sm text-gray-500 ml-2">24 individual factors</span>
              </div>
              
              <ScoreFactorsBreakdown factors={analysis.scoringFactors} />
            </div>
          )}

          {/* Strengths */}
          {analysis?.scoreStrengths && Array.isArray(analysis.scoreStrengths) && analysis.scoreStrengths.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center gap-2 mb-4">
                <SparklesIcon className="w-5 h-5 text-green-500" />
                <h2 className="text-xl font-semibold text-gray-900">Key Strengths</h2>
              </div>
              <div className="space-y-3">
                {analysis.scoreStrengths.map((strength, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full mt-2"></span>
                    <p className="text-gray-700">{strength}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Areas for Improvement */}
          {analysis?.scoreConcerns && Array.isArray(analysis.scoreConcerns) && analysis.scoreConcerns.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center gap-2 mb-4">
                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />
                <h2 className="text-xl font-semibold text-gray-900">Areas for Improvement</h2>
              </div>
              <div className="space-y-3">
                {analysis.scoreConcerns.map((concern, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-2 h-2 bg-yellow-500 rounded-full mt-2"></span>
                    <p className="text-gray-700">{concern}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {analysis?.scoreRecommendations && Array.isArray(analysis.scoreRecommendations) && analysis.scoreRecommendations.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center gap-2 mb-4">
                <LightBulbIcon className="w-5 h-5 text-blue-500" />
                <h2 className="text-xl font-semibold text-gray-900">Recommendations</h2>
              </div>
              <div className="space-y-3">
                {analysis.scoreRecommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></span>
                    <p className="text-gray-700">{recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tech Stack */}
          {analysis?.techStack && Array.isArray(analysis.techStack) && analysis.techStack.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Technology Stack</h2>
              <div className="flex flex-wrap gap-2">
                {analysis.techStack.map((tech, index) => (
                  <span 
                    key={index}
                    className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full border"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Benefits from Analysis */}
          {analysis?.benefits && Array.isArray(analysis.benefits) && analysis.benefits.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Benefits & Perks</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {analysis.benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="flex-shrink-0 text-green-500 font-bold">✓</span>
                    <span className="text-gray-700 text-sm">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Job Benefits & Requirements from Current Vacancies */}
          {company.vacancies && company.vacancies.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Job Openings</h2>
              {company.vacancies.map((vacancy) => (
                <div key={vacancy.id} className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-gray-900">{vacancy.title}</h3>
                    {(vacancy.salaryMin || vacancy.salaryMax) && (
                      <div className="text-right">
                        <div className="text-green-600 font-semibold">
                          {vacancy.salaryMin && vacancy.salaryMax 
                            ? `${vacancy.salaryMin.toLocaleString()} - ${vacancy.salaryMax.toLocaleString()}`
                            : vacancy.salaryMax 
                              ? `up to ${vacancy.salaryMax.toLocaleString()}`
                              : `from ${vacancy.salaryMin?.toLocaleString()}`
                          } {vacancy.currency || 'BGN'}
                        </div>
                        <div className="text-xs text-gray-500">Monthly</div>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {vacancy.requirements && vacancy.requirements.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Requirements</h4>
                        <div className="space-y-1">
                          {vacancy.requirements.slice(0, 3).map((req: string, reqIndex: number) => (
                            <div key={reqIndex} className="flex items-start gap-2">
                              <span className="text-blue-500 text-xs mt-1">▪</span>
                              <span className="text-gray-600 text-sm">{req}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {vacancy.benefits && vacancy.benefits.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Benefits</h4>
                        <div className="space-y-1">
                          {vacancy.benefits.slice(0, 3).map((benefit: string, benefitIndex: number) => (
                            <div key={benefitIndex} className="flex items-start gap-2">
                              <span className="text-green-500 text-xs mt-1">✓</span>
                              <span className="text-gray-600 text-sm">{benefit}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Company Facts */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Company Facts</h3>
            <div className="space-y-3">
              {company.employeeCount && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Employees</span>
                  <span className="font-medium">{company.employeeCount.toLocaleString()}</span>
                </div>
              )}
              
              {company.founded && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Founded</span>
                  <span className="font-medium">{company.founded}</span>
                </div>
              )}
              
              {company.industry && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Industry</span>
                  <span className="font-medium">{company.industry}</span>
                </div>
              )}
              
              {company.size && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Size</span>
                  <span className="font-medium">{company.size}</span>
                </div>
              )}

              {company.activeVacanciesCount !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Open Positions</span>
                  <span className="font-medium text-green-600">{company.activeVacanciesCount}</span>
                </div>
              )}
            </div>
          </div>

          {/* Contact Information */}
          {company.contactInfo && (company.contactInfo.phone || company.contactInfo.email || company.contactInfo.address) && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
              <div className="space-y-3">
                {company.contactInfo.phone && (
                  <div className="flex items-center gap-3">
                    <span className="text-blue-500">📞</span>
                    <a
                      href={`tel:${company.contactInfo.phone}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {company.contactInfo.phone}
                    </a>
                  </div>
                )}
                {company.contactInfo.email && (
                  <div className="flex items-center gap-3">
                    <span className="text-blue-500">✉️</span>
                    <a
                      href={`mailto:${company.contactInfo.email}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {company.contactInfo.email}
                    </a>
                  </div>
                )}
                {company.contactInfo.address && (
                  <div className="flex items-start gap-3">
                    <span className="text-blue-500 mt-1">📍</span>
                    <span className="text-gray-700">{company.contactInfo.address}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Company Type & Services */}
          {company.companyDetails && (company.companyDetails.companyType || company.companyDetails.services) && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Company Details</h3>
              <div className="space-y-3">
                {company.companyDetails.companyType && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type</span>
                    <span className="font-medium capitalize">{company.companyDetails.companyType}</span>
                  </div>
                )}
                {company.companyDetails.services && company.companyDetails.services.length > 0 && (
                  <div>
                    <span className="text-gray-600 block mb-2">Services</span>
                    <div className="flex flex-wrap gap-1">
                      {company.companyDetails.services.map((service: string, index: number) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                        >
                          {service}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {company.companyDetails.businessLicense && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">License</span>
                    <span className="font-medium">#{company.companyDetails.businessLicense}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* External Links */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Links</h3>
            <div className="space-y-3">
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <GlobeAltIcon className="w-4 h-4 text-gray-600" />
                    <span className="text-gray-700">Website</span>
                  </div>
                  <ArrowTopRightOnSquareIcon className="w-4 h-4 text-gray-400" />
                </a>
              )}

              {company.linkedinUrl && (
                <a
                  href={company.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 text-blue-600">💼</span>
                    <span className="text-gray-700">LinkedIn</span>
                  </div>
                  <ArrowTopRightOnSquareIcon className="w-4 h-4 text-gray-400" />
                </a>
              )}

              {company.githubUrl && (
                <a
                  href={company.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4">💻</span>
                    <span className="text-gray-700">GitHub</span>
                  </div>
                  <ArrowTopRightOnSquareIcon className="w-4 h-4 text-gray-400" />
                </a>
              )}
            </div>
          </div>

          {/* Analysis Meta */}
          {analysis && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Info</h3>
              <div className="space-y-3 text-sm">
                {analysis.confidenceScore && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Confidence</span>
                    <span className="font-medium">{Math.round(analysis.confidenceScore)}%</span>
                  </div>
                )}
                
                {analysis.dataCompleteness && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Data Quality</span>
                    <span className="font-medium">{Math.round(analysis.dataCompleteness)}%</span>
                  </div>
                )}
                
                {analysis.updatedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Updated</span>
                    <span className="font-medium">
                      {new Date(analysis.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}