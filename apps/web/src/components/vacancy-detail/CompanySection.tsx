import { Link } from 'react-router-dom'
import { Company } from '@/types/vacancy'
import { getCompanyInitials } from '@/lib/utils'
import { ArrowTopRightOnSquareIcon, EyeIcon } from '@heroicons/react/24/outline'

interface CompanySectionProps {
  company: Company
}

export default function CompanySection({ company }: CompanySectionProps) {
  return (
    <div className="bg-white border-t border-gray-200">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-xl">🏢</span>
          <h3 className="text-xl font-semibold text-gray-900">About the Company</h3>
        </div>

        <div className="bg-gray-50 rounded-lg p-6">
          {/* Company Header */}
          <div className="flex items-center gap-4 mb-6">
            {/* Company Logo */}
            <div className="flex-shrink-0">
              {company.logo ? (
                <img
                  src={company.logo}
                  alt={`${company.name} logo`}
                  className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    const parent = target.parentElement
                    if (parent) {
                      parent.innerHTML = `
                        <div class="w-16 h-16 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 text-xl font-bold border border-gray-200">
                          ${getCompanyInitials(company.name)}
                        </div>
                      `
                    }
                  }}
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 text-xl font-bold border border-gray-200">
                  {getCompanyInitials(company.name)}
                </div>
              )}
            </div>

            {/* Company Info */}
            <div className="flex-1">
              <h4 className="text-2xl font-bold text-gray-900 mb-2">{company.name}</h4>
              
              {/* Company Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                {company.industry && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Industry:</span>
                    <span className="font-medium text-gray-700">{company.industry}</span>
                  </div>
                )}
                
                {company.size && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Size:</span>
                    <span className="font-medium text-gray-700">{company.size}</span>
                  </div>
                )}
                
                {company.founded && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Founded:</span>
                    <span className="font-medium text-gray-700">{company.founded}</span>
                  </div>
                )}
                
                {company.location && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Location:</span>
                    <span className="font-medium text-gray-700">{company.location}</span>
                  </div>
                )}
              </div>

              {/* Website Link */}
              {company.website && (
                <div className="mt-3">
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors"
                  >
                    {company.website.replace(/^https?:\/\//, '')}
                    <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Company Description */}
          {company.description && (
            <div className="border-t border-gray-200 pt-6">
              <h5 className="font-semibold text-gray-900 mb-3">Company Overview</h5>
              <div className="prose prose-gray max-w-none">
                {company.description.split(/\n\s*\n|\n\n+/).map((paragraph, index) => (
                  <p key={index} className="text-gray-700 leading-relaxed mb-3 last:mb-0">
                    {paragraph.trim()}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Company Stats (if available) */}
          {(company.industry || company.size || company.founded) && (
            <div className="border-t border-gray-200 pt-6 mt-6">
              <h5 className="font-semibold text-gray-900 mb-4">Company Facts</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {company.industry && (
                  <div className="text-center p-3 bg-white rounded-lg border border-gray-200">
                    <div className="text-2xl mb-1">🏭</div>
                    <div className="text-sm text-gray-500">Industry</div>
                    <div className="font-medium text-gray-900">{company.industry}</div>
                  </div>
                )}
                
                {company.size && (
                  <div className="text-center p-3 bg-white rounded-lg border border-gray-200">
                    <div className="text-2xl mb-1">👥</div>
                    <div className="text-sm text-gray-500">Company Size</div>
                    <div className="font-medium text-gray-900">{company.size}</div>
                  </div>
                )}
                
                {company.founded && (
                  <div className="text-center p-3 bg-white rounded-lg border border-gray-200">
                    <div className="text-2xl mb-1">📅</div>
                    <div className="text-sm text-gray-500">Founded</div>
                    <div className="font-medium text-gray-900">{company.founded}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Call to Action */}
        <div className="mt-6 text-center space-y-3">
          {/* View Company Profile */}
          <div>
            <Link
              to={`/companies/${company.id}`}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <EyeIcon className="w-4 h-4 mr-2" />
              View Full Company Profile
            </Link>
          </div>

          {/* Visit Website */}
          {company.website && (
            <div>
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Visit Company Website
                <ArrowTopRightOnSquareIcon className="w-4 h-4 ml-2" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}