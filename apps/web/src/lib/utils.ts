import { clsx, type ClassValue } from 'clsx'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Vacancy, ParsedVacancy } from '@/types/vacancy'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

// Parse JSON strings safely
export function safeJsonParse<T>(jsonString?: string, fallback: T[] = [] as T[]): T[] {
  if (!jsonString) return fallback
  try {
    const parsed = JSON.parse(jsonString)
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

// Format salary range
export function formatSalary(salaryMin?: number, salaryMax?: number, currency = 'EUR'): string {
  if (!salaryMin && !salaryMax) return 'Competitive'
  
  const formatAmount = (amount: number) => {
    if (amount >= 1000) {
      return `${Math.round(amount / 1000)}k`
    }
    return amount.toString()
  }

  const currencySymbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency

  if (salaryMin && salaryMax) {
    return `${currencySymbol}${formatAmount(salaryMin)}-${formatAmount(salaryMax)}`
  }
  
  if (salaryMin) {
    return `From ${currencySymbol}${formatAmount(salaryMin)}`
  }
  
  if (salaryMax) {
    return `Up to ${currencySymbol}${formatAmount(salaryMax)}`
  }

  return 'Competitive'
}

// Get quality level from confidence score
export function getQualityLevel(confidence?: number): 'high' | 'medium' | 'low' {
  if (!confidence) return 'low'
  if (confidence >= 70) return 'high'
  if (confidence >= 50) return 'medium'
  return 'low'
}

// Transform vacancy data for frontend display
export function parseVacancy(vacancy: Vacancy): ParsedVacancy {
  const technologies = safeJsonParse<string>(vacancy.technologies)
  const responsibilities = safeJsonParse<string>(vacancy.responsibilities)
  const benefits = safeJsonParse<string>(vacancy.benefits)
  const requirements = safeJsonParse<string>(vacancy.requirements)
  
  return {
    ...vacancy,
    technologies,
    responsibilities,
    benefits,
    requirements,
    formattedSalary: formatSalary(vacancy.salaryMin, vacancy.salaryMax, vacancy.currency),
    relativeTime: formatDistanceToNow(parseISO(vacancy.updatedAt), { addSuffix: true }),
    qualityLevel: getQualityLevel(vacancy.extractionConfidence),
  }
}

// Get work model badge classes
export function getWorkModelClasses(workModel?: string): string {
  const baseClasses = 'location-badge'
  
  if (!workModel) return cn(baseClasses, 'bg-gray-100 text-gray-800')
  
  const model = workModel.toLowerCase()
  if (model.includes('remote')) return cn(baseClasses, 'location-remote')
  if (model.includes('hybrid')) return cn(baseClasses, 'location-hybrid')
  return cn(baseClasses, 'location-office')
}

// Get quality indicator classes
export function getQualityClasses(level: 'high' | 'medium' | 'low'): string {
  const baseClasses = 'quality-indicator'
  
  switch (level) {
    case 'high':
      return cn(baseClasses, 'quality-high')
    case 'medium':
      return cn(baseClasses, 'quality-medium')
    case 'low':
      return cn(baseClasses, 'quality-low')
    default:
      return baseClasses
  }
}

// Truncate text to specified length
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

// Generate placeholder avatar from company name
export function getCompanyInitials(companyName: string): string {
  return companyName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('')
}