export default function VacancySkeleton() {
  return (
    <div className="vacancy-card animate-pulse">
      {/* Header skeleton */}
      <div className="mb-4">
        <div className="h-6 bg-gray-200 rounded mb-2 w-3/4"></div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
          <div className="h-4 bg-gray-200 rounded w-32"></div>
        </div>
      </div>

      {/* Location skeleton */}
      <div className="flex items-center gap-2 mb-3">
        <div className="h-4 bg-gray-200 rounded w-24"></div>
        <div className="h-6 bg-gray-200 rounded-full w-16"></div>
      </div>

      {/* Salary skeleton */}
      <div className="mb-3">
        <div className="h-4 bg-gray-200 rounded w-20"></div>
      </div>

      {/* Technology tags skeleton */}
      <div className="flex flex-wrap gap-1 mb-3">
        <div className="h-6 bg-gray-200 rounded w-16"></div>
        <div className="h-6 bg-gray-200 rounded w-20"></div>
        <div className="h-6 bg-gray-200 rounded w-14"></div>
        <div className="h-6 bg-gray-200 rounded w-18"></div>
      </div>

      {/* Footer skeleton */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
        <div className="h-3 bg-gray-200 rounded w-24"></div>
        <div className="flex items-center gap-2">
          <div className="h-5 bg-gray-200 rounded w-16"></div>
          <div className="h-4 bg-gray-200 rounded w-8"></div>
        </div>
      </div>
    </div>
  )
}

// Component for rendering multiple skeletons
interface VacancySkeletonGridProps {
  count?: number
}

export function VacancySkeletonGrid({ count = 6 }: VacancySkeletonGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <VacancySkeleton key={index} />
      ))}
    </div>
  )
}