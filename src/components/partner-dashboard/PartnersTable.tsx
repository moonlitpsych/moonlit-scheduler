// Partners Table Component
'use client'

import { Partner } from '@/types/partner-types'

interface PartnersTableProps {
  partners: Partner[]
  loading: boolean
  pagination: {
    page: number
    per_page: number
    total: number
    total_pages: number
  }
  onPageChange: (page: number) => void
  onEditPartner: (partner: Partner) => void
  onDeletePartner: (partnerId: string) => void
}

export function PartnersTable({
  partners,
  loading,
  pagination,
  onPageChange,
  onEditPartner,
  onDeletePartner
}: PartnersTableProps) {
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-moonlit-peach/20 text-moonlit-navy border-moonlit-peach/40'
      case 'prospect':
        return 'bg-moonlit-orange/10 text-moonlit-orange border-moonlit-orange/30'
      case 'paused':
        return 'bg-gray-100 text-gray-700 border-gray-300'
      case 'terminated':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'lead':
        return 'bg-blue-100 text-blue-800'
      case 'qualified':
        return 'bg-moonlit-orange/10 text-moonlit-orange'
      case 'contract_sent':
        return 'bg-moonlit-brown/10 text-moonlit-brown'
      case 'live':
        return 'bg-moonlit-peach/20 text-moonlit-navy'
      case 'dormant':
        return 'bg-gray-100 text-gray-600'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-7 gap-4 pb-4 border-b border-gray-200">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="grid grid-cols-7 gap-4 py-4 border-b border-gray-100">
              {[...Array(7)].map((_, j) => (
                <div key={j} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (partners.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="text-gray-400 text-6xl mb-4">🏢</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2 font-['Newsreader']">No partners found</h3>
        <p className="text-gray-500 font-['Newsreader'] font-light">
          Try adjusting your filters or create a new partner to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden">
      {/* Table header */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <div className="grid grid-cols-7 gap-4 items-center text-sm font-medium text-gray-700 font-['Newsreader']">
          <div>Partner Name</div>
          <div>Contact</div>
          <div>Organization</div>
          <div>Status</div>
          <div>Stage</div>
          <div>Last Contact</div>
          <div className="text-center">Actions</div>
        </div>
      </div>

      {/* Table body */}
      <div className="divide-y divide-gray-100">
        {partners.map((partner) => (
          <div key={partner.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
            <div className="grid grid-cols-7 gap-4 items-center">
              {/* Partner Name */}
              <div>
                <div className="font-medium text-gray-900 font-['Newsreader']">
                  {partner.name}
                </div>
                {partner.specialties && partner.specialties.length > 0 && (
                  <div className="text-sm text-gray-500 font-['Newsreader']">
                    {partner.specialties.slice(0, 2).join(', ')}
                    {partner.specialties.length > 2 && ` +${partner.specialties.length - 2} more`}
                  </div>
                )}
              </div>

              {/* Contact */}
              <div>
                <div className="text-sm font-medium text-gray-900 font-['Newsreader']">
                  {partner.contact_person || '-'}
                </div>
                {partner.contact_email && (
                  <div className="text-sm text-gray-500 font-['Newsreader']">
                    {partner.contact_email}
                  </div>
                )}
                {partner.contact_phone && (
                  <div className="text-sm text-gray-500 font-['Newsreader']">
                    {partner.contact_phone}
                  </div>
                )}
              </div>

              {/* Organization */}
              <div>
                {partner.organization_id ? (
                  <div className="text-sm font-medium text-gray-900 font-['Newsreader']">
                    Org ID: {partner.organization_id.slice(0, 8)}...
                  </div>
                ) : (
                  <span className="text-gray-400 font-['Newsreader'] text-sm">No organization</span>
                )}
              </div>

              {/* Status */}
              <div>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(partner.status)}`}>
                  {partner.status}
                </span>
              </div>

              {/* Stage */}
              <div>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStageColor(partner.stage)}`}>
                  {partner.stage.replace('_', ' ')}
                </span>
              </div>

              {/* Last Contact */}
              <div className="text-sm text-gray-600 font-['Newsreader']">
                {formatDate(partner.last_contact_date || partner.updated_at)}
              </div>

              {/* Actions */}
              <div className="text-center">
                <div className="flex items-center justify-center space-x-2">
                  <button
                    onClick={() => onEditPartner(partner)}
                    className="text-moonlit-brown hover:text-moonlit-brown-hover text-sm font-medium font-['Newsreader']"
                  >
                    Edit
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => onDeletePartner(partner.id)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium font-['Newsreader']"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination.total_pages > 1 && (
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700 font-['Newsreader']">
              Showing {((pagination.page - 1) * pagination.per_page) + 1} to{' '}
              {Math.min(pagination.page * pagination.per_page, pagination.total)} of{' '}
              {pagination.total} partners
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Previous button */}
              <button
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg
                         hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-['Newsreader']"
              >
                Previous
              </button>

              {/* Page numbers */}
              <div className="flex items-center space-x-1">
                {[...Array(Math.min(pagination.total_pages, 7))].map((_, i) => {
                  let pageNum: number
                  if (pagination.total_pages <= 7) {
                    pageNum = i + 1
                  } else if (pagination.page <= 4) {
                    pageNum = i + 1
                  } else if (pagination.page >= pagination.total_pages - 3) {
                    pageNum = pagination.total_pages - 6 + i
                  } else {
                    pageNum = pagination.page - 3 + i
                  }

                  if (pageNum < 1 || pageNum > pagination.total_pages) return null

                  return (
                    <button
                      key={pageNum}
                      onClick={() => onPageChange(pageNum)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg font-['Newsreader'] ${
                        pageNum === pagination.page
                          ? 'bg-moonlit-brown text-white'
                          : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>

              {/* Next button */}
              <button
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.total_pages}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg
                         hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-['Newsreader']"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}