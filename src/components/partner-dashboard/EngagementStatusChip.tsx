/**
 * Engagement Status Chip Component
 *
 * Visual chip showing patient engagement status with appropriate colors.
 * Factual display only - no prescriptive language about clinical cadence.
 */

'use client'

interface EngagementStatusChipProps {
  status: 'active' | 'discharged' | 'transferred' | 'deceased' | 'inactive'
  className?: string
}

const STATUS_CONFIG = {
  active: {
    label: 'Active',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    borderColor: 'border-green-200'
  },
  discharged: {
    label: 'Discharged',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-200'
  },
  transferred: {
    label: 'Transferred',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-800',
    borderColor: 'border-purple-200'
  },
  deceased: {
    label: 'Deceased',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    borderColor: 'border-gray-200'
  },
  inactive: {
    label: 'Inactive',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    borderColor: 'border-yellow-200'
  }
}

export function EngagementStatusChip({ status, className = '' }: EngagementStatusChipProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.active

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor} ${className}`}
    >
      {config.label}
    </span>
  )
}
