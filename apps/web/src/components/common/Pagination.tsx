import { cn } from '@/lib/utils'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  pageSize: number
  onPageSizeChange: (size: number) => void
  totalItems: number
  isLoading?: boolean
}

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  totalItems,
  isLoading = false,
}: PaginationProps) {
  // Calculate the range of items being shown
  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Show first page
      pages.push(1)

      // Calculate start and end of middle section
      let start = Math.max(2, currentPage - 1)
      let end = Math.min(totalPages - 1, currentPage + 1)

      // Add ellipsis before middle section if needed
      if (start > 2) {
        pages.push('...')
      }

      // Add middle pages
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      // Add ellipsis after middle section if needed
      if (end < totalPages - 1) {
        pages.push('...')
      }

      // Show last page
      if (totalPages > 1) {
        pages.push(totalPages)
      }
    }

    return pages
  }

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1)
    }
  }

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1)
    }
  }

  const handlePageClick = (page: number | string) => {
    if (typeof page === 'number' && page !== currentPage) {
      onPageChange(page)
    }
  }

  if (totalPages <= 1) return null

  return (
    <div className="pagination-container">
      {/* Results info and page size selector */}
      <div className="flex items-center justify-between w-full sm:w-auto">
        <div className="pagination-info">
          {isLoading ? (
            <span>Loading...</span>
          ) : (
            <>
              Showing <span className="font-medium">{startItem}</span> to{' '}
              <span className="font-medium">{endItem}</span> of{' '}
              <span className="font-medium">{totalItems}</span> results
            </>
          )}
        </div>

        {/* Page size selector */}
        <div className="flex items-center gap-2 ml-4">
          <span className="text-sm text-gray-700">Show:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center gap-1 mt-4 sm:mt-0">
        {/* Previous button */}
        <button
          onClick={handlePrevious}
          disabled={currentPage === 1 || isLoading}
          className={cn(
            'pagination-button',
            'flex items-center gap-1 px-2'
          )}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Previous
        </button>

        {/* Page numbers */}
        {getPageNumbers().map((page, index) => (
          <button
            key={index}
            onClick={() => handlePageClick(page)}
            disabled={isLoading || page === '...'}
            className={cn(
              'pagination-button',
              'min-w-[2.5rem]',
              {
                'pagination-button-active': page === currentPage,
                'cursor-default': page === '...',
              }
            )}
          >
            {page}
          </button>
        ))}

        {/* Next button */}
        <button
          onClick={handleNext}
          disabled={currentPage === totalPages || isLoading}
          className={cn(
            'pagination-button',
            'flex items-center gap-1 px-2'
          )}
        >
          Next
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}