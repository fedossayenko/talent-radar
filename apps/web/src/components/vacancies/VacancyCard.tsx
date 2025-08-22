import { Link } from 'react-router-dom'
import { ParsedVacancy } from '@/types/vacancy'
import { 
  getWorkModelClasses, 
  getQualityClasses, 
  truncateText, 
  getCompanyInitials 
} from '@/lib/utils'

interface VacancyCardProps {
  vacancy: ParsedVacancy
  onClick?: (vacancy: ParsedVacancy) => void
}

export default function VacancyCard({ vacancy, onClick }: VacancyCardProps) {
  const handleClick = () => {
    if (onClick) {
      onClick(vacancy)
    }
  }

  return (
    <div className="vacancy-card" onClick={handleClick}>
      {/* Header: Title and Company */}
      <div className="mb-4">
        <h3 className="vacancy-title">
          {truncateText(vacancy.title, 60)}
        </h3>
        <Link 
          to={`/companies/${vacancy.company.id}`}
          className="company-info hover:text-blue-600 transition-colors"
          onClick={(e) => e.stopPropagation()} // Prevent triggering parent vacancy click
        >
          {/* Company Logo or Initials */}
          <div className="flex-shrink-0">
            {vacancy.company.logo ? (
              <img
                src={vacancy.company.logo}
                alt={`${vacancy.company.name} logo`}
                className="w-8 h-8 rounded-full object-cover"
                onError={(e) => {
                  // Fallback to initials if image fails to load
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  const parent = target.parentElement
                  if (parent) {
                    parent.innerHTML = `
                      <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-medium">
                        ${getCompanyInitials(vacancy.company.name)}
                      </div>
                    `
                  }
                }}
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-medium">
                {getCompanyInitials(vacancy.company.name)}
              </div>
            )}
          </div>
          <span className="company-name">
            {truncateText(vacancy.company.name, 30)}
          </span>
        </Link>
      </div>

      {/* Location and Work Model */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm text-gray-600">
          📍 {vacancy.location || 'Location not specified'}
        </span>
        {vacancy.workModel && (
          <span className={getWorkModelClasses(vacancy.workModel)}>
            {vacancy.workModel.charAt(0).toUpperCase() + vacancy.workModel.slice(1)}
          </span>
        )}
      </div>

      {/* Salary */}
      {vacancy.formattedSalary && (
        <div className="salary-info">
          💰 {vacancy.formattedSalary}
        </div>
      )}

      {/* Technologies (max 5) */}
      {vacancy.technologies.length > 0 && (
        <div className="tech-tags">
          {vacancy.technologies.slice(0, 5).map((tech, index) => (
            <span key={index} className="tech-tag">
              {tech}
            </span>
          ))}
          {vacancy.technologies.length > 5 && (
            <span className="tech-tag bg-gray-100 text-gray-600">
              +{vacancy.technologies.length - 5} more
            </span>
          )}
        </div>
      )}

      {/* Footer: Time and Quality */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
        <div className="text-xs text-gray-500">
          Updated {vacancy.relativeTime}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Experience Level */}
          {vacancy.experienceLevel && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
              {vacancy.experienceLevel.replace('_', ' ')}
            </span>
          )}
          
          {/* AI Quality Indicator */}
          {vacancy.extractionConfidence && (
            <div className={getQualityClasses(vacancy.qualityLevel)}>
              <span className="w-2 h-2 rounded-full bg-current"></span>
              <span>{Math.round(vacancy.extractionConfidence)}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}