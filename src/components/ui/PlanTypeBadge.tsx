interface PlanTypeBadgeProps {
  planType: string | null
  className?: string
}

/**
 * Badge component for displaying insurance plan types (HMO, PPO, EPO, etc.)
 *
 * Displays a small pill with the plan type, color-coded by category.
 * Returns null if planType is null or empty.
 */
export default function PlanTypeBadge({ planType, className = '' }: PlanTypeBadgeProps) {
  if (!planType) {
    return null
  }

  // Color coding based on plan type
  const getBadgeClasses = (type: string): string => {
    const baseClasses = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium'

    switch (type.toUpperCase()) {
      case 'HMO':
        return `${baseClasses} bg-blue-100 text-blue-800`
      case 'PPO':
        return `${baseClasses} bg-green-100 text-green-800`
      case 'EPO':
        return `${baseClasses} bg-purple-100 text-purple-800`
      case 'POS':
        return `${baseClasses} bg-yellow-100 text-yellow-800`
      case 'HDHP':
        return `${baseClasses} bg-orange-100 text-orange-800`
      case 'OTHER':
        return `${baseClasses} bg-gray-100 text-gray-800`
      default:
        return `${baseClasses} bg-gray-100 text-gray-700`
    }
  }

  return (
    <span
      className={`${getBadgeClasses(planType)} ${className}`}
      aria-label={`Plan type: ${planType}`}
    >
      {planType.toUpperCase()}
    </span>
  )
}
