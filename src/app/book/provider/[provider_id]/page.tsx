'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import BookingFlow from '@/components/booking/BookingFlow'
import { Provider } from '@/types/provider'

// Force this route to be dynamic so middleware can run
export const dynamic = 'force-dynamic'

export default function ProviderSpecificBookingPage() {
    const params = useParams()
    const searchParams = useSearchParams()
    const provider_id = params.provider_id as string
    const intent = searchParams.get('intent') || 'book'

    const [provider, setProvider] = useState<Provider | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchProvider = async () => {
            try {
                // Fetch the specific provider details
                const response = await fetch(`/api/providers/${provider_id}`)
                
                if (!response.ok) {
                    throw new Error('Provider not found')
                }
                
                const data = await response.json()
                setProvider(data.provider)
            } catch (err) {
                console.error('Failed to fetch provider:', err)
                setError(err instanceof Error ? err.message : 'Failed to load provider')
            } finally {
                setLoading(false)
            }
        }

        if (provider_id) {
            fetchProvider()
        }
    }, [provider_id])

    if (loading) {
        return (
            <div className="min-h-screen bg-[#FEF8F1] flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-2 border-[#BF9C73] border-t-transparent mx-auto mb-4"></div>
                    <p className="text-[#091747] font-['Newsreader']">Loading provider information...</p>
                </div>
            </div>
        )
    }

    if (error || !provider) {
        return (
            <div className="min-h-screen bg-[#FEF8F1] flex items-center justify-center">
                <div className="text-center max-w-md mx-auto p-8">
                    <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-['Newsreader'] text-[#091747] mb-4">Provider Not Found</h1>
                    <p className="text-[#091747]/70 font-['Newsreader'] mb-6">
                        {error || 'The provider you are looking for could not be found.'}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={() => window.location.href = '/practitioners'}
                            className="px-6 py-3 bg-[#BF9C73] hover:bg-[#A8865F] text-white rounded-lg font-['Newsreader'] transition-colors"
                        >
                            Browse All Practitioners
                        </button>
                        <button
                            onClick={() => window.location.href = '/book'}
                            className="px-6 py-3 bg-white hover:bg-[#FEF8F1] text-[#091747] rounded-lg font-['Newsreader'] border-2 border-[#BF9C73] transition-colors"
                        >
                            General Booking
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#FEF8F1]">
            {/* Provider-specific header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center gap-4">
                        {/* Provider image/initials */}
                        <div className="flex-shrink-0">
                            {provider.profile_image_url ? (
                                <img
                                    src={provider.profile_image_url}
                                    alt={`Dr. ${provider.first_name} ${provider.last_name}`}
                                    className="w-16 h-20 rounded-lg object-cover shadow-sm"
                                />
                            ) : (
                                <div className="w-16 h-20 rounded-lg bg-gradient-to-br from-[#2C5F6F] to-[#1A3A47] flex items-center justify-center text-white font-bold text-xl font-['Newsreader'] shadow-sm">
                                    {provider.first_name?.charAt(0)}{provider.last_name?.charAt(0)}
                                </div>
                            )}
                        </div>
                        
                        {/* Provider info */}
                        <div>
                            <h1 className="text-3xl font-['Newsreader'] text-[#091747] font-normal">
                                Book with Dr. {provider.first_name} {provider.last_name}
                            </h1>
                            {provider.title && (
                                <p className="text-lg text-[#BF9C73] font-['Newsreader'] mt-1">
                                    {provider.title}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Booking flow */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <BookingFlow 
                    selectedProviderId={provider.id}
                    selectedProvider={provider}
                    providerSpecific={true}
                    intent={intent as 'book' | 'explore'}
                />
            </div>
        </div>
    )
}