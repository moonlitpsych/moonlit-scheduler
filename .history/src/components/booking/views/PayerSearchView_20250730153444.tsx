// src/components/booking/views/PayerSearchView.tsx
'use client'

import { useState, useEffect } from 'react'
import { Payer } from '@/types/database'
import { BookingScenario } from './WelcomeView'
import { Search, Loader2, Calendar, CheckCircle } from 'lucide-react'

interface PayerSearchViewProps {
    onPayerSelected: (payer: Payer, acceptanceStatus: 'not-accepted' | 'future' | 'active') => void
    bookingScenario: BookingScenario
}

// Mock payer search function - replace with actual Supabase query
const searchPayers = async (query: string): Promise<Payer[]> => {
    // This would be replaced with actual Supabase search
    const mockPayers: Payer[] = [
        { id: '1', name: 'Aetna', requires_attending: false, credentialing_status: 'active' },
        { id: '2', name: 'Blue Cross Blue Shield', requires_attending: false, credentialing_status: 'active' },
        { id: '3', name: 'Cigna', requires_attending: true, credentialing_status: 'active' },
        { id: '4', name: 'United Healthcare', requires_attending: false, credentialing_status: 'active' },
        // This one will trigger the error for testing
        { id: '5', name: 'Regence BlueCross BlueShield', requires_attending: false, credentialing_status: 'not_accepted' }
    ]

    return mockPayers.filter(payer =>
        payer.name.toLowerCase().includes(query.toLowerCase())
    )
}

interface SearchState {
    query: string
    results: Payer[]
    loading: boolean
    showResults: boolean
    processingState: 'idle' | 'celebrating' | 'searching' | 'transitioning'
}

export default function PayerSearchView({ onPayerSelected, bookingScenario }: PayerSearchViewProps) {
    const [state, setState] = useState<SearchState>({
        query: '',
        results: [],
        loading: false,
        showResults: false,
        processingState: 'idle'
    })

    // Get scenario-specific text
    const getHeading = () => {
        switch (bookingScenario) {
            case 'self':
                return 'What insurance do you have?'
            case 'referral':
            case 'case-manager':
                return 'What insurance does the patient have?'
            default:
                return 'What insurance do you have?'
        }
    }

    const getSubheading = () => {
        switch (bookingScenario) {
            case 'self':
                return 'Tell us about your insurance and we\'ll check if we\'re in-network with your plan.'
            case 'referral':
            case 'case-manager':
                return 'Tell us about the patient\'s insurance and we\'ll check if they\'re in-network with their plan.'
            default:
                return 'Tell us about your insurance and we\'ll check if we\'re in-network with your plan.'
        }
    }

    const getCashPaymentText = () => {
        switch (bookingScenario) {
            case 'self':
                return 'I plan to pay out of pocket'
            case 'referral':
            case 'case-manager':
                return 'Patient will pay out of pocket'
            default:
                return 'I plan to pay out of pocket'
        }
    }

    // Debounced search
    useEffect(() => {
        if (state.query.length < 2) {
            setState(prev => ({ ...prev, results: [], showResults: false }))
            return
        }

        const timeoutId = setTimeout(async () => {
            setState(prev => ({ ...prev, loading: true }))
            try {
                const results = await searchPayers(state.query)
                setState(prev => ({
                    ...prev,
                    results,
                    loading: false,
                    showResults: true
                }))
            } catch (error) {
                setState(prev => ({
                    ...prev,
                    loading: false,
                    showResults: false
                }))
            }
        }, 300)

        return () => clearTimeout(timeoutId)
    }, [state.query])

    const handleInputChange = (value: string) => {
        setState(prev => ({ ...prev, query: value }))
    }

    const handlePayerSelect = async (payer: Payer) => {
        // Start celebration animation
        setState(prev => ({ ...prev, processingState: 'celebrating' }))

        // Determine acceptance status
        let acceptanceStatus: 'not-accepted' | 'future' | 'active'

        if (payer.credentialing_status === 'not_accepted') {
            acceptanceStatus = 'not-accepted'
        } else if (payer.effective_date && new Date(payer.effective_date) > new Date()) {
            acceptanceStatus = 'future'
        } else {
            acceptanceStatus = 'active'
        }

        // Show celebration for 2 seconds
        setTimeout(() => {
            setState(prev => ({ ...prev, processingState: 'searching' }))

            // Show searching for 2.5 seconds
            setTimeout(() => {
                setState(prev => ({ ...prev, processingState: 'transitioning' }))

                // Brief transition state, then call the parent
                setTimeout(() => {
                    onPayerSelected(payer, acceptanceStatus)
                }, 500)
            }, 2500)
        }, 2000)
    }

    const handleCashPayment = () => {
        // Handle cash payment selection
        console.log('Cash payment selected')
    }

    // Animation states
    if (state.processingState === 'celebrating') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/30 to-[#FEF8F1] flex items-center justify-center">
                <div className="max-w-2xl mx-auto text-center px-4">
                    <div className="bg-white rounded-3xl shadow-xl p-12 transform scale-105">
                        <div className="w-20 h-20 bg-[#17DB4E] rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-4xl font-light text-[#091747] mb-4 font-['Newsreader']">
                            Great news!
                        </h1>
                        <p className="text-lg text-[#091747]/70 font-['Newsreader']">
                            {bookingScenario === 'self'
                                ? 'We accept your insurance!'
                                : 'We accept the patient\'s insurance!'
                            }
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    if (state.processingState === 'searching') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/30 to-[#FEF8F1] flex items-center justify-center">
                <div className="max-w-2xl mx-auto text-center px-4">
                    <div className="bg-white rounded-3xl shadow-xl p-12">
                        <div className="w-20 h-20 bg-[#BF9C73] rounded-full flex items-center justify-center mx-auto mb-6">
                            <Loader2 className="w-10 h-10 text-white animate-spin" />
                        </div>
                        <h1 className="text-4xl font-light text-[#091747] mb-4 font-['Newsreader']">
                            Searching for time slots...
                        </h1>
                        <div className="space-y-4">
                            <div className="flex items-center justify-center space-x-2 text-[#091747]/70 font-['Newsreader']">
                                <div className="w-2 h-2 bg-[#BF9C73] rounded-full animate-pulse"></div>
                                <span>Finding available providers</span>
                            </div>
                            <div className="flex items-center justify-center space-x-2 text-[#091747]/70 font-['Newsreader']">
                                <div className="w-2 h-2 bg-[#BF9C73] rounded-full animate-pulse delay-150"></div>
                                <span>Checking availability</span>
                            </div>
                            <div className="flex items-center justify-center space-x-2 text-[#091747]/70 font-['Newsreader']">
                                <div className="w-2 h-2 bg-[#BF9C73] rounded-full animate-pulse delay-300"></div>
                                <span>Preparing calendar</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (state.processingState === 'transitioning') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/30 to-[#FEF8F1] flex items-center justify-center">
                <div className="max-w-2xl mx-auto text-center px-4">
                    <div className="bg-white rounded-3xl shadow-xl p-12 transform scale-105">
                        <div className="w-20 h-20 bg-[#BF9C73] rounded-full flex items-center justify-center mx-auto mb-6">
                            <Calendar className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-4xl font-light text-[#091747] mb-4 font-['Newsreader']">
                            Perfect!
                        </h1>
                        <p className="text-lg text-[#091747]/70 font-['Newsreader']">
                            Here are your available appointment times
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    // Main search interface
    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/30 to-[#FEF8F1]">
            <div className="max-w-3xl mx-auto py-16 px-4">
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-light text-[#091747] mb-6 font-['Newsreader']">
                        {getHeading()}
                    </h1>
                    <p className="text-xl text-[#091747]/70 max-w-2xl mx-auto leading-relaxed font-['Newsreader']">
                        {getSubheading()}
                    </p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                    {/* Search Input */}
                    <div className="relative mb-6">
                        <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                            <Search className={`h-6 w-6 transition-colors ${state.query
                                ? 'text-[#BF9C73]'
                                : 'text-[#091747]/40'
                                }`} />
                        </div>
                        <input
                            type="text"
                            value={state.query}
                            onChange={(e) => handleInputChange(e.target.value)}
                            placeholder="Type insurance name (e.g., Blue Cross, Aetna, Cigna)"
                            className="
                                w-full bg-[#FEF8F1] border-2 border-[#BF9C73]/30 rounded-xl 
                                py-4 pl-16 pr-6 text-lg text-[#091747] placeholder-[#091747]/50 
                                focus:outline-none focus:border-[#BF9C73] focus:bg-white
                                transition-all duration-200 font-['Newsreader']
                            "
                            autoFocus
                        />

                        {state.loading && (
                            <div className="absolute inset-y-0 right-0 pr-6 flex items-center">
                                <Loader2 className="h-5 w-5 text-[#BF9C73] animate-spin" />
                            </div>
                        )}
                    </div>

                    {/* Search Results */}
                    {state.showResults && (
                        <div className="space-y-3 mb-6">
                            {state.results.length > 0 ? (
                                <>
                                    <p className="text-sm text-[#091747]/60 px-2 mb-4 font-['Newsreader']">
                                        Found {state.results.length} matching insurance plan{state.results.length > 1 ? 's' : ''}
                                    </p>
                                    {state.results.map((payer) => (
                                        <button
                                            key={payer.id}
                                            onClick={() => handlePayerSelect(payer)}
                                            className="
                                                w-full text-left p-4 border-2 border-[#BF9C73]/20 hover:border-[#BF9C73] 
                                                rounded-xl transition-all duration-200 hover:shadow-md hover:bg-[#FEF8F1]
                                                font-['Newsreader']
                                            "
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="font-semibold text-[#091747]">{payer.name}</div>
                                                    {payer.state && (
                                                        <div className="text-sm text-[#091747]/60">{payer.state}</div>
                                                    )}
                                                </div>
                                                <div className="text-[#BF9C73]">
                                                    <Search className="w-5 h-5" />
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-[#091747]/60 font-['Newsreader']">
                                        No insurance plans found matching "{state.query}"
                                    </p>
                                    <p className="text-sm text-[#091747]/40 font-['Newsreader']">
                                        Try searching with a different name or contact us directly.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Cash Payment Option */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-[#BF9C73]/20" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-white text-[#091747]/50 font-['Newsreader']">or</span>
                        </div>
                    </div>

                    <button
                        onClick={handleCashPayment}
                        className="
                            w-full mt-6 py-4 px-6 border-2 border-[#BF9C73]/30 hover:border-[#BF9C73] 
                            text-[#091747] font-medium rounded-xl transition-all duration-200 
                            bg-white hover:bg-[#FEF8F1] hover:shadow-md font-['Newsreader']
                        "
                    >
                        {getCashPaymentText()}
                    </button>
                </div>

                {/* Help Text */}
                <div className="text-center">
                    <p className="text-[#091747]/50 font-['Newsreader']">
                        Don't see the insurance? <button className="text-[#BF9C73] hover:text-[#B8936A] underline">Contact us</button> and we'll help you out.
                    </p>
                </div>
            </div>
        </div>
    )
}