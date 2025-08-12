'use client'

import { Payer } from '@/types/database'
import { useEffect, useState } from 'react'

interface Provider {
    id: string
    first_name: string
    last_name: string
    title: string
    profile_image_url?: string
    bio?: string
    specialties?: string[]
    languages_spoken?: string[]
    accepts_new_patients: boolean
    next_available?: string
}

interface ProviderSelectionViewProps {
    selectedPayer: Payer
    onProviderSelected: (providerId: string) => void
    onBackToMergedCalendar: () => void
    onBack: () => void
}

export default function ProviderSelectionView({
    selectedPayer,
    onProviderSelected,
    onBackToMergedCalendar,
    onBack
}: ProviderSelectionViewProps) {
    const [providers, setProviders] = useState<Provider[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchProvidersForPayer()
    }, [selectedPayer.id])

    const fetchProvidersForPayer = async () => {
        try {
            setLoading(true)
            setError(null)

            const response = await fetch(`/api/patient-booking/providers-for-payer?payer_id=${selectedPayer.id}`)
            
            if (!response.ok) {
                throw new Error('Failed to fetch providers')
            }

            const data = await response.json()
            
            if (data.success) {
                setProviders(data.providers)
            } else {
                throw new Error(data.error || 'Failed to load providers')
            }
        } catch (err) {
            console.error('Error fetching providers:', err)
            setError(err instanceof Error ? err.message : 'Failed to load providers')
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#1a2c5b] to-[#2d4a7c] flex items-center justify-center">
                <div className="text-white text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                    <p>Finding providers who accept {selectedPayer.name}...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#1a2c5b] to-[#2d4a7c] flex items-center justify-center">
                <div className="text-white text-center">
                    <p className="mb-4">{error}</p>
                    <button
                        type="button"
                        onClick={onBack}
                        className="px-6 py-3 bg-white text-[#1a2c5b] rounded-xl font-medium hover:bg-gray-100 transition-colors"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#1a2c5b] to-[#2d4a7c]">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="text-white text-center mb-8">
                    <h1 className="text-4xl font-bold mb-4">Choose Your Provider</h1>
                    <p className="text-xl opacity-90 mb-6">
                        All of these providers accept {selectedPayer.name}
                    </p>
                    
                    {/* View Toggle */}
                    <div className="flex items-center justify-center gap-4 mb-6">
                        <button
                            type="button"
                            onClick={onBackToMergedCalendar}
                            className="px-6 py-2 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-colors"
                        >
                            ← Back to Merged Calendar
                        </button>
                        <span className="text-white/60">|</span>
                        <span className="text-white/90">Choose Individual Provider</span>
                    </div>
                </div>

                {/* Provider Grid */}
                <div className="max-w-6xl mx-auto">
                    {providers.length === 0 ? (
                        <div className="text-white text-center">
                            <p className="text-xl mb-4">No providers currently accept {selectedPayer.name}</p>
                            <button
                                type="button"
                                onClick={onBack}
                                className="px-6 py-3 bg-white text-[#1a2c5b] rounded-xl font-medium hover:bg-gray-100 transition-colors"
                            >
                                Choose Different Insurance
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {providers.map((provider) => (
                                <ProviderCard
                                    key={provider.id}
                                    provider={provider}
                                    onSelect={() => onProviderSelected(provider.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Back Button */}
                <div className="text-center mt-8">
                    <button
                        type="button"
                        onClick={onBack}
                        className="px-6 py-3 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-colors"
                    >
                        ← Back to Insurance Selection
                    </button>
                </div>
            </div>
        </div>
    )
}

interface ProviderCardProps {
    provider: Provider
    onSelect: () => void
}

function ProviderCard({ provider, onSelect }: ProviderCardProps) {
    return (
        <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            {/* Provider Image */}
            <div className="flex justify-center mb-4">
                {provider.profile_image_url ? (
                    <img
                        src={provider.profile_image_url}
                        alt={`${provider.first_name} ${provider.last_name}`}
                        className="w-20 h-20 rounded-full object-cover"
                    />
                ) : (
                    <div className="w-20 h-20 rounded-full bg-[#BF9C73] flex items-center justify-center text-white font-bold text-xl">
                        {provider.first_name.charAt(0)}{provider.last_name.charAt(0)}
                    </div>
                )}
            </div>

            {/* Provider Info */}
            <div className="text-center mb-4">
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {provider.first_name} {provider.last_name}
                </h3>
                {provider.title && (
                    <p className="text-gray-600 mb-2">{provider.title}</p>
                )}
                
                {/* Availability Status */}
                <div className="flex items-center justify-center mb-3">
                    {provider.accepts_new_patients ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Accepting New Patients
                        </span>
                    ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Limited Availability
                        </span>
                    )}
                </div>

                {/* Next Available */}
                {provider.next_available && (
                    <p className="text-sm text-gray-600 mb-3">
                        Next available: {provider.next_available}
                    </p>
                )}

                {/* Languages */}
                {provider.languages_spoken && provider.languages_spoken.length > 0 && (
                    <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-1">Languages:</p>
                        <div className="flex flex-wrap justify-center gap-1">
                            {provider.languages_spoken.slice(0, 3).map((language, index) => (
                                <span
                                    key={index}
                                    className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                                >
                                    {language}
                                </span>
                            ))}
                            {provider.languages_spoken.length > 3 && (
                                <span className="text-xs text-gray-500">
                                    +{provider.languages_spoken.length - 3} more
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Specialties */}
                {provider.specialties && provider.specialties.length > 0 && (
                    <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-1">Specialties:</p>
                        <div className="flex flex-wrap justify-center gap-1">
                            {provider.specialties.slice(0, 2).map((specialty, index) => (
                                <span
                                    key={index}
                                    className="inline-block px-2 py-1 text-xs bg-[#BF9C73]/20 text-[#BF9C73] rounded"
                                >
                                    {specialty}
                                </span>
                            ))}
                            {provider.specialties.length > 2 && (
                                <span className="text-xs text-gray-500">
                                    +{provider.specialties.length - 2} more
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Select Button */}
            <button
                type="button"
                onClick={onSelect}
                className="w-full bg-[#BF9C73] text-white py-3 rounded-xl font-medium hover:bg-[#A8865F] transition-colors"
            >
                View {provider.first_name}'s Calendar
            </button>
        </div>
    )
}