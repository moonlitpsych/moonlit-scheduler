'use client'

import { useState, useEffect } from 'react'
import { useProviderModal } from '@/contexts/ProviderModalContext'
import { Provider } from '@/types/provider'
import { generateProviderSlug } from '@/lib/utils/providerSlug'

interface AcceptedPayment {
    id: string
    name: string
    type: string
    state: string
    status: string
    is_active: boolean
    is_projected: boolean
    display_name: string
}

export default function ProviderModal() {
    const { isOpen, provider, closeModal, showBookButton } = useProviderModal()
    const [acceptedPayments, setAcceptedPayments] = useState<AcceptedPayment[]>([])
    const [paymentsLoading, setPaymentsLoading] = useState(false)
    const [selfPayAvailable, setSelfPayAvailable] = useState(true)

    // Fetch accepted payments when modal opens
    useEffect(() => {
        if (isOpen && provider && provider.is_bookable !== false) {
            setPaymentsLoading(true)
            fetch(`/api/providers/${provider.id}/accepted-payments`)
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        setAcceptedPayments(data.data.accepted_payments || [])
                        setSelfPayAvailable(data.data.self_pay_available || true)
                    }
                })
                .catch(error => {
                    console.error('Failed to fetch accepted payments:', error)
                })
                .finally(() => {
                    setPaymentsLoading(false)
                })
        } else {
            setAcceptedPayments([])
            setSelfPayAvailable(true)
        }
    }, [isOpen, provider])

    if (!isOpen || !provider) return null

    // Helper to convert Google Drive links to direct image URLs
    const getImageUrl = (url: string) => {
        if (!url) return url
        
        // Convert Google Drive share links to direct links
        if (url.includes('drive.google.com')) {
            const fileIdMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/)
            if (fileIdMatch) {
                return `https://drive.google.com/uc?export=view&id=${fileIdMatch[1]}`
            }
        }
        return url
    }

    const displayName = provider.full_name || `${provider.first_name} ${provider.last_name}`
    const initials = `${provider.first_name?.charAt(0) || ''}${provider.last_name?.charAt(0) || ''}`

    const uniformChipClass = "inline-block px-3 py-2 text-sm rounded font-['Newsreader'] transition-colors bg-[#BF9C73]/20 text-[#BF9C73]"

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-all duration-300"
                onClick={closeModal}
                aria-hidden="true"
            />
            
            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
                <div 
                    className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden transition-all duration-300 transform flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="provider-modal-title"
                >
                    {/* Header with Close Button */}
                    <div className="relative p-4 pb-3 sm:p-8 sm:pb-6 flex-shrink-0">
                        <button
                            onClick={closeModal}
                            className="absolute top-3 right-3 sm:top-6 sm:right-6 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-center text-gray-600 hover:text-gray-800"
                            aria-label="Close provider details"
                        >
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="px-4 sm:px-8 overflow-y-auto flex-1 min-h-0">
                        {/* Provider Image and Name */}
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 md:gap-8 mb-6 sm:mb-8">
                            {/* Large Provider Image */}
                            <div className="flex-shrink-0">
                                {provider.profile_image_url ? (
                                    <div className="relative">
                                        <img
                                            src={getImageUrl(provider.profile_image_url)}
                                            alt={displayName}
                                            className="w-24 h-30 sm:w-28 sm:h-36 md:w-32 md:h-40 rounded-2xl object-cover shadow-lg"
                                            onError={(e) => {
                                                // Fallback to initials if image fails to load
                                                const target = e.target as HTMLImageElement
                                                target.style.display = 'none'
                                                target.nextElementSibling?.classList.remove('hidden')
                                            }}
                                        />
                                        <div className="hidden w-24 h-30 sm:w-28 sm:h-36 md:w-32 md:h-40 rounded-2xl bg-gradient-to-br from-[#2C5F6F] to-[#1A3A47] flex items-center justify-center text-white font-bold text-2xl sm:text-3xl font-['Newsreader'] absolute inset-0 shadow-lg">
                                            {initials}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-24 h-30 sm:w-28 sm:h-36 md:w-32 md:h-40 rounded-2xl bg-gradient-to-br from-[#2C5F6F] to-[#1A3A47] flex items-center justify-center text-white font-bold text-2xl sm:text-3xl font-['Newsreader'] shadow-lg">
                                        {initials}
                                    </div>
                                )}
                            </div>

                            {/* Provider Info */}
                            <div className="flex-1 text-center sm:text-left">
                                <h1 
                                    id="provider-modal-title"
                                    className="text-2xl sm:text-3xl md:text-4xl font-['Newsreader'] text-[#091747] font-normal mb-2 leading-tight"
                                >
                                    Dr. {provider.first_name} {provider.last_name}
                                </h1>
                                
                                {provider.title && (
                                    <p className="text-lg sm:text-xl text-[#BF9C73] font-['Newsreader'] mb-4">
                                        {provider.title}
                                    </p>
                                )}

                                {(provider.provider_type || provider.role) && (
                                    <span className="inline-block px-4 py-2 bg-[#FEF8F1] text-[#BF9C73] border border-[#BF9C73] text-sm font-medium rounded-full font-['Newsreader'] mb-4">
                                        {provider.provider_type || provider.role}
                                    </span>
                                )}

                                {/* Accepting New Patients - only show for bookable providers */}
                                {provider.is_bookable !== false && provider.accepts_new_patients && (
                                    <div className="mb-6">
                                        <div className="inline-flex items-center px-4 py-2 bg-[#F0F8F0] text-[#2D5016] rounded-lg font-['Newsreader'] text-sm font-medium border border-[#9BC53D]/30">
                                            <span className="w-2 h-2 bg-[#4CAF50] rounded-full mr-2"></span>
                                            Accepting new patients
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Provider Details */}
                        <div className="space-y-8">
                            {/* Focus Areas */}
                            {provider.focus_json && provider.focus_json.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-['Newsreader'] text-[#091747] font-medium mb-3">Areas of Focus</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {provider.focus_json.map((focus) => (
                                            <span
                                                key={focus.id}
                                                className={uniformChipClass}
                                                title={`${focus.type}: ${focus.name}`}
                                            >
                                                {focus.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* About - no title, just content */}
                            {provider.about && (
                                <div>
                                    <p className="text-[#091747]/80 font-['Newsreader'] leading-relaxed">
                                        {provider.about}
                                    </p>
                                </div>
                            )}

                            {/* Accepted Forms of Payment - only show for bookable providers */}
                            {provider.is_bookable !== false && (
                                <div>
                                    <h3 className="text-lg font-['Newsreader'] text-[#091747] font-medium mb-3">Accepted Forms of Payment</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {/* Always show self-pay options for bookable providers */}
                                        {selfPayAvailable && (
                                            <span className="px-3 py-2 bg-[#f28c69] text-white rounded-lg font-['Newsreader'] text-sm border border-[#f28c69] shadow-sm">
                                                Cash | Credit Card | ACH
                                            </span>
                                        )}
                                        
                                        {/* Show loading state */}
                                        {paymentsLoading && (
                                            <span className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg font-['Newsreader'] text-sm animate-pulse">
                                                Loading insurance information...
                                            </span>
                                        )}
                                        
                                        {/* Show accepted insurance payments */}
                                        {!paymentsLoading && acceptedPayments.map((payment) => (
                                            <span 
                                                key={payment.id}
                                                className={`px-3 py-2 rounded-lg font-['Newsreader'] text-sm border shadow-sm ${
                                                    payment.is_active 
                                                        ? 'bg-[#f28c69] text-white border-[#f28c69]' 
                                                        : 'bg-[#f28c69]/60 text-white border-[#f28c69]/60'
                                                }`}
                                                title={payment.is_active ? 'Currently accepting' : 'Coming soon'}
                                            >
                                                {payment.display_name}
                                                {payment.is_projected && (
                                                    <span className="ml-1 text-xs opacity-90">(projected)</span>
                                                )}
                                            </span>
                                        ))}
                                        
                                        {/* Show message if no insurance found but not loading */}
                                        {!paymentsLoading && acceptedPayments.length === 0 && selfPayAvailable && (
                                            <span className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg font-['Newsreader'] text-sm italic">
                                                Insurance coverage information coming soon
                                            </span>
                                        )}
                                    </div>
                                    
                                    {/* Optional note for projected payments */}
                                    {acceptedPayments.some(p => p.is_projected) && (
                                        <p className="text-xs text-[#091747]/60 font-['Newsreader'] mt-2 italic">
                                            Projected payments are pending final approval
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Languages - moved to just above education */}
                            {provider.languages_spoken && provider.languages_spoken.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-['Newsreader'] text-[#091747] font-medium mb-3">Languages</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {provider.languages_spoken.map((language, index) => (
                                            <span 
                                                key={index}
                                                className="px-3 py-2 bg-[#FEF8F1] text-[#BF9C73] rounded-lg font-['Newsreader'] text-sm border border-[#BF9C73]/30"
                                            >
                                                {language}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="text-lg font-['Newsreader'] text-[#091747] font-medium mb-3">Medical School</h3>
                                    {provider.med_school_org ? (
                                        <div className="text-[#091747]/80 font-['Newsreader']">
                                            <p className="font-medium">{provider.med_school_org}</p>
                                            {provider.med_school_grad_year && (
                                                <p className="text-sm text-[#091747]/60 mt-1">
                                                    Graduated {provider.med_school_grad_year}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-[#091747]/70 font-['Newsreader'] italic">
                                            Information coming soon
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-lg font-['Newsreader'] text-[#091747] font-medium mb-3">Residency</h3>
                                    {provider.residency_org ? (
                                        <p className="text-[#091747]/80 font-['Newsreader'] font-medium">
                                            {provider.residency_org}
                                        </p>
                                    ) : (
                                        <p className="text-[#091747]/70 font-['Newsreader'] italic">
                                            Information coming soon
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Fixed Action Buttons at Bottom */}
                    <div className="flex-shrink-0 px-4 pb-4 sm:px-8 sm:pb-8 border-t border-gray-200 bg-white">
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 sm:pt-6">
                            {/* Only show Book button if provider is bookable AND we're in directory context */}
                            {provider.is_bookable !== false && showBookButton && (
                                <button
                                    onClick={() => {
                                        window.location.href = `/see-a-psychiatrist-widget`
                                    }}
                                    className="flex-1 bg-[#BF9C73] hover:bg-[#A8865F] text-white py-3 sm:py-4 px-6 sm:px-8 rounded-xl font-['Newsreader'] text-center transition-colors font-medium text-base sm:text-lg shadow-sm"
                                >
                                    Book Dr. {provider.last_name}
                                </button>
                            )}
                            <button
                                onClick={closeModal}
                                className={`${provider.is_bookable !== false && showBookButton ? 'flex-1' : 'w-full'} bg-white hover:bg-gray-50 text-[#091747] py-3 sm:py-4 px-6 sm:px-8 rounded-xl font-['Newsreader'] border-2 border-gray-200 hover:border-gray-300 transition-colors font-medium text-base sm:text-lg`}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}