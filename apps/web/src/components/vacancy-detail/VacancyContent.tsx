import { ParsedVacancy } from '@/types/vacancy'

interface VacancyContentProps {
  vacancy: ParsedVacancy
}

interface ContentSectionProps {
  title: string
  content: string | string[] | null | undefined
  icon?: string
}

function ContentSection({ title, content, icon }: ContentSectionProps) {
  if (!content || (Array.isArray(content) && content.length === 0)) return null

  const renderContent = () => {
    if (typeof content === 'string') {
      // Split by common delimiters and create paragraphs
      const paragraphs = content.split(/\n\s*\n|\n\n+/).filter(p => p.trim().length > 0)
      
      return (
        <div className="prose prose-gray max-w-none">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="mb-4 last:mb-0 text-gray-700 leading-relaxed">
              {paragraph.trim()}
            </p>
          ))}
        </div>
      )
    }

    if (Array.isArray(content)) {
      return (
        <ul className="space-y-2">
          {content.map((item, index) => (
            <li key={index} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-1.5 h-1.5 bg-blue-600 rounded-full mt-2"></span>
              <span className="text-gray-700 leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      )
    }

    return null
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        {icon && <span className="text-xl">{icon}</span>}
        <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="ml-8">
        {renderContent()}
      </div>
    </div>
  )
}

export default function VacancyContent({ vacancy }: VacancyContentProps) {
  return (
    <div className="bg-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <ContentSection
          title="Job Description"
          content={vacancy.description}
          icon="📋"
        />

        <ContentSection
          title="Key Responsibilities"
          content={vacancy.responsibilities}
          icon="⚡"
        />

        <ContentSection
          title="Requirements"
          content={vacancy.requirements}
          icon="✅"
        />

        {/* Benefits */}
        {vacancy.benefits && vacancy.benefits.length > 0 && (
          <ContentSection
            title="Benefits & Perks"
            content={vacancy.benefits}
            icon="🎁"
          />
        )}

        {/* Application Process / Additional Info */}
        {vacancy.sourceUrl && (
          <div className="mt-12 pt-8 border-t border-gray-200">
            <div className="bg-blue-50 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xl">📝</span>
                <h3 className="text-lg font-semibold text-blue-900">Ready to Apply?</h3>
              </div>
              <p className="text-blue-800 mb-4">
                To apply for this position, please visit the original job posting on {vacancy.sourceSite || 'the company\'s website'}.
              </p>
              <a
                href={vacancy.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Apply on {vacancy.sourceSite || 'Original Site'}
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}