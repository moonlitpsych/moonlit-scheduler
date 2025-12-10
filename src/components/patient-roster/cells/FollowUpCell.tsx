/**
 * FollowUpCell Component
 *
 * Displays the physician's exact follow-up phrasing from the most recent
 * locked IntakeQ clinical note. Shows exact text without parsing/conversion.
 * Supports loading state for lazy-loaded data.
 */

import { FollowUpDetails } from '@/types/patient-roster'

interface FollowUpCellProps {
  followUp: FollowUpDetails | null | undefined
  isLoading?: boolean
}

export function FollowUpCell({ followUp, isLoading }: FollowUpCellProps) {
  // Show loading skeleton while fetching
  if (isLoading) {
    return (
      <div className="flex flex-col gap-1 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24"></div>
        <div className="h-3 bg-gray-100 rounded w-16"></div>
      </div>
    )
  }

  if (!followUp || !followUp.text) {
    return <span className="text-sm text-gray-400">—</span>
  }

  // Format the note date if available
  const noteDate = followUp.noteDate
    ? new Date(followUp.noteDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
    : null

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm text-gray-900 line-clamp-2" title={followUp.text}>
        {followUp.text}
      </span>
      {noteDate && (
        <span className="text-xs text-gray-400">
          from {noteDate}
        </span>
      )}
    </div>
  )
}
