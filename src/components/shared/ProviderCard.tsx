'use client'

import { ReactNode } from 'react'
import { useProviderModal } from '@/contexts/ProviderModalContext'

export interface Provider {
    id: string
    first_name: string
    last_name: string
    full_name?: string // Some APIs return this directly
    title?: string
    profile_image_url?: string
    bio?: string
    about?: string // About text from database
    what_i_look_for_in_a_patient?: string // What they look for in patients
    med_school_org?: string // Medical school
    med_school_grad_year?: number // Graduation year
    residency_org?: string // Residency organization
    specialties?: string[]
    languages_spoken?: string[]
    accepts_new_patients?: boolean
    availability?: string  // Provider availability status from database
    is_bookable?: boolean  // Whether provider can be booked by patients
    new_patient_status?: string // From booking flow
    next_available?: string
    state_licenses?: string[]
    accepted_insurances?: string[]
    role?: string
    provider_type?: string
}

export type ProviderCardVariant = 
    | 'selection'      // For provider selection in booking flow
    | 'calendar'       // Compact version for calendar view
    | 'summary'        // Detailed version for appointment summary
    | 'directory'      // Full directory listing
    | 'compact'        // Small version for confirmation

export interface ProviderCardProps {
    provider: Provider
    variant?: ProviderCardVariant
    selected?: boolean
    showAvailability?: boolean
    showInsurance?: boolean
    showLicensing?: boolean
    showSpecialties?: boolean
    showLanguages?: boolean
    showBio?: boolean
    actionButton?: {
        text: string
        onClick: () => void
        variant?: 'primary' | 'secondary'
    }
    customAction?: ReactNode
    className?: string
    onClick?: () => void
}

export default function ProviderCard({
    provider,
    variant = 'directory',
    selected = false,
    showAvailability = true,
    showInsurance = false,
    showLicensing = false,
    showSpecialties = true,
    showLanguages = true,
    showBio = false,
    actionButton,
    customAction,
    className = '',
    onClick
}: ProviderCardProps) {
    const { openModal } = useProviderModal()
    
    const displayName = provider.full_name || `Dr. ${provider.first_name} ${provider.last_name}`
    const initials = `${provider.first_name.charAt(0)}${provider.last_name.charAt(0)}`

    // Variant-specific configurations with brand colors
    const config = {
        selection: {
            containerClass: `bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden border-2 ${
                selected 
                    ? 'border-[#2C5F6F] bg-[#F8F6F1] shadow-xl scale-[1.02]' 
                    : 'border-transparent hover:border-[#BF9C73]/50'
            }`,
            showSpecialties: true,
            showLanguages: true,
            showAvailability: true
        },
        calendar: {
            containerClass: `rounded-xl text-left transition-all duration-200 border-2 overflow-hidden ${
                selected 
                    ? 'border-[#2C5F6F] bg-[#F8F6F1] shadow-md ring-2 ring-[#2C5F6F]/20' 
                    : 'border-stone-200 hover:border-[#BF9C73]/50 hover:bg-stone-50'
            }`,
            showSpecialties: false,
            showLanguages: false,
            showAvailability: false
        },
        summary: {
            containerClass: 'border border-[#E6D7C3] rounded-xl bg-[#F8F6F1] overflow-hidden',
            showSpecialties: true,
            showLanguages: true,
            showAvailability: false
        },
        directory: {
            containerClass: 'bg-white rounded-xl border-2 border-stone-200 hover:border-[#BF9C73]/50 hover:bg-stone-50 transition-all duration-200 overflow-hidden',
            showSpecialties: true,
            showLanguages: false,
            showAvailability: true
        },
        compact: {
            containerClass: 'inline-flex items-center space-x-3',
            showSpecialties: false,
            showLanguages: false,
            showAvailability: false
        }
    }

    const currentConfig = config[variant]

    const handleClick = () => {
        if (onClick) {
            onClick()
        } else if (variant === 'directory') {
            // For directory variant, open modal by default with directory context
            openModal(provider, 'directory')
        }
    }

    const handleMoreClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        // Determine context based on variant
        const context = variant === 'directory' ? 'directory' : 
                       variant === 'selection' || variant === 'calendar' ? 'booking' :
                       variant === 'summary' ? 'summary' : 'other'
        openModal(provider, context)
    }

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

    const renderImage = () => {
        // Define image dimensions for different variants (responsive)
        const imageDimensions = {
            selection: 'w-16 h-20 sm:w-20 sm:h-24',      // Smaller on mobile, 20x24 portrait on desktop
            calendar: 'w-10 h-12 sm:w-12 sm:h-14',       // Smaller on mobile, 12x14 on desktop  
            summary: 'w-12 h-16 sm:w-16 sm:h-20',        // Smaller on mobile, 16x20 on desktop
            directory: 'w-16 h-20 sm:w-20 sm:h-24',      // Consistent with selection for mobile
            compact: 'w-8 h-10 sm:w-10 sm:h-12'          // Smaller on mobile, 10x12 on desktop
        }

        const imageClass = imageDimensions[variant] || imageDimensions.directory

        return provider.profile_image_url ? (
            <div className={`relative ${variant === 'directory' ? 'mx-auto' : ''}`}>
                <img
                    src={getImageUrl(provider.profile_image_url)}
                    alt={displayName}
                    className={`${imageClass} rounded-lg object-cover shadow-sm`}
                    onError={(e) => {
                        // Fallback to initials if image fails to load
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        target.nextElementSibling?.classList.remove('hidden')
                    }}
                />
                <div className={`hidden ${imageClass} rounded-lg bg-gradient-to-br from-[#2C5F6F] to-[#1A3A47] flex items-center justify-center text-white font-bold ${variant === 'compact' ? 'text-sm' : 'text-xl'} font-['Newsreader'] absolute inset-0 shadow-sm`}>
                    {initials}
                </div>
            </div>
        ) : (
            <div className={`${imageClass} rounded-lg bg-gradient-to-br from-[#2C5F6F] to-[#1A3A47] flex items-center justify-center text-white font-bold ${variant === 'directory' ? 'mx-auto' : ''} ${variant === 'compact' ? 'text-sm' : 'text-xl'} font-['Newsreader'] shadow-sm`}>
                {initials}
            </div>
        )
    }

    const renderAvailabilityStatus = () => {
        // Only show on directory variant
        if (variant !== 'directory') return null
        
        // Simple status - only show "Accepting New Patients" for bookable providers
        if (provider.is_bookable === false) return null
        
        return (
            <div className="mb-3">
                <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium font-['Newsreader'] bg-green-100 text-green-800">
                    <span className="w-2 h-2 rounded-full mr-2 bg-green-500"></span>
                    Accepting New Patients
                </span>
            </div>
        )
    }

    const renderSpecialties = () => {
        if (!showSpecialties || !provider.specialties?.length) return null

        const maxToShow = variant === 'compact' ? 1 : variant === 'calendar' ? 2 : 3
        
        return (
            <div className="mb-3">
                {variant !== 'compact' && (
                    <p className="text-xs text-[#091747]/60 mb-1 font-['Newsreader']">Specialties:</p>
                )}
                <div className="flex flex-wrap gap-1">
                    {provider.specialties.slice(0, maxToShow).map((specialty, index) => (
                        <span
                            key={index}
                            className="inline-block px-2 py-1 text-xs bg-[#BF9C73]/20 text-[#BF9C73] rounded font-['Newsreader']"
                        >
                            {specialty}
                        </span>
                    ))}
                    {provider.specialties.length > maxToShow && (
                        <span className="text-xs text-[#091747]/60 font-['Newsreader']">
                            +{provider.specialties.length - maxToShow} more
                        </span>
                    )}
                </div>
            </div>
        )
    }

    const renderLanguages = () => {
        if (!showLanguages || !provider.languages_spoken?.length) return null

        const maxToShow = variant === 'compact' ? 1 : 3
        
        return (
            <div className="mb-3">
                {variant !== 'compact' && (
                    <p className="text-xs text-[#091747]/60 mb-1 font-['Newsreader']">Languages:</p>
                )}
                <div className="flex flex-wrap gap-1">
                    {provider.languages_spoken.slice(0, maxToShow).map((language, index) => (
                        <span
                            key={index}
                            className="inline-block px-2 py-1 text-xs bg-[#FEF8F1] text-[#BF9C73] border border-[#BF9C73]/30 rounded font-['Newsreader']"
                        >
                            {language}
                        </span>
                    ))}
                    {provider.languages_spoken.length > maxToShow && (
                        <span className="text-xs text-[#091747]/60 font-['Newsreader']">
                            +{provider.languages_spoken.length - maxToShow} more
                        </span>
                    )}
                </div>
            </div>
        )
    }

    const renderLicensing = () => {
        if (!showLicensing || !provider.state_licenses?.length) return null
        
        return (
            <div className="mb-4">
                <p className="text-sm text-[#091747]/60 font-['Newsreader'] mb-1">Licensed in</p>
                <div className="flex flex-wrap gap-1">
                    {provider.state_licenses.map((license, index) => (
                        <span
                            key={index}
                            className="inline-block px-2 py-1 text-xs bg-[#BF9C73]/20 text-[#BF9C73] rounded font-['Newsreader']"
                        >
                            {license}
                        </span>
                    ))}
                </div>
            </div>
        )
    }


    const renderInsurance = () => {
        if (!showInsurance) return null
        
        return (
            <div className="mb-6">
                <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="flex flex-wrap gap-1">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-['Newsreader']">
                            Cash | Credit card | ACH
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-['Newsreader']">
                            Utah Medicaid Fee-for-Service
                        </span>
                    </div>
                </div>
            </div>
        )
    }

    const renderActionButton = () => {
        if (!actionButton) return null

        const buttonClass = actionButton.variant === 'secondary' 
            ? 'w-full mt-2 text-[#BF9C73] hover:text-[#A8865F] text-sm font-["Newsreader"] py-2 transition-colors'
            : 'w-full bg-[#BF9C73] hover:bg-[#A8865F] text-white py-3 px-4 rounded-lg font-["Newsreader"] text-center transition-colors'

        return (
            <button
                type="button"
                onClick={actionButton.onClick}
                className={buttonClass}
            >
                {actionButton.text}
            </button>
        )
    }

    const renderNextAvailable = () => {
        if (!provider.next_available) return null
        
        return (
            <p className="text-sm text-[#091747]/60 mb-3 font-['Newsreader']">
                Next available: {provider.next_available}
            </p>
        )
    }

    const renderMoreButton = (position: 'bottom' | 'bottom-right' = 'bottom') => {
        const lastName = provider.last_name || provider.first_name?.split(' ').pop() || ''
        const buttonText = lastName ? `About Dr. ${lastName}` : 'More'
        
        if (position === 'bottom-right') {
            return (
                <button
                    onClick={handleMoreClick}
                    className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 text-[#BF9C73] hover:text-[#A8865F] text-xs font-['Newsreader'] px-2 py-1 rounded transition-colors bg-white/80 hover:bg-white shadow-sm whitespace-nowrap"
                >
                    {buttonText}
                </button>
            )
        }
        
        return (
            <button
                onClick={handleMoreClick}
                className="w-full mt-2 text-[#BF9C73] hover:text-[#A8865F] text-sm font-['Newsreader'] py-2 transition-colors text-left"
            >
                {buttonText}
            </button>
        )
    }
    // Compact variant (for confirmation pages, inline displays)
    if (variant === 'compact') {
        return (
            <div className={`${currentConfig.containerClass} relative ${className} flex-wrap sm:flex-nowrap`} onClick={handleClick}>
                {renderImage()}
                <div className="flex-1 min-w-0">
                    <h4 className="text-xs sm:text-sm font-medium text-[#091747] font-['Newsreader'] leading-tight">
                        {displayName}
                    </h4>
                    {provider.title && (
                        <p className="text-xs text-[#091747]/70 font-['Newsreader']">
                            {provider.title}
                        </p>
                    )}
                </div>
                {customAction}
                <button
                    onClick={handleMoreClick}
                    className="ml-1 sm:ml-2 text-[#BF9C73] hover:text-[#A8865F] text-xs font-['Newsreader'] px-1 sm:px-2 py-1 transition-colors whitespace-nowrap"
                >
                    {provider.last_name ? `About Dr. ${provider.last_name}` : 'More'}
                </button>
            </div>
        )
    }

    // Directory variant (full provider directory page) - WITH MODAL INTEGRATION
    if (variant === 'directory') {
        return (
            <div
                className={`relative p-4 rounded-xl text-left transition-all duration-200 border-2 cursor-pointer ${
                    selected 
                        ? 'border-[#BF9C73] bg-[#FEF8F1] shadow-md'
                        : 'border-stone-200 hover:border-[#BF9C73]/50 hover:bg-stone-50'
                } ${className}`}
                onClick={handleClick}
            >
                <div className="flex items-center gap-3 mb-3">
                    <div className="flex-shrink-0">
                        {renderImage()}
                    </div>
                    <div className="flex-1"> {/* No right padding needed since no button overlap */}
                        <h4 className="font-bold text-[#091747] font-['Newsreader'] text-sm sm:text-base leading-tight">
                            Dr. {provider.first_name} {provider.last_name}
                        </h4>
                        <p className="text-xs sm:text-sm text-[#BF9C73] font-['Newsreader']">
                            {provider.title || provider.role || 'MD'}
                        </p>
                    </div>
                </div>
                <p className="text-xs sm:text-sm text-[#091747]/70 mb-2 font-['Newsreader'] leading-relaxed">
                    {provider.specialty}
                </p>
                <div className="flex flex-wrap gap-1 sm:gap-2"> {/* Clean layout without button padding */}
                    {/* Only show availability status if provider is bookable */}
                    {provider.is_bookable !== false && (
                        <span className={`px-2 py-1 text-xs rounded-full font-['Newsreader'] ${
                            (provider.availability && typeof provider.availability === 'string' && 
                             (provider.availability.toLowerCase().includes('accepting') || provider.availability.toLowerCase().includes('available'))) ||
                            provider.accepts_new_patients !== false
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-orange-100 text-orange-800'
                        }`}>
                            {(provider.availability && typeof provider.availability === 'string' ? provider.availability : null) || 
                             provider.new_patient_status || 
                             (provider.accepts_new_patients !== false ? 'Accepting New Patients' : 'Limited Availability')}
                        </span>
                    )}
                    <span className="px-2 py-1 bg-[#FEF8F1] text-[#BF9C73] border border-[#BF9C73]/30 text-xs rounded-full font-['Newsreader']">
                        {provider.provider_type || provider.role || 'provider'}
                    </span>
                </div>
                {/* Directory variant doesn't need About button since clicking card opens modal */}
            </div>
        )
    }

    // Other variants (selection, calendar, summary)
    return (
        <div className={`${currentConfig.containerClass} relative ${className}`} onClick={handleClick}>
            {/* Header with image and basic info */}
            <div className={`flex items-center ${variant === 'summary' ? 'space-x-3 sm:space-x-4' : 'gap-2 sm:gap-3 mb-3'}`}>
                <div className="flex-shrink-0">
                    {renderImage()}
                </div>
                <div className="flex-1 min-w-0 pr-12 sm:pr-16"> {/* Add padding to avoid button overlap */}
                    <h4 className={`font-bold text-[#2C5F6F] font-['Newsreader'] leading-tight ${
                        variant === 'calendar' ? 'text-xs sm:text-sm' : 'text-sm sm:text-base md:text-lg'
                    }`}>
                        {displayName}
                    </h4>
                    {provider.title && (
                        <p className={`text-[#8B7355] font-['Newsreader'] ${
                            variant === 'calendar' ? 'text-xs' : 'text-xs sm:text-sm'
                        }`}>
                            {provider.title}
                        </p>
                    )}
                    {variant === 'summary' && (
                        <p className="text-xs sm:text-sm text-[#8B7355] font-['Newsreader']">
                            Telehealth Appointment
                        </p>
                    )}
                </div>
            </div>

            {/* Details section */}
            {variant !== 'calendar' && (
                <div>
                    {renderAvailabilityStatus()}
                    {renderNextAvailable()}
                    {renderSpecialties()}
                    {renderLanguages()}
                    {renderActionButton()}
                    {customAction}
                </div>
            )}

            {/* Calendar variant shows minimal info */}
            {variant === 'calendar' && (
                <div className="pr-12 sm:pr-16"> {/* Add padding to avoid button overlap */}
                    {provider.specialty && (
                        <p className="text-xs sm:text-sm text-[#8B7355] mb-2 font-['Newsreader'] leading-relaxed">
                            {provider.specialty}
                        </p>
                    )}
                    <div className="flex flex-wrap gap-1 sm:gap-2">
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-lg font-['Newsreader'] whitespace-nowrap">
                            {provider.new_patient_status || 'Accepting New Patients'}
                        </span>
                        <span className="px-2 py-1 bg-[#FEF8F1] text-[#BF9C73] border border-[#BF9C73]/30 text-xs rounded-lg font-['Newsreader'] whitespace-nowrap">
                            {provider.languages_spoken?.[0] || 'English'}
                        </span>
                    </div>
                    {customAction}
                </div>
            )}
            
            {/* About Dr. X button positioned in bottom right */}
            {renderMoreButton('bottom-right')}
        </div>
    )
}

// Export the Provider type for use in other components
export type { Provider }