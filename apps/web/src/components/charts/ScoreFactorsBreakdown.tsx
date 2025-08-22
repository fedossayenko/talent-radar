import { ScoringFactors } from '@/types/company'
import { getScoreColor } from '@/types/company'

interface ScoreFactorsBreakdownProps {
  factors: ScoringFactors | null
  className?: string
}

interface FactorCategory {
  title: string
  factors: Array<{
    key: keyof ScoringFactors
    label: string
  }>
}

const factorCategories: FactorCategory[] = [
  {
    title: 'Developer Experience',
    factors: [
      { key: 'techInnovation', label: 'Tech Innovation' },
      { key: 'developmentPractices', label: 'Development Practices' },
      { key: 'toolsAndInfrastructure', label: 'Tools & Infrastructure' },
      { key: 'techCultureMaturity', label: 'Tech Culture Maturity' }
    ]
  },
  {
    title: 'Culture & Values',
    factors: [
      { key: 'cultureAlignment', label: 'Culture Alignment' },
      { key: 'workEnvironment', label: 'Work Environment' },
      { key: 'leadership', label: 'Leadership' },
      { key: 'transparency', label: 'Transparency' }
    ]
  },
  {
    title: 'Growth Opportunities',
    factors: [
      { key: 'careerAdvancement', label: 'Career Advancement' },
      { key: 'learningSupport', label: 'Learning Support' },
      { key: 'mentorship', label: 'Mentorship' },
      { key: 'skillDevelopment', label: 'Skill Development' }
    ]
  },
  {
    title: 'Compensation & Benefits',
    factors: [
      { key: 'salaryCompetitiveness', label: 'Salary Competitiveness' },
      { key: 'equityParticipation', label: 'Equity Participation' },
      { key: 'benefitsQuality', label: 'Benefits Quality' },
      { key: 'perksValue', label: 'Perks Value' }
    ]
  },
  {
    title: 'Work-Life Balance',
    factors: [
      { key: 'workFlexibility', label: 'Work Flexibility' },
      { key: 'timeOffPolicy', label: 'Time Off Policy' },
      { key: 'workloadManagement', label: 'Workload Management' },
      { key: 'wellnessSupport', label: 'Wellness Support' }
    ]
  },
  {
    title: 'Company Stability',
    factors: [
      { key: 'financialStability', label: 'Financial Stability' },
      { key: 'marketPosition', label: 'Market Position' },
      { key: 'growthTrajectory', label: 'Growth Trajectory' },
      { key: 'layoffRisk', label: 'Layoff Risk (Inverted)' }
    ]
  }
]

function FactorBar({ value, label }: { value: number; label: string }) {
  const normalizedScore = Math.max(0, Math.min(100, value * 10)) // Convert 0-10 scale to 0-100
  const colorClasses = getScoreColor(normalizedScore)
  
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-medium text-gray-700 flex-1">{label}</span>
      <div className="flex items-center ml-4">
        <div className="w-24 bg-gray-200 rounded-full h-2 mr-3">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              normalizedScore >= 80 ? 'bg-green-500' :
              normalizedScore >= 60 ? 'bg-blue-500' :
              normalizedScore >= 40 ? 'bg-yellow-500' :
              normalizedScore >= 20 ? 'bg-orange-500' : 'bg-red-500'
            }`}
            style={{ width: `${normalizedScore}%` }}
          />
        </div>
        <span className={`text-sm font-semibold min-w-[2rem] text-center px-2 py-1 rounded ${colorClasses}`}>
          {value.toFixed(1)}
        </span>
      </div>
    </div>
  )
}

export function ScoreFactorsBreakdown({ factors, className = '' }: ScoreFactorsBreakdownProps) {
  if (!factors) {
    return (
      <div className={`bg-gray-50 rounded-lg p-6 ${className}`}>
        <p className="text-gray-500 text-center">No detailed scoring factors available</p>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {factorCategories.map((category) => (
        <div key={category.title} className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-100 pb-2">
            {category.title}
          </h3>
          <div className="space-y-1">
            {category.factors.map((factor) => (
              <FactorBar
                key={factor.key}
                value={factors[factor.key] || 0}
                label={factor.label}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}