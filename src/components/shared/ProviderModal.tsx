'use client'

import { useProviderModal } from '@/contexts/ProviderModalContext'
import { Provider } from '@/components/shared/ProviderCard'

export default function ProviderModal() {
    const { isOpen, provider, closeModal } = useProviderModal()

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

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-all duration-300"
                onClick={closeModal}
                aria-hidden="true"
            />
            
            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div 
                    className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden transition-all duration-300 transform"
                    onClick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="provider-modal-title"
                >
                    {/* Header with Close Button */}
                    <div className="relative p-8 pb-6">
                        <button
                            onClick={closeModal}
                            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-center text-gray-600 hover:text-gray-800"
                            aria-label="Close provider details"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="px-8 pb-8 overflow-y-auto max-h-[calc(90vh-100px)]">
                        {/* Provider Image and Name */}
                        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 mb-8">
                            {/* Large Provider Image */}
                            <div className="flex-shrink-0">
                                {provider.profile_image_url ? (
                                    <div className="relative">
                                        <img
                                            src={getImageUrl(provider.profile_image_url)}
                                            alt={displayName}
                                            className="w-32 h-40 rounded-2xl object-cover shadow-lg"
                                            onError={(e) => {
                                                // Fallback to initials if image fails to load
                                                const target = e.target as HTMLImageElement
                                                target.style.display = 'none'
                                                target.nextElementSibling?.classList.remove('hidden')
                                            }}
                                        />
                                        <div className="hidden w-32 h-40 rounded-2xl bg-gradient-to-br from-[#2C5F6F] to-[#1A3A47] flex items-center justify-center text-white font-bold text-3xl font-['Newsreader'] absolute inset-0 shadow-lg">
                                            {initials}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-32 h-40 rounded-2xl bg-gradient-to-br from-[#2C5F6F] to-[#1A3A47] flex items-center justify-center text-white font-bold text-3xl font-['Newsreader'] shadow-lg">
                                        {initials}
                                    </div>
                                )}
                            </div>

                            {/* Provider Info */}
                            <div className="flex-1 text-center md:text-left">
                                <h1 
                                    id="provider-modal-title"
                                    className="text-4xl font-['Newsreader'] text-[#091747] font-normal mb-2"
                                >
                                    Dr. {provider.first_name} {provider.last_name}
                                </h1>
                                
                                {provider.title && (
                                    <p className="text-xl text-[#BF9C73] font-['Newsreader'] mb-4">
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
                            {/* Languages */}
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

                            {/* Specialties */}
                            {provider.specialties && provider.specialties.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-['Newsreader'] text-[#091747] font-medium mb-3">Specialties</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {provider.specialties.map((specialty, index) => (
                                            <span 
                                                key={index}
                                                className="px-3 py-2 bg-[#BF9C73]/20 text-[#BF9C73] rounded-lg font-['Newsreader'] text-sm"
                                            >
                                                {specialty}
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

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4 mt-10 pt-8 border-t border-gray-200">
                            {/* Only show Book button if provider is bookable */}
                            {provider.is_bookable !== false && (
                                <button
                                    onClick={() => {
                                        // Navigate to provider-specific booking
                                        window.location.href = `/book/provider/${provider.id}?intent=book`
                                    }}
                                    className="flex-1 bg-[#BF9C73] hover:bg-[#A8865F] text-white py-4 px-8 rounded-xl font-['Newsreader'] text-center transition-colors font-medium text-lg shadow-sm"
                                >
                                    Book Dr. {provider.last_name}
                                </button>
                            )}
                            <button
                                onClick={closeModal}
                                className={`${provider.is_bookable !== false ? 'flex-1' : 'w-full'} bg-white hover:bg-gray-50 text-[#091747] py-4 px-8 rounded-xl font-['Newsreader'] border-2 border-gray-200 hover:border-gray-300 transition-colors font-medium text-lg`}
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