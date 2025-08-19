import { ParsedVacancy } from '@/types/vacancy'
import { useState } from 'react'

interface TechnologyStackProps {
  vacancy: ParsedVacancy
}

interface TechTagProps {
  tech: string
  isHighlighted?: boolean
  onClick?: () => void
}

function TechTag({ tech, isHighlighted = false, onClick }: TechTagProps) {
  return (
    <span
      className={`
        inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer
        ${isHighlighted 
          ? 'bg-blue-100 text-blue-800 ring-2 ring-blue-500 ring-opacity-50' 
          : 'bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-700'
        }
      `}
      onClick={onClick}
    >
      {tech}
    </span>
  )
}

export default function TechnologyStack({ vacancy }: TechnologyStackProps) {
  const [highlightedTech, setHighlightedTech] = useState<string | null>(null)

  if (!vacancy.technologies || vacancy.technologies.length === 0) {
    return null
  }

  // Categorize technologies (this is a simple categorization - could be enhanced)
  const categorizeTechnologies = (techs: string[]) => {
    const categories: Record<string, string[]> = {
      'Programming Languages': [],
      'Frameworks & Libraries': [],
      'Databases': [],
      'Tools & Platforms': [],
      'Other': []
    }

    const languageKeywords = ['javascript', 'typescript', 'python', 'java', 'c#', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'scala']
    const frameworkKeywords = ['react', 'angular', 'vue', 'express', 'django', 'spring', 'laravel', 'rails', 'flask', '.net', 'nextjs', 'gatsby']
    const databaseKeywords = ['mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'oracle', 'sqlite', 'cassandra', 'dynamodb']
    const toolKeywords = ['docker', 'kubernetes', 'jenkins', 'git', 'aws', 'azure', 'gcp', 'terraform', 'ansible', 'webpack', 'babel', 'nginx']

    techs.forEach(tech => {
      const lowerTech = tech.toLowerCase()
      
      if (languageKeywords.some(keyword => lowerTech.includes(keyword))) {
        categories['Programming Languages'].push(tech)
      } else if (frameworkKeywords.some(keyword => lowerTech.includes(keyword))) {
        categories['Frameworks & Libraries'].push(tech)
      } else if (databaseKeywords.some(keyword => lowerTech.includes(keyword))) {
        categories['Databases'].push(tech)
      } else if (toolKeywords.some(keyword => lowerTech.includes(keyword))) {
        categories['Tools & Platforms'].push(tech)
      } else {
        categories['Other'].push(tech)
      }
    })

    // Remove empty categories
    return Object.entries(categories).filter(([, items]) => items.length > 0)
  }

  const categorizedTechs = categorizeTechnologies(vacancy.technologies)
  const shouldCategorize = vacancy.technologies.length > 8

  const handleTechClick = (tech: string) => {
    setHighlightedTech(highlightedTech === tech ? null : tech)
  }

  return (
    <div className="bg-white border-t border-gray-200">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-xl">💻</span>
          <h3 className="text-xl font-semibold text-gray-900">Technology Stack</h3>
          <span className="text-sm text-gray-500">({vacancy.technologies.length} technologies)</span>
        </div>

        {shouldCategorize ? (
          // Categorized view for many technologies
          <div className="space-y-6">
            {categorizedTechs.map(([category, techs]) => (
              <div key={category}>
                <h4 className="text-sm font-medium text-gray-600 mb-3">{category}</h4>
                <div className="flex flex-wrap gap-2">
                  {techs.map((tech, index) => (
                    <TechTag
                      key={index}
                      tech={tech}
                      isHighlighted={highlightedTech === tech}
                      onClick={() => handleTechClick(tech)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Simple view for fewer technologies
          <div className="flex flex-wrap gap-2">
            {vacancy.technologies.map((tech, index) => (
              <TechTag
                key={index}
                tech={tech}
                isHighlighted={highlightedTech === tech}
                onClick={() => handleTechClick(tech)}
              />
            ))}
          </div>
        )}

        {/* Tech highlight info */}
        {highlightedTech && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-blue-600 font-medium">{highlightedTech}</span>
              <span className="text-sm text-blue-500">• Selected Technology</span>
            </div>
            <p className="text-sm text-blue-700">
              This technology appears to be important for this role. Make sure to highlight your experience with {highlightedTech} in your application.
            </p>
          </div>
        )}

        {/* Stats */}
        {vacancy.technologies.length > 5 && (
          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Technology diversity indicates a modern tech stack</span>
              <span>{vacancy.technologies.length} technologies required</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}