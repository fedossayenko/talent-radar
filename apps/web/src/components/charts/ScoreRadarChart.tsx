'use client'

import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend } from 'recharts'
import { CompanyScore } from '@/types/company'

interface ScoreRadarChartProps {
  categoryScores: CompanyScore['categories'] | null
  className?: string
}

export function ScoreRadarChart({ categoryScores, className = '' }: ScoreRadarChartProps) {
  if (!categoryScores) {
    return (
      <div className={`flex items-center justify-center h-64 bg-gray-50 rounded-lg ${className}`}>
        <p className="text-gray-500">No scoring data available</p>
      </div>
    )
  }

  // Transform category scores to chart data format
  const chartData = [
    {
      category: 'Developer Experience',
      score: Math.round(categoryScores.developerExperience || 0),
      fullMark: 100
    },
    {
      category: 'Culture & Values',
      score: Math.round(categoryScores.cultureAndValues || 0),
      fullMark: 100
    },
    {
      category: 'Growth Opportunities',
      score: Math.round(categoryScores.growthOpportunities || 0),
      fullMark: 100
    },
    {
      category: 'Compensation',
      score: Math.round(categoryScores.compensationBenefits || 0),
      fullMark: 100
    },
    {
      category: 'Work-Life Balance',
      score: Math.round(categoryScores.workLifeBalance || 0),
      fullMark: 100
    },
    {
      category: 'Company Stability',
      score: Math.round(categoryScores.companyStability || 0),
      fullMark: 100
    }
  ]

  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer width="100%" height={400}>
        <RadarChart data={chartData}>
          <PolarGrid gridType="polygon" stroke="#e5e7eb" />
          <PolarAngleAxis 
            dataKey="category"
            className="text-sm font-medium"
            tick={{ fontSize: 12, fill: '#374151' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            tickCount={6}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.2}
            strokeWidth={2}
            dot={{ r: 4, fill: '#3b82f6' }}
          />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="circle"
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}