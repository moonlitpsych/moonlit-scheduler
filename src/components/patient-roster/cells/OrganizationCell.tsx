/**
 * OrganizationCell Component
 *
 * Displays organization affiliation(s) for a patient.
 * Shows "No affiliation" if patient has no organizations.
 */

import { Building2 } from 'lucide-react'
import { OrganizationAffiliation } from '@/types/patient-roster'

interface OrganizationCellProps {
  affiliations?: OrganizationAffiliation[] | null
}

export function OrganizationCell({ affiliations }: OrganizationCellProps) {
  if (!affiliations || affiliations.length === 0) {
    return (
      <span className="text-gray-400 text-sm italic flex items-center gap-1">
        <Building2 className="w-3.5 h-3.5" />
        No affiliation
      </span>
    )
  }

  // Show first organization, with count if multiple
  const primary = affiliations[0]
  const additionalCount = affiliations.length - 1

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Building2 className="w-3.5 h-3.5 text-moonlit-brown flex-shrink-0" />
        <span className="text-sm font-medium text-gray-900 truncate" title={primary.org_name}>
          {primary.org_name}
        </span>
      </div>
      {additionalCount > 0 && (
        <span className="text-xs text-gray-500 pl-5">
          +{additionalCount} more
        </span>
      )}
    </div>
  )
}
