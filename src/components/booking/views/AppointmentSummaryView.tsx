'use client'

import { InsuranceInfo, Payer, ROIContact, TimeSlot } from '@/types/database'
import { useEffect, useState } from 'react'
import { BookingScenario } from '../BookingFlow'
import { LEGAL_VERSION } from '@/lib/constants'

interface Provider {
    id: string
    first_name: string
    last_name: string
    title?: string
    profile_image_url?: string
    bio?: string
    specialties?: string[]
    languages_spoken?: string[]
    accepts_new_patients: boolean
    next_available?: string
}

interface AppointmentSummaryViewProps {
    selectedPayer?: Payer
    selectedTimeSlot?: TimeSlot
    insuranceInfo?: InsuranceInfo
    roiContacts: ROIContact[]
    bookingScenario: BookingScenario
    provider?: Provider
    onConfirmBooking: () => void
    onEditInsurance: () => void
    onEditTimeSlot: () => void
    onEditROI: () => void
    onBack: () => void
}

export default function AppointmentSummaryView({
    selectedPayer,
    selectedTimeSlot,
    insuranceInfo,
    roiContacts,
    bookingScenario,
    provider,
    onConfirmBooking,
    onEditInsurance,
    onEditTimeSlot,
    onEditROI,
    onBack
}: AppointmentSummaryViewProps) {
    const [fetchedProvider, setFetchedProvider] = useState<Provider | null>(null)
    const [providerLoading, setProviderLoading] = useState(false)
    
    // Debug logging to understand the data structure
    useEffect(() => {
        console.log('🔍 AppointmentSummaryView props:', {
            selectedTimeSlot,
            selectedPayer,
            provider,
            timeSlotProviderId: selectedTimeSlot?.provider_id
        })
    }, [selectedTimeSlot, selectedPayer, provider])
    console.log('🔍 AppointmentSummaryView Debug:', {
        selectedTimeSlot: selectedTimeSlot ? JSON.stringify(selectedTimeSlot, null, 2) : 'undefined',
        selectedPayer: selectedPayer ? JSON.stringify(selectedPayer, null, 2) : 'undefined',
        provider: provider ? JSON.stringify(provider, null, 2) : 'undefined',
        fetchedProvider: fetchedProvider ? JSON.stringify(fetchedProvider, null, 2) : 'undefined',
        providerId: selectedTimeSlot?.provider_id
    })

    // Fetch provider information if we have a provider_id
    useEffect(() => {
        const fetchProviderInfo = async () => {
            // Extract provider ID from various possible structures
            let providerId = null
            
            if (selectedTimeSlot) {
                // Try different provider ID extraction methods
                providerId = selectedTimeSlot.provider_id || 
                           selectedTimeSlot.providerId ||
                           selectedTimeSlot.providers?.[0]?.id ||
                           selectedTimeSlot.available_providers?.[0]?.id
                           
                console.log('🔍 Complete selectedTimeSlot structure:', selectedTimeSlot)
                console.log('🔍 selectedTimeSlot keys:', selectedTimeSlot ? Object.keys(selectedTimeSlot) : 'No keys - selectedTimeSlot is null/undefined')
                console.log('🔍 Attempting to extract provider ID:', {
                    provider_id: selectedTimeSlot.provider_id,
                    providerId: selectedTimeSlot.providerId,
                    providers: selectedTimeSlot.providers,
                    available_providers: selectedTimeSlot.available_providers,
                    extractedProviderId: providerId
                })
            }
            
            if (!providerId || provider || fetchedProvider) {
                console.log('🔍 Skipping provider fetch:', { providerId, hasProvider: !!provider, hasFetched: !!fetchedProvider })
                return
            }

            setProviderLoading(true)
            try {
                console.log('🔍 Fetching provider info for ID:', providerId)
                
                // First, let's try to fetch the provider directly if we have the provider_id
                // We'll need to create a proper API endpoint or use an existing one
                const response = await fetch('/api/patient-booking/providers-for-payer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        payer_id: selectedPayer?.id,
                        provider_id: providerId 
                    })
                })
                
                if (!response.ok) {
                    throw new Error('Failed to fetch provider')
                }

                const data = await response.json()
                console.log('🔍 Provider API response:', JSON.stringify(data, null, 2))
                
                // Handle different response structures
                let providers = []
                if (data.success) {
                    providers = data.providers || data.data?.providers || data.data || []
                }
                
                if (providers.length > 0) {
                    // Find the specific provider by ID
                    const matchingProvider = providers.find(p => p.id === providerId)
                    if (matchingProvider) {
                        console.log('✅ Found matching provider:', matchingProvider)
                        setFetchedProvider(matchingProvider)
                    } else if (providers.length > 0) {
                        console.log('✅ Using first provider:', providers[0])
                        setFetchedProvider(providers[0])
                    }
                } else {
                    console.log('❌ No providers found in response')
                }
            } catch (error) {
                console.error('❌ Failed to fetch provider:', error)
            } finally {
                setProviderLoading(false)
            }
        }

        fetchProviderInfo()
    }, [selectedTimeSlot, selectedPayer?.id, provider, fetchedProvider])

    // Use fetched provider if available, otherwise use passed provider
    const displayProvider = provider || fetchedProvider
    const formatDateTime = (startTime: string) => {
        try {
            // startTime is in format "2024-08-27T14:00:00" - same as ConfirmationView
            const dateObj = new Date(startTime)
            
            // Check if date is valid
            if (isNaN(dateObj.getTime())) {
                console.error('Invalid date:', startTime)
                return 'Invalid date/time'
            }
            
            return dateObj.toLocaleString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            })
        } catch (error) {
            console.error('Error formatting date:', error, startTime)
            return 'Invalid date/time'
        }
    }

    const getScenarioTitle = () => {
        switch (bookingScenario) {
            case 'self':
                return 'Review Your Appointment'
            case 'third-party':
                return 'Review Patient Appointment'
            case 'case-manager':
                return 'Review Case Management Appointment'
            default:
                return 'Review Appointment Details'
        }
    }

    const getSubmitButtonText = () => {
        switch (bookingScenario) {
            case 'self':
                return 'Confirm My Appointment'
            case 'third-party':
                return 'Submit Booking Request'
            case 'case-manager':
                return 'Confirm Patient Appointment'
            default:
                return 'Submit Booking Request'
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1]">
            <div className="max-w-6xl mx-auto px-4 py-8 sm:py-16">
                {/* Header */}
                <div className="text-center mb-8 sm:mb-12">
                    <h1 className="text-3xl sm:text-4xl font-bold text-[#091747] mb-4 sm:mb-6 font-['Newsreader']">
                        {getScenarioTitle()}
                    </h1>
                    <p className="text-lg sm:text-xl text-[#091747]/70 font-['Newsreader']">
                        Please review all details before confirming your appointment
                    </p>
                </div>

                {/* Summary Card */}
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                        
                        {/* Appointment Details Section */}
                        <div className="p-6 sm:p-8 border-b border-gray-200">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl sm:text-2xl font-bold text-[#091747] font-['Newsreader']">Appointment Details</h2>
                                <button
                                    type="button"
                                    onClick={onEditTimeSlot}
                                    className="text-[#BF9C73] hover:text-[#A8865F] text-sm font-medium transition-colors font-['Newsreader']"
                                >
                                    Edit Time
                                </button>
                            </div>

                            {selectedTimeSlot && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <h3 className="text-lg font-semibold text-[#091747] mb-2 font-['Newsreader']">Date & Time</h3>
                                        <p className="text-[#091747]/90 text-lg font-['Newsreader']">
                                            {formatDateTime(selectedTimeSlot.start_time)}
                                        </p>
                                        {selectedTimeSlot.duration_minutes && (
                                            <p className="text-sm text-[#091747]/60 mt-1 font-['Newsreader']">
                                                Duration: {selectedTimeSlot.duration_minutes} minutes
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-semibold text-[#091747] mb-4 font-['Newsreader']">Your Provider</h3>
                                        {displayProvider ? (
                                            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                                                {/* Provider Image */}
                                                <div className="flex items-start space-x-4">
                                                    <div className="flex-shrink-0">
                                                        {displayProvider.profile_image_url ? (
                                                            <img
                                                                src={displayProvider.profile_image_url}
                                                                alt={`${displayProvider.first_name} ${displayProvider.last_name}`}
                                                                className="w-16 h-16 rounded-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-16 h-16 rounded-full bg-[#BF9C73] flex items-center justify-center text-white font-bold text-lg font-['Newsreader']">
                                                                {displayProvider.first_name.charAt(0)}{displayProvider.last_name.charAt(0)}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Provider Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-lg font-bold text-[#091747] font-['Newsreader']">
                                                            {displayProvider.first_name} {displayProvider.last_name}
                                                        </h4>
                                                        {displayProvider.title && (
                                                            <p className="text-[#091747]/70 text-sm mb-2 font-['Newsreader']">{displayProvider.title}</p>
                                                        )}
                                                        
                                                        {/* Specialties */}
                                                        {displayProvider.specialties && displayProvider.specialties.length > 0 && (
                                                            <div className="mb-2">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {displayProvider.specialties.slice(0, 3).map((specialty, index) => (
                                                                        <span
                                                                            key={index}
                                                                            className="inline-block px-2 py-1 text-xs bg-[#BF9C73]/20 text-[#BF9C73] rounded font-['Newsreader']"
                                                                        >
                                                                            {specialty}
                                                                        </span>
                                                                    ))}
                                                                    {displayProvider.specialties.length > 3 && (
                                                                        <span className="text-xs text-[#091747]/60 font-['Newsreader']">
                                                                            +{displayProvider.specialties.length - 3} more
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Languages */}
                                                        {displayProvider.languages_spoken && displayProvider.languages_spoken.length > 0 && (
                                                            <div className="mb-2">
                                                                <p className="text-xs text-[#091747]/60 mb-1 font-['Newsreader']">Languages:</p>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {displayProvider.languages_spoken.slice(0, 3).map((language, index) => (
                                                                        <span
                                                                            key={index}
                                                                            className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded font-['Newsreader']"
                                                                        >
                                                                            {language}
                                                                        </span>
                                                                    ))}
                                                                    {displayProvider.languages_spoken.length > 3 && (
                                                                        <span className="text-xs text-[#091747]/60 font-['Newsreader']">
                                                                            +{displayProvider.languages_spoken.length - 3} more
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        <p className="text-sm text-[#091747]/60 font-['Newsreader']">
                                                            Telehealth Appointment
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                {providerLoading ? (
                                                    <div className="flex items-center space-x-2">
                                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#BF9C73] border-t-transparent"></div>
                                                        <p className="text-[#091747]/70 font-['Newsreader']">Loading provider information...</p>
                                                    </div>
                                                ) : (
                                                    <p className="text-[#091747]/70 font-['Newsreader']">
                                                        {selectedTimeSlot?.provider_name || 'Provider information not available'}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Insurance Information Section */}
                        <div className="p-6 sm:p-8 border-b border-gray-200">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl sm:text-2xl font-bold text-[#091747] font-['Newsreader']">Insurance Information</h2>
                                <button
                                    type="button"
                                    onClick={onEditInsurance}
                                    className="text-[#BF9C73] hover:text-[#A8865F] text-sm font-medium transition-colors font-['Newsreader']"
                                >
                                    Edit Insurance
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-[#091747] mb-2 font-['Newsreader']">Insurance Provider</h3>
                                    <p className="text-[#091747]/70 font-['Newsreader']">
                                        {selectedPayer?.name || 'Cash Payment'}
                                    </p>
                                </div>

                                {selectedPayer && selectedPayer.id !== 'cash-payment' && (
                                    <div>
                                        <h3 className="text-lg font-semibold text-[#091747] mb-2 font-['Newsreader']">Status</h3>
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 font-['Newsreader']">
                                            Verified & Accepted
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Patient Information Section */}
                        {insuranceInfo && (
                            <div className="p-6 sm:p-8 border-b border-gray-200">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl sm:text-2xl font-bold text-[#091747] font-['Newsreader']">
                                        {bookingScenario === 'self' ? 'Your Information' : 'Patient Information'}
                                    </h2>
                                    <button
                                        type="button"
                                        onClick={onEditInsurance}
                                        className="text-[#BF9C73] hover:text-[#A8865F] text-sm font-medium transition-colors font-['Newsreader']"
                                    >
                                        Edit Details
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-[#091747]/60 font-['Newsreader']">Name</p>
                                        <p className="text-[#091747] font-medium font-['Newsreader']">
                                            {insuranceInfo.firstName} {insuranceInfo.lastName}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-[#091747]/60 font-['Newsreader']">Phone</p>
                                        <p className="text-[#091747] font-['Newsreader']">{insuranceInfo.phone}</p>
                                    </div>
                                    {insuranceInfo.email && (
                                        <div>
                                            <p className="text-sm text-[#091747]/60 font-['Newsreader']">Email</p>
                                            <p className="text-[#091747] font-['Newsreader']">{insuranceInfo.email}</p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-sm text-[#091747]/60 font-['Newsreader']">Date of Birth</p>
                                        <p className="text-[#091747] font-['Newsreader']">{insuranceInfo.dob}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ROI Information Section */}
                        {roiContacts.length > 0 && (
                            <div className="p-6 sm:p-8 border-b border-gray-200">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl sm:text-2xl font-bold text-[#091747] font-['Newsreader']">Release of Information</h2>
                                    <button
                                        type="button"
                                        onClick={onEditROI}
                                        className="text-[#BF9C73] hover:text-[#A8865F] text-sm font-medium transition-colors font-['Newsreader']"
                                    >
                                        Edit ROI
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {roiContacts.map((contact, index) => (
                                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div>
                                                    <p className="text-sm text-[#091747]/60 font-['Newsreader']">Name</p>
                                                    <p className="text-[#091747] font-['Newsreader']">{contact.name}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-[#091747]/60 font-['Newsreader']">Relationship</p>
                                                    <p className="text-[#091747] font-['Newsreader']">{contact.relationship}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-[#091747]/60 font-['Newsreader']">Contact</p>
                                                    <p className="text-[#091747] font-['Newsreader']">{contact.phone || contact.email}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Action Buttons */}
                    <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            type="button"
                            onClick={onBack}
                            className="px-8 py-4 bg-white hover:bg-[#FEF8F1] text-[#091747] font-medium text-lg rounded-xl transition-all duration-200 hover:shadow-lg hover:scale-[1.01] border-2 border-[#BF9C73] hover:border-[#B8936A] font-['Newsreader'] cursor-pointer"
                        >
                            ← Back to Previous Step
                        </button>
                        
                        <button
                            type="button"
                            onClick={onConfirmBooking}
                            className="px-12 py-4 bg-[#BF9C73] hover:bg-[#B8936A] text-white font-semibold text-lg rounded-xl transition-all duration-200 hover:shadow-lg hover:scale-[1.01] border-2 border-[#BF9C73] hover:border-[#B8936A] font-['Newsreader'] cursor-pointer"
                        >
                            {getSubmitButtonText()}
                        </button>
                    </div>

                    {/* Terms Notice */}
                    <div className="mt-6 text-center">
                        <p className="text-[#091747]/60 text-sm font-['Newsreader']">
                            By confirming this appointment, you agree to our{' '}
                            <a href={`/legal/terms?v=${LEGAL_VERSION}`} className="text-[#BF9C73] hover:text-[#091747] underline">
                                Terms of Service
                            </a>{' '}
                            and{' '}
                            <a href={`/legal/privacy?v=${LEGAL_VERSION}`} className="text-[#BF9C73] hover:text-[#091747] underline">
                                Privacy Policy
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}