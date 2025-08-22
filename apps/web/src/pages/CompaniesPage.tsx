import { useState } from 'react'
import { useCompanies } from '@/hooks/useCompanies'
import { CompanyFilters } from '@/types/company'
import CompanyCard from '@/components/companies/CompanyCard'
import Pagination from '@/components/common/Pagination'
import { 
  MagnifyingGlassIcon, 
  AdjustmentsHorizontalIcon,
  BuildingOfficeIcon 
} from '@heroicons/react/24/outline'

export default function CompaniesPage() {
  const [filters, setFilters] = useState<CompanyFilters>({
    page: 1,
    limit: 20,
    sortBy: 'overall',
    sortOrder: 'desc',
    hasAnalysis: true
  })

  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Apply search to filters
  const finalFilters = {
    ...filters,
    search: searchTerm.trim() || undefined
  }

  const { data, isLoading, error } = useCompanies(finalFilters)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setFilters(prev => ({ ...prev, page: 1 })) // Reset to first page on search
  }

  const handleFilterChange = (newFilters: Partial<CompanyFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 })) // Reset to first page on filter change
  }

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }))
  }

  const handlePageSizeChange = (limit: number) => {
    setFilters(prev => ({ ...prev, limit, page: 1 })) // Reset to first page when changing page size
  }


  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <BuildingOfficeIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to load companies</h3>
          <p className="text-gray-500">
            {error instanceof Error ? error.message : 'An error occurred while fetching companies.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Companies</h1>
        <p className="text-gray-600">
          Discover companies with comprehensive analysis and scoring based on developer priorities.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </form>

          {/* Sort Dropdown */}
          <div className="flex gap-2">
            <select
              value={`${filters.sortBy}_${filters.sortOrder}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split('_')
                setFilters(prev => ({ 
                  ...prev, 
                  sortBy: sortBy as CompanyFilters['sortBy'], 
                  sortOrder: sortOrder as 'asc' | 'desc' 
                }))
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="overall_desc">Highest Rated</option>
              <option value="overall_asc">Lowest Rated</option>
              <option value="name_asc">Name A-Z</option>
              <option value="name_desc">Name Z-A</option>
              <option value="createdAt_desc">Recently Added</option>
              <option value="createdAt_asc">Oldest First</option>
            </select>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors ${
                showFilters 
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <AdjustmentsHorizontalIcon className="w-5 h-5" />
              Filters
            </button>
          </div>
        </div>

        {/* Expandable Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Industry Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                <select
                  value={filters.industry || ''}
                  onChange={(e) => handleFilterChange({ industry: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Industries</option>
                  <option value="Software">Software</option>
                  <option value="Financial Technology">FinTech</option>
                  <option value="Gaming">Gaming</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="E-commerce">E-commerce</option>
                  <option value="Consulting">Consulting</option>
                  <option value="Media">Media</option>
                </select>
              </div>

              {/* Size Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Size</label>
                <select
                  value={filters.size || ''}
                  onChange={(e) => handleFilterChange({ size: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Sizes</option>
                  <option value="startup">Startup (1-10)</option>
                  <option value="small">Small (11-50)</option>
                  <option value="medium">Medium (51-200)</option>
                  <option value="large">Large (201-1000)</option>
                  <option value="enterprise">Enterprise (1000+)</option>
                </select>
              </div>

              {/* Min Score Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Score</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={filters.minScore || ''}
                  onChange={(e) => handleFilterChange({ 
                    minScore: e.target.value ? parseInt(e.target.value) : undefined 
                  })}
                  placeholder="0-100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Active Vacancies Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vacancies</label>
                <select
                  value={filters.hasActiveVacancies?.toString() || ''}
                  onChange={(e) => handleFilterChange({ 
                    hasActiveVacancies: e.target.value ? e.target.value === 'true' : undefined 
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Companies</option>
                  <option value="true">Has Open Positions</option>
                  <option value="false">No Open Positions</option>
                </select>
              </div>
            </div>

            {/* Clear Filters */}
            <div className="mt-4">
              <button
                onClick={() => {
                  setFilters({
                    page: 1,
                    limit: 20,
                    sortBy: 'overall',
                    sortOrder: 'desc',
                    hasAnalysis: true
                  })
                  setSearchTerm('')
                }}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Clear all filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results Summary */}
      {data && (
        <div className="mb-6">
          <div className="text-sm text-gray-600">
            Showing {((data.pagination.page - 1) * data.pagination.limit) + 1}-
            {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of{' '}
            {data.pagination.total} companies
          </div>
        </div>
      )}

      {/* Companies Grid */}
      <div className="mb-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-6 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-5 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : data?.data.length === 0 ? (
          <div className="text-center py-12">
            <BuildingOfficeIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No companies found</h3>
            <p className="text-gray-500">
              Try adjusting your search terms or filters to find companies.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data?.data.map((company) => (
              <CompanyCard 
                key={company.id} 
                company={company}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.pagination.pages > 1 && (
        <Pagination
          currentPage={data.pagination.page}
          totalPages={data.pagination.pages}
          onPageChange={handlePageChange}
          pageSize={data.pagination.limit}
          onPageSizeChange={handlePageSizeChange}
          totalItems={data.pagination.total}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}