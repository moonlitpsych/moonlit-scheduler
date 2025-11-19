'use client'

import { supabase } from '@/lib/supabase'
import { Payer } from '@/types/database'
import { Calendar, Check, Clock, CreditCard, Loader2, Search, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { BookingScenario, BookingIntent } from './WelcomeView'
import PayerPlansWrapper from '../PayerPlansWrapper'

interface PayerWithCarveout extends Payer {
    displaySubtext?: string
    cardHint?: string
    isBehavioralOption?: boolean
    isMedicalOnly?: boolean
}

interface PayerSearchState {
    query: string
    results: PayerWithCarveout[]
    loading: boolean
    showResults: boolean
    error: string | null
    isMedicaidSearch?: boolean
    showCarveoutNudge?: boolean
    selectedMedicalPayer?: PayerWithCarveout
    behavioralAlternative?: PayerWithCarveout
}

interface PayerSearchViewProps {
    onPayerSelected: (payer: Payer, acceptanceStatus: 'not-accepted' | 'future' | 'active' | 'waitlist') => void
    bookingScenario: BookingScenario
    intent: BookingIntent
    onBack?: () => void
}

export default function PayerSearchView({ onPayerSelected, bookingScenario, intent, onBack }: PayerSearchViewProps) {
    const [state, setState] = useState<PayerSearchState>({
        query: '',
        results: [],
        loading: false,
        showResults: false,
        error: null
    })

    // Direct Supabase search function with medicaid-aware and carve-out-aware search
    const searchPayers = useCallback(async (query: string) => {
        if (query.length < 2) {
            setState(prev => ({ ...prev, showResults: false, results: [] }))
            return
        }

        setState(prev => ({ ...prev, loading: true, error: null }))

        try {
            console.log('🔍 Searching payers for:', query)

            // Check if user is searching for medicaid or regence (carve-out)
            const isMedicaidSearch = query.toLowerCase().includes('medicaid')
            const isRegenceSearch = query.toLowerCase().includes('regen')

            let payers: any[] = []

            if (isRegenceSearch) {
                // For Regence searches, fetch both Regence AND HMHI-BHN (behavioral carve-out)
                console.log('🏥 Detected Regence search - including HMHI-BHN behavioral carve-out')

                const [regenceResults, hmhiResults, nameResults] = await Promise.all([
                    // Get Regence payers
                    supabase
                        .from('payers')
                        .select('*')
                        .ilike('name', '%Regence%')
                        .order('name')
                        .limit(3),
                    // Get HMHI-BHN (behavioral health carve-out)
                    supabase
                        .from('payers')
                        .select('*')
                        .or('name.ilike.%HMHI%,name.ilike.%Huntsman Mental Health%')
                        .order('name')
                        .limit(2),
                    // Also include any other matches for the query
                    supabase
                        .from('payers')
                        .select('*')
                        .ilike('name', `%${query}%`)
                        .order('name')
                        .limit(10)
                ])

                if (regenceResults.error || hmhiResults.error || nameResults.error) {
                    throw regenceResults.error || hmhiResults.error || nameResults.error
                }

                // Combine and deduplicate, adding carve-out metadata
                const combinedMap = new Map()

                // Add Regence results with medical-only flag
                regenceResults.data?.forEach(payer => {
                    combinedMap.set(payer.id, {
                        ...payer,
                        isMedicalOnly: true,
                        displaySubtext: 'Medical plan. Mental health may be managed by HMHI-BHN.'
                    })
                })

                // Add HMHI results with behavioral option flag
                hmhiResults.data?.forEach(payer => {
                    combinedMap.set(payer.id, {
                        ...payer,
                        isBehavioralOption: true,
                        displaySubtext: 'Common for University of Utah employees; check the back of your card.',
                        cardHint: 'Mental health benefits for many Regence members'
                    })
                })

                // Add other name matches (lower priority)
                nameResults.data?.forEach(payer => {
                    if (!combinedMap.has(payer.id)) {
                        combinedMap.set(payer.id, payer)
                    }
                })

                payers = Array.from(combinedMap.values())
                console.log('✅ Carve-out search results:', {
                    regence: regenceResults.data?.length || 0,
                    hmhi: hmhiResults.data?.length || 0,
                    total: payers.length
                })

            } else if (isMedicaidSearch) {
                // For medicaid searches, get both name matches AND all medicaid-type payers
                const [nameResults, medicaidResults] = await Promise.all([
                    supabase
                        .from('payers')
                        .select('*')
                        .ilike('name', `%${query}%`)
                        .order('name')
                        .limit(10),
                    supabase
                        .from('payers')
                        .select('*')
                        .eq('payer_type', 'Medicaid')
                        .not('status_code', 'in', '(denied,blocked,withdrawn,on_pause)')
                        .order('name')
                        .limit(15)
                ])

                if (nameResults.error || medicaidResults.error) {
                    throw nameResults.error || medicaidResults.error
                }

                // Combine and deduplicate results, prioritizing exact name matches
                const combinedMap = new Map()

                // Add name matches first (higher priority)
                nameResults.data?.forEach(payer => combinedMap.set(payer.id, payer))

                // Add medicaid type matches (lower priority, won't overwrite existing)
                medicaidResults.data?.forEach(payer => {
                    if (!combinedMap.has(payer.id)) {
                        combinedMap.set(payer.id, payer)
                    }
                })

                payers = Array.from(combinedMap.values())
            } else {
                // Normal name-based search
                const { data, error } = await supabase
                    .from('payers')
                    .select('*')
                    .ilike('name', `%${query}%`)
                    .order('name')
                    .limit(10)

                if (error) throw error
                payers = data || []
            }

            console.log('✅ Found payers:', payers?.length || 0, isMedicaidSearch ? '(medicaid-aware search)' : isRegenceSearch ? '(carve-out-aware search)' : '(normal search)')
            
            // Sort results by: 1) acceptance priority, 2) state (UT before ID), 3) name
            const sortedPayers = (payers || []).sort((a, b) => {
                const getAcceptancePriority = (payer: any) => {
                    const statusCode = payer.status_code
                    const effectiveDate = payer.effective_date ? new Date(payer.effective_date) : null
                    const now = new Date()

                    // Not accepted (lowest priority)
                    if (['denied', 'blocked', 'withdrawn', 'on_pause'].includes(statusCode || '') ||
                        (!statusCode || !['approved', 'waiting_on_them', 'in_progress', 'not_started'].includes(statusCode))) {
                        return 4
                    }
                    // Active (highest priority)
                    else if (statusCode === 'approved' && effectiveDate && effectiveDate <= now) {
                        return 1
                    }
                    // Future (second priority)
                    else if (statusCode === 'approved' && effectiveDate && effectiveDate > now &&
                             Math.ceil((effectiveDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) <= 21) {
                        return 2
                    }
                    // Waitlist (third priority)
                    else {
                        return 3
                    }
                }

                const priorityA = getAcceptancePriority(a)
                const priorityB = getAcceptancePriority(b)

                // First sort by acceptance priority
                if (priorityA !== priorityB) {
                    return priorityA - priorityB
                }

                // Then sort by state (Utah before Idaho)
                const stateA = a.state || ''
                const stateB = b.state || ''
                if (stateA === 'UT' && stateB !== 'UT') return -1
                if (stateA !== 'UT' && stateB === 'UT') return 1
                if (stateA === 'ID' && stateB !== 'ID' && stateB !== 'UT') return -1
                if (stateA !== 'ID' && stateA !== 'UT' && stateB === 'ID') return 1

                // Finally sort alphabetically by name
                return (a.name || '').localeCompare(b.name || '')
            })
            
            setState(prev => ({
                ...prev,
                results: sortedPayers,
                loading: false,
                showResults: true,
                isMedicaidSearch: isMedicaidSearch
            }))
        } catch (error: any) {
            console.error('💥 Search error:', error)
            setState(prev => ({
                ...prev,
                loading: false,
                error: `Search failed: ${error.message}`,
                showResults: false
            }))
        }
    }, [])

    // Debounce the search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (state.query) {
                searchPayers(state.query)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [state.query, searchPayers])

    const handleInputChange = (value: string) => {
        setState(prev => ({ ...prev, query: value }))
    }

    const handlePayerSelect = (payer: PayerWithCarveout) => {
        console.log('🎯 Payer selected:', payer.name)

        // Check if user selected Regence (medical) and HMHI-BHN is available
        if (payer.isMedicalOnly && payer.name?.toLowerCase().includes('regence')) {
            // Find HMHI-BHN in current results
            const hmhiBhnOption = state.results.find(p => p.isBehavioralOption)

            if (hmhiBhnOption) {
                console.log('🏥 Regence selected - showing carve-out nudge for HMHI-BHN')
                setState(prev => ({
                    ...prev,
                    showCarveoutNudge: true,
                    selectedMedicalPayer: payer,
                    behavioralAlternative: hmhiBhnOption
                }))
                return
            }
        }

        // Proceed with normal selection
        proceedWithPayerSelection(payer)
    }

    const proceedWithPayerSelection = (payer: Payer) => {
        // Determine acceptance status based on status_code + effective_date
        const now = new Date()
        let acceptanceStatus: 'not-accepted' | 'future' | 'active' | 'waitlist' = 'not-accepted'

        const statusCode = payer.status_code

        // Handle denied/blocked/rejected statuses
        if (['denied', 'blocked', 'withdrawn', 'on_pause'].includes(statusCode || '')) {
            acceptanceStatus = 'not-accepted'
        }
        // Handle approved status
        else if (statusCode === 'approved') {
            if (payer.effective_date) {
                const effectiveDate = new Date(payer.effective_date)
                if (effectiveDate <= now) {
                    acceptanceStatus = 'active'
                } else {
                    const daysUntilActive = Math.ceil((effectiveDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                    acceptanceStatus = daysUntilActive > 21 ? 'waitlist' : 'future'
                }
            } else {
                // Approved but no effective date - waitlist case
                acceptanceStatus = 'waitlist'
            }
        }
        // Handle in-progress statuses (waiting_on_them, in_progress, not_started)
        else if (['waiting_on_them', 'in_progress', 'not_started'].includes(statusCode || '')) {
            acceptanceStatus = 'waitlist'
        }
        // Unknown/null status - not accepted
        else {
            acceptanceStatus = 'not-accepted'
        }

        console.log('📊 Status code:', statusCode, '→ Acceptance status:', acceptanceStatus)
        onPayerSelected(payer, acceptanceStatus)
    }

    const handleUseBehavioralOption = () => {
        if (state.behavioralAlternative) {
            console.log('✅ User chose behavioral option (HMHI-BHN)')
            setState(prev => ({ ...prev, showCarveoutNudge: false }))
            proceedWithPayerSelection(state.behavioralAlternative)
        }
    }

    const handleKeepMedicalOption = () => {
        if (state.selectedMedicalPayer) {
            console.log('⚠️ User chose to keep medical option (Regence)')
            setState(prev => ({ ...prev, showCarveoutNudge: false }))
            proceedWithPayerSelection(state.selectedMedicalPayer)
        }
    }

    const handleCashPayment = () => {
        console.log('💳 Cash payment selected')
        
        // Create a mock payer for cash payment
        const cashPayer: Payer = {
            id: 'cash-payment',
            name: 'Cash Payment',
            payer_type: 'cash',
            state: 'UT',
            effective_date: new Date().toISOString(),
            requires_attending: false,
            status_code: 'active',
            notes: 'Self-pay patient',
            created_at: new Date().toISOString(),
            projected_effective_date: null,
            requires_individual_contract: false
        }

        onPayerSelected(cashPayer, 'active')
    }

    const getScenarioTitle = () => {
        if (intent === 'explore') {
            switch (bookingScenario) {
                case 'self':
                    return 'What insurance would you be paying with?'
                case 'case-manager':
                    return 'What insurance would the patient be paying with?'
                case 'referral':
                    return 'What insurance would your patient be paying with?'
                default:
                    return 'Insurance Information'
            }
        } else {
            switch (bookingScenario) {
                case 'self':
                    return 'How do you intend to pay for your visit?'
                case 'case-manager':
                    return 'What insurance does the patient have?'
                case 'referral':
                    return 'What insurance does your patient have?'
                default:
                    return 'Insurance Information'
            }
        }
    }

    const getScenarioSubtitle = () => {
        if (intent === 'explore') {
            switch (bookingScenario) {
                case 'self':
                    return 'This helps us show you the most relevant practitioner availability'
                case 'case-manager':
                    return 'This helps us show you the most relevant practitioner availability for the patient'
                case 'referral':
                    return 'This helps us show you the most relevant practitioner availability for your patient'
                default:
                    return 'This helps us show you the most relevant practitioner availability'
            }
        } else {
            switch (bookingScenario) {
                case 'self':
                    return 'Search for your insurance provider below.'
                case 'case-manager':
                    return 'Search for the patient\'s insurance provider'
                case 'referral':
                    return 'Search for the patient\'s insurance provider'
                default:
                    return 'Search for insurance provider'
            }
        }
    }

    return (
        <div className="min-h-screen bg-[#FEF8F1]">
            <div className="max-w-4xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="absolute top-8 left-8 p-3 hover:bg-white/50 rounded-xl transition-colors"
                        >
                            ← Back
                        </button>
                    )}
                    
                    <h1 className="text-4xl font-bold text-slate-800 mb-4 font-['Newsreader']">
                        {getScenarioTitle()}
                    </h1>
                    <p className="text-xl text-slate-600">
                        {getScenarioSubtitle()}
                    </p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                    {/* Search Input */}
                    <div className="relative mb-6">
                        <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                            <Search className={`h-6 w-6 transition-colors ${
                                state.query ? 'text-orange-400' : 'text-slate-400'
                            }`} />
                        </div>
                        <input
                            type="text"
                            value={state.query}
                            onChange={(e) => handleInputChange(e.target.value)}
                            placeholder="Type your insurance name (e.g., Molina, Blue Cross, Aetna, Cigna, Medicaid)"
                            className="
                                w-full bg-stone-50 border-2 border-stone-200 rounded-xl 
                                py-4 pl-16 pr-6 text-lg text-slate-800 placeholder-slate-500 
                                focus:outline-none focus:border-orange-300 focus:bg-white
                                transition-all duration-200
                            "
                            autoFocus
                        />

                        {state.loading && (
                            <div className="absolute inset-y-0 right-0 pr-6 flex items-center">
                                <Loader2 className="h-5 w-5 text-orange-400 animate-spin" />
                            </div>
                        )}

                        {state.query && !state.loading && (
                            <button
                                onClick={() => setState(prev => ({ ...prev, query: '', showResults: false }))}
                                className="absolute inset-y-0 right-0 pr-6 flex items-center hover:bg-stone-100 rounded-r-xl transition-colors"
                            >
                                <X className="h-5 w-5 text-slate-400 hover:text-slate-600" />
                            </button>
                        )}
                    </div>

                    {/* Error State */}
                    {state.error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                            <p className="text-red-700">{state.error}</p>
                            <p className="text-red-600 text-sm mt-1">
                                Please try again or contact support if the issue persists.
                            </p>
                        </div>
                    )}

                    {/* Search Results */}
                    {state.showResults && (
                        <div className="space-y-3 mb-6">
                            {state.results.length > 0 ? (
                                <>
                                    <div className="px-2 mb-4">
                                        <div className="flex items-center gap-3 mb-2">
                                            <p className="text-sm text-slate-500">
                                                Found {state.results.length} matching insurance plan{state.results.length > 1 ? 's' : ''}
                                            </p>
                                            {state.isMedicaidSearch && (
                                                <div className="flex items-center gap-2 px-3 py-1 rounded-full" style={{backgroundColor: '#bc956b20'}}>
                                                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: '#bc956b'}}></div>
                                                    <span className="text-xs font-medium" style={{color: '#bc956b'}}>
                                                        Including all Utah Medicaid plans
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        {state.isMedicaidSearch && (
                                            <p className="text-xs mb-2" style={{color: '#bc956b'}}>
                                                💡 Tip: All results with "Medicaid" type are included (Molina Utah, Health Choice Utah, etc.)
                                            </p>
                                        )}
                                    </div>
                                    {state.results.map((payer) => {
                                        const now = new Date()

                                        // FIX: Parse effective_date in Mountain Time to avoid timezone shifts
                                        // '2025-11-01' should display as Nov 1, not Oct 31
                                        let effectiveDate: Date | null = null
                                        if (payer.effective_date) {
                                            const dateStr = payer.effective_date.split('T')[0]
                                            const [year, month, day] = dateStr.split('-').map(Number)
                                            effectiveDate = new Date(year, month - 1, day, 12, 0, 0) // Month is 0-indexed, noon MT
                                        }

                                        const statusCode = payer.status_code

                                        // Determine display status
                                        const isActive = statusCode === 'approved' && effectiveDate && effectiveDate <= now
                                        const isFuture = statusCode === 'approved' && effectiveDate && effectiveDate > now && 
                                                        Math.ceil((effectiveDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) <= 21
                                        const isWaitlist = statusCode === 'approved' && (!effectiveDate || 
                                                          (effectiveDate > now && Math.ceil((effectiveDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) > 21)) ||
                                                          ['waiting_on_them', 'in_progress', 'not_started'].includes(statusCode || '')
                                        const isNotAccepted = ['denied', 'blocked', 'withdrawn', 'on_pause'].includes(statusCode || '') || 
                                                             (!statusCode || !['approved', 'waiting_on_them', 'in_progress', 'not_started'].includes(statusCode))

                                        return (
                                            <button
                                                key={payer.id}
                                                onClick={() => handlePayerSelect(payer)}
                                                className="
                                                    w-full p-4 border-2 border-stone-200 rounded-xl 
                                                    hover:border-orange-300 hover:bg-orange-50/50 
                                                    transition-all duration-200 text-left
                                                    group focus:outline-none focus:border-orange-400
                                                "
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-start space-x-4">
                                                        {isActive ? (
                                                            <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                                                <Check className="w-5 h-5 text-green-600" />
                                                            </div>
                                                        ) : isFuture ? (
                                                            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                                                <Calendar className="w-5 h-5 text-blue-600" />
                                                            </div>
                                                        ) : isWaitlist ? (
                                                            <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                                                                <Clock className="w-5 h-5 text-orange-600" />
                                                            </div>
                                                        ) : (
                                                            <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                                                <X className="w-5 h-5 text-red-600" />
                                                            </div>
                                                        )}
                                                        
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <h3 className="font-semibold text-slate-900 group-hover:text-orange-700 transition-colors">
                                                                    {payer.name}
                                                                </h3>
                                                                {payer.isBehavioralOption && state.query?.toLowerCase().includes('regence') && (
                                                                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700">
                                                                        Mental Health
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Carve-out specific messaging */}
                                                            {payer.isMedicalOnly && (
                                                                <p className="text-sm text-orange-600 font-medium mt-1">
                                                                    {payer.displaySubtext}
                                                                </p>
                                                            )}

                                                            {payer.isBehavioralOption && state.query?.toLowerCase().includes('regence') && (
                                                                <div className="mt-1">
                                                                    <p className="text-sm text-green-600 font-medium">
                                                                        ✓ {payer.cardHint}
                                                                    </p>
                                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                                        {payer.displaySubtext}
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {/* Normal status text for non-carveout cases */}
                                                            {!payer.isMedicalOnly && !payer.isBehavioralOption && (
                                                                <p className="text-sm text-slate-500">
                                                                    {isActive && 'We accept this insurance'}
                                                                    {isFuture && effectiveDate && `Available starting ${effectiveDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', timeZone: 'America/Denver' })}`}
                                                                    {isWaitlist && statusCode === 'approved' && !effectiveDate && 'We will be in network soon - timing uncertain'}
                                                                    {isWaitlist && statusCode === 'approved' && effectiveDate && effectiveDate > now &&
                                                                        `Available starting ${effectiveDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', timeZone: 'America/Denver' })}`}
                                                                    {isWaitlist && ['waiting_on_them', 'in_progress', 'not_started'].includes(statusCode || '') &&
                                                                        'Credentialing in progress - join waitlist'}
                                                                    {isNotAccepted && 'We cannot accept this insurance'}
                                                                </p>
                                                            )}

                                                            {payer.payer_type && (
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    {payer.payer_type === 'Medicaid' && (
                                                                        <span className="px-2 py-0.5 text-xs font-medium rounded" style={{backgroundColor: '#bc956b20', color: '#bc956b'}}>
                                                                            Medicaid
                                                                        </span>
                                                                    )}
                                                                    <p className="text-xs text-slate-400">
                                                                        {payer.payer_type !== 'Medicaid' && `Type: ${payer.payer_type}`}
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {/* Inline plan display */}
                                                            <PayerPlansWrapper
                                                                payerId={payer.id}
                                                                payerName={payer.name}
                                                            />
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="text-sm text-slate-400 group-hover:text-orange-500 transition-colors">
                                                        Select →
                                                    </div>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="text-slate-400 mb-2">
                                        <Search className="w-12 h-12 mx-auto mb-4" />
                                    </div>
                                    <p className="text-slate-600">
                                        No insurance plans found matching "{state.query}"
                                    </p>
                                    <p className="text-sm text-slate-500 mt-2">
                                        Try a different search term or consider cash payment below
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Out-of-Network Message - Only show when ALL results are not-accepted */}
                    {state.showResults && state.results.length > 0 && state.results.every(payer => 
                        ['denied', 'blocked', 'withdrawn', 'on_pause'].includes(payer.status_code || '') || 
                        (!payer.status_code || !['approved', 'waiting_on_them', 'in_progress', 'not_started'].includes(payer.status_code))
                    ) && (
                        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                            <h3 className="font-semibold text-blue-800 mb-2">Out-of-Network Options</h3>
                            <p className="text-blue-700 text-sm">
                                We cannot accept this insurance, but you can still receive care by paying out-of-network rates. 
                                Many patients are able to get partial reimbursement from their insurance later.
                            </p>
                        </div>
                    )}

                    {/* Cash Payment Option */}
                    <div className="border-t border-stone-200 pt-6">
                        <button
                            onClick={handleCashPayment}
                            className="
                                w-full p-4 border-2 border-stone-200 rounded-xl 
                                hover:border-orange-300 hover:bg-orange-50/50 
                                transition-all duration-200 text-left group
                                focus:outline-none focus:border-orange-400
                            "
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                        <CreditCard className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 group-hover:text-orange-700 transition-colors">
                                            Pay Out of Pocket
                                        </h3>
                                        <p className="text-sm text-slate-500">
                                            Self-pay rates available
                                        </p>
                                    </div>
                                </div>
                                <div className="text-sm text-slate-400 group-hover:text-orange-500 transition-colors">
                                    Select →
                                </div>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Help Text */}
                <div className="text-center text-slate-500">
                    <p className="text-sm">
                        Can't find your insurance? We're always adding new insurances.
                    </p>
                    <p className="text-sm mt-1">
                        Contact us at <span className="font-medium">hello@trymoonlit.com</span> for assistance.
                    </p>
                </div>
            </div>

            {/* Carve-out Nudge Modal */}
            {state.showCarveoutNudge && state.selectedMedicalPayer && state.behavioralAlternative && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-slate-800 mb-3 font-['Newsreader']">
                                Use HMHI-BHN for your mental health benefits?
                            </h2>
                            <p className="text-slate-600 text-base leading-relaxed">
                                Many <span className="font-semibold">{state.selectedMedicalPayer.name}</span> plans
                                use <span className="font-semibold">{state.behavioralAlternative.name}</span> for
                                mental health services.
                            </p>
                            <p className="text-slate-600 text-base leading-relaxed mt-3">
                                This is especially common for University of Utah employees.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={handleUseBehavioralOption}
                                className="
                                    w-full py-4 px-6
                                    bg-green-600 hover:bg-green-700
                                    text-white font-semibold rounded-xl
                                    transition-colors duration-200
                                    flex items-center justify-center gap-2
                                "
                            >
                                <Check className="w-5 h-5" />
                                Use {state.behavioralAlternative.name}
                            </button>

                            <button
                                onClick={handleKeepMedicalOption}
                                className="
                                    w-full py-4 px-6
                                    border-2 border-slate-300 hover:border-slate-400
                                    text-slate-700 font-medium rounded-xl
                                    transition-colors duration-200
                                "
                            >
                                Keep {state.selectedMedicalPayer.name}
                            </button>
                        </div>

                        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-sm text-blue-800">
                                <span className="font-semibold">💡 Tip:</span> Check the back of your
                                insurance card under "Mental Health" or "Behavioral Health" to confirm
                                your coverage.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}