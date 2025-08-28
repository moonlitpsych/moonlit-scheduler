'use client'

import { ReactNode, useState, useEffect } from 'react'

export interface Provider {
    id: string
    first_name: string
    last_name: string
    full_name?: string // Some APIs return this directly
    title?: string
    profile_image_url?: string
    bio?: string
    specialties?: string[]
    languages_spoken?: string[]
    accepts_new_patients?: boolean
    new_patient_status?: string // From booking flow
    next_available?: string
    state_licenses?: string[]
    accepted_insurances?: string[]
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
    const displayName = provider.full_name || `${provider.first_name} ${provider.last_name}`
    const initials = `${provider.first_name.charAt(0)}${provider.last_name.charAt(0)}`

    // Variant-specific configurations with brand colors
    const config = {
        selection: {
            containerClass: 'bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden',
            showSpecialties: true,
            showLanguages: true,
            showAvailability: true
        },
        calendar: {
            containerClass: `rounded-xl text-left transition-all duration-200 border-2 overflow-hidden ${
                selected 
                    ? 'border-[#2C5F6F] bg-[#F8F6F1] shadow-md' 
                    : 'border-stone-200 hover:border-[#2C5F6F]/50 hover:bg-stone-50'
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
            containerClass: 'bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 border border-[#F0F0F0] overflow-hidden',
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
        }
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
        // Define image dimensions for different variants
        const imageDimensions = {
            selection: 'w-20 h-24',      // 20x24 portrait rectangle
            calendar: 'w-12 h-14',       // 12x14 smaller rectangle  
            summary: 'w-16 h-20',        // 16x20 medium rectangle
            directory: 'w-24 h-28',      // 24x28 larger rectangle for main page
            compact: 'w-10 h-12'         // 10x12 smallest rectangle
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
        if (!showAvailability || variant === 'directory') return null // Directory handles this differently

        const status = provider.new_patient_status || (provider.accepts_new_patients ? 'Accepting New Patients' : 'Limited Availability')
        const isAccepting = provider.accepts_new_patients !== false
        
        return (
            <div className="mb-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium font-['Newsreader'] ${
                    isAccepting 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-orange-100 text-orange-800'
                }`}>
                    <span className={`w-2 h-2 rounded-full mr-2 ${isAccepting ? 'bg-green-500' : 'bg-orange-500'}`}></span>
                    {status}
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
                            className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded font-['Newsreader']"
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

    // State for insurance data
    const [insuranceData, setInsuranceData] = useState<any>(null)
    const [loadingInsurance, setLoadingInsurance] = useState(false)

    // Fetch insurance data for directory variant
    useEffect(() => {
        if (variant === 'directory' && provider.id) {
            setLoadingInsurance(true)
            fetch(`/api/providers/${provider.id}/insurance`)
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        setInsuranceData(data.data)
                    }
                })
                .catch(err => console.error('Failed to load insurance data:', err))
                .finally(() => setLoadingInsurance(false))
        }
    }, [provider.id, variant])

    const renderInsuranceInfo = () => {
        if (variant !== 'directory') return null
        
        return (
            <div className="mb-8">
                <h4 className="text-sm font-medium text-[#091747] mb-3 font-['Newsreader']">Ways You Can Pay</h4>
                {loadingInsurance ? (
                    <div className="flex items-center gap-2 text-sm text-[#8B7355] font-['Newsreader']">
                        <div className="w-4 h-4 border-2 border-[#BF9C73] border-t-transparent rounded-full animate-spin"></div>
                        Loading insurance information...
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {/* Self-pay options */}
                        <span className="px-4 py-2 bg-[#FEF8F1] text-[#BF9C73] border border-[#E6D7C3] text-sm rounded-lg font-['Newsreader']">
                            Cash | Credit | ACH
                        </span>
                        
                        {/* Medicaid plans */}
                        {insuranceData?.insurance_types?.medicaid?.length > 0 && (
                            <span className="px-4 py-2 bg-[#F8F6F1] text-[#8B7355] border border-[#E6D7C3] text-sm rounded-lg font-['Newsreader']">
                                Utah Medicaid Fee-for-Service
                            </span>
                        )}
                        
                        {/* Commercial plans */}
                        {insuranceData?.insurance_types?.commercial?.length > 0 && (
                            <span className="px-4 py-2 bg-[#F8F6F1] text-[#8B7355] border border-[#E6D7C3] text-sm rounded-lg font-['Newsreader']">
                                Most Major Insurance Plans
                            </span>
                        )}
                        
                        {/* Fallback if no data */}
                        {!insuranceData && !loadingInsurance && (
                            <span className="px-4 py-2 bg-[#F8F6F1] text-[#8B7355] border border-[#E6D7C3] text-sm rounded-lg font-['Newsreader']">
                                Most Major Insurance Plans
                            </span>
                        )}
                    </div>
                )}
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

    // Compact variant (for confirmation pages, inline displays)
    if (variant === 'compact') {
        return (
            <div className={`${currentConfig.containerClass} ${className}`} onClick={handleClick}>
                {renderImage()}
                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-[#091747] font-['Newsreader']">
                        {displayName}
                    </h4>
                    {provider.title && (
                        <p className="text-xs text-[#091747]/70 font-['Newsreader']">
                            {provider.title}
                        </p>
                    )}
                </div>
                {customAction}
            </div>
        )
    }

    // Directory variant (full provider directory page) - HORIZONTAL LAYOUT
    if (variant === 'directory') {
        return (
            <div className={`${currentConfig.containerClass} ${className}`} onClick={handleClick}>
                {/* True Horizontal Layout with Image Left, Content Right */}
                <div className="flex items-start gap-8 p-8">
                    {/* Left: Provider Image */}
                    <div className="flex-shrink-0">
                        {renderImage()}
                    </div>

                    {/* Right: Provider Information */}
                    <div className="flex-1 min-w-0">
                        {/* Header with Name and Role */}
                        <div className="mb-6">
                            <h3 className="text-3xl font-['Newsreader'] text-[#091747] font-normal mb-2">
                                Dr. {provider.first_name} {provider.last_name}
                            </h3>
                            {provider.title && (
                                <p className="text-[#BF9C73] text-xl font-['Newsreader'] mb-3">
                                    {provider.title}
                                </p>
                            )}
                            
                            {/* Role Badge */}
                            {provider.role && (
                                <span className="inline-block px-4 py-2 bg-[#FEF8F1] text-[#BF9C73] border border-[#BF9C73] text-sm font-medium rounded-full font-['Newsreader']">
                                    {provider.role}
                                </span>
                            )}
                        </div>

                        {/* Accepting New Patients */}
                        {provider.accepts_new_patients && (
                            <div className="mb-6">
                                <div className="inline-flex items-center px-4 py-2 bg-[#F0F8F0] text-[#2D5016] rounded-lg font-['Newsreader'] text-sm font-medium border border-[#9BC53D]/30">
                                    <span className="w-2 h-2 bg-[#4CAF50] rounded-full mr-2"></span>
                                    Accepting new patients
                                </div>
                            </div>
                        )}

                        {/* Insurance Information - Real data from database */}
                        {renderInsuranceInfo()}

                        {/* Action Buttons */}
                        <div className="flex gap-4">
                            {actionButton && (
                                <button
                                    type="button"
                                    onClick={actionButton.onClick}
                                    className="bg-[#BF9C73] hover:bg-[#A8865F] text-white py-3 px-8 rounded-xl font-['Newsreader'] text-center transition-colors font-medium text-lg shadow-sm"
                                >
                                    {actionButton.text}
                                </button>
                            )}
                            {customAction && (
                                <div className="flex-1">
                                    {customAction}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Other variants (selection, calendar, summary)
    return (
        <div className={`${currentConfig.containerClass} ${className}`} onClick={handleClick}>
            {/* Header with image and basic info */}
            <div className={`flex items-center ${variant === 'summary' ? 'space-x-4' : 'gap-3 mb-3'}`}>
                <div className="flex-shrink-0">
                    {renderImage()}
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className={`font-bold text-[#2C5F6F] font-['Newsreader'] ${
                        variant === 'calendar' ? 'text-sm' : 'text-lg'
                    }`}>
                        {displayName}
                    </h4>
                    {provider.title && (
                        <p className={`text-[#8B7355] font-['Newsreader'] ${
                            variant === 'calendar' ? 'text-xs' : 'text-sm'
                        }`}>
                            {provider.title}
                        </p>
                    )}
                    {variant === 'summary' && (
                        <p className="text-sm text-[#8B7355] font-['Newsreader']">
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
                <div>
                    {provider.specialty && (
                        <p className="text-sm text-[#8B7355] mb-2 font-['Newsreader']">
                            {provider.specialty}
                        </p>
                    )}
                    <div className="flex gap-2">
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-lg font-['Newsreader']">
                            {provider.new_patient_status || 'Accepting New Patients'}
                        </span>
                        <span className="px-2 py-1 bg-[#E6D7C3] text-[#8B7355] text-xs rounded-lg font-['Newsreader']">
                            {provider.languages_spoken?.[0] || 'English'}
                        </span>
                    </div>
                    {customAction}
                </div>
            )}
        </div>
    )
}

// Export the Provider type for use in other components
export type { Provider }