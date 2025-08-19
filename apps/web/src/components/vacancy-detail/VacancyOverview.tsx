import { ParsedVacancy } from '@/types/vacancy'

interface VacancyOverviewProps {
  vacancy: ParsedVacancy
}

interface OverviewItemProps {
  label: string
  value: string | number | null | undefined
  icon?: string
}

function OverviewItem({ label, value, icon }: OverviewItemProps) {
  if (!value) return null

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className="text-lg">{icon}</span>}
        <dt className="text-sm font-medium text-gray-600">{label}</dt>
      </div>
      <dd className="text-base font-semibold text-gray-900">{value}</dd>
    </div>
  )
}

export default function VacancyOverview({ vacancy }: VacancyOverviewProps) {
  const formatEmploymentType = (type: string | undefined) => {
    if (!type) return null
    return type.replace('_', '-').split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ')
  }

  const formatApplicationDeadline = (deadline: string | undefined) => {
    if (!deadline) return null
    
    try {
      const date = new Date(deadline)
      const today = new Date()
      const diffTime = date.getTime() - today.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays < 0) {
        return 'Expired'
      } else if (diffDays === 0) {
        return 'Today'
      } else if (diffDays === 1) {
        return 'Tomorrow'
      } else if (diffDays <= 7) {
        return `${diffDays} days left`
      } else {
        return date.toLocaleDateString()
      }
    } catch {
      return deadline
    }
  }

  const formatPostedDate = (dateStr: string | undefined) => {
    if (!dateStr) return null
    
    try {
      const date = new Date(dateStr)
      const today = new Date()
      const diffTime = today.getTime() - date.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays === 0) {
        return 'Today'
      } else if (diffDays === 1) {
        return 'Yesterday'
      } else if (diffDays <= 7) {
        return `${diffDays} days ago`
      } else if (diffDays <= 30) {
        const weeks = Math.floor(diffDays / 7)
        return `${weeks} week${weeks === 1 ? '' : 's'} ago`
      } else {
        return date.toLocaleDateString()
      }
    } catch {
      return dateStr
    }
  }

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Overview</h3>
        
        <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <OverviewItem 
            label="Experience Level"
            value={vacancy.experienceLevel?.replace('_', ' ')}
            icon="👔"
          />
          
          <OverviewItem 
            label="Employment Type"
            value={formatEmploymentType(vacancy.employmentType)}
            icon="📄"
          />
          
          <OverviewItem 
            label="Team Size"
            value={vacancy.teamSize}
            icon="👥"
          />
          
          <OverviewItem 
            label="Company Size"
            value={vacancy.companySize}
            icon="🏢"
          />
          
          <OverviewItem 
            label="Industry"
            value={vacancy.industry || vacancy.company.industry}
            icon="🏭"
          />
          
          <OverviewItem 
            label="Education Level"
            value={vacancy.educationLevel}
            icon="🎓"
          />
          
          <OverviewItem 
            label="Posted"
            value={formatPostedDate(vacancy.postedAt)}
            icon="📅"
          />
          
          <OverviewItem 
            label="Application Deadline"
            value={formatApplicationDeadline(vacancy.applicationDeadline)}
            icon="⏰"
          />
          
          <OverviewItem 
            label="Source Site"
            value={vacancy.sourceSite}
            icon="🔗"
          />
        </dl>
      </div>
    </div>
  )
}