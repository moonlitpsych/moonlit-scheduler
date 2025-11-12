/**
 * ProviderCell Component
 *
 * Displays provider name.
 */

import { ProviderInfo } from '@/types/patient-roster'
import { formatProviderNameShort } from '@/utils/patient-roster-helpers'

interface ProviderCellProps {
  provider: ProviderInfo | null | undefined
}

export function ProviderCell({ provider }: ProviderCellProps) {
  if (!provider) {
    return <span className="text-sm text-gray-400">—</span>
  }

  return (
    <span className="text-sm text-gray-900">
      {formatProviderNameShort(provider)}
    </span>
  )
}
