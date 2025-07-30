// src/components/booking/views/PayerSearchView.tsx
'use client'

import { useState, useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import { Payer } from '@/types/database'
import { supabase } from '@/lib/supabase'

interface PayerSearchViewProps {
    onPayerSelected: (payer: Payer, acceptanceStatus: 'not-accepted' | 'future' | 'active') => void
    onCashPayment: () => void
}

export default function PayerSearchView({ onPayerSelected, onCashPayment }: PayerSearchViewProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const [searchResults, setSearchResults] = useState<Payer[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [selectedPayer, setSelectedPayer] = useState<Payer | null>(null)
    const [showResults, setShowResults] = useState(false)

    // Debounced search
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (searchTerm.length >= 2) {
                searchPayers()
            } else {
                setSearchResults([])
                setShowResults(false)
            }
        }, 300)

        return () => clearTimeout(timeoutId)
    }, [searchTerm])

    const searchPayers = async () => {
        setIsLoading(true)
        try {
            const { data, error } = await supabase
                .from('payers')
                .select('*')
                .ilike('name', `%${searchTerm}%`)
                .limit(5)

            if (error) throw error

            setSearchResults(data || [])
            setShowResults(true)
        } catch (error) {
            console.error('Error searching payers:', error)
            setSearchResults([])
        } finally {
            setIsLoading(false)
        }
    }

    const handlePayerSelect = (payer: Payer) => {
        setSelectedPayer(payer)
        setSearchTerm(payer.name || '')
        setShowResults(false)

        // Determine acceptance status based on effective date
        const now = new Date()
        const effectiveDate = payer.effective_date ? new Date(payer.effective_date) : null
        const projectedDate = payer.projected_effective_date ? new Date(payer.projected_effective_date) : null

        let acceptanceStatus: 'not-accepted' | 'future' | 'active'

        if (!effectiveDate && !projectedDate) {
            acceptanceStatus = 'not-accepted'
        } else if (effectiveDate && effectiveDate <= now) {
            acceptanceStatus = 'active'
        } else {
            acceptanceStatus = 'future'
        }

        // Show acceptance message based on status
        setTimeout(() => {
            onPayerSelected(payer, acceptanceStatus)
        }, 1000)
    }

    const getAcceptanceMessage = () => {
        if (!selectedPayer) return null

        const now = new Date()
        const effectiveDate = selectedPayer.effective_date ? new Date(selectedPayer.effective_date) : null

        if (effectiveDate && effectiveDate <= now) {
            return (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-slate-700 mb-2">
                        <strong>We're in network with your payer.</strong>
                    </p>
                    <p className="text-slate-600 mb-4">
                        Click Next to proceed to a calendar of our practitioners'
                        availability. Re-type your insurance above if you want to
                        search for a new insurance option.
                    </p>
                    <button
                        onClick={() => onPayerSelected(selectedPayer, 'active')}
                        className="bg-orange-300 hover:bg-orange-400 text-slate-800 font-medium py-2 px-4 rounded-md transition-colors"
                    >
                        Next
                    </button>
                </div>
            )
        }

        return null
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-normal text-slate-800 mb-8">
                    What insurance do you have?
                </h2>

                <div className="relative">
                    <div className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Type your insurance name..."
                            className="w-full max-w-lg mx-auto bg-orange-100 border-2 border-orange-200 rounded-md py-4 px-6 text-slate-800 placeholder-slate-500 focus:outline-none focus:border-orange-300 text-lg"
                        />
                        {searchTerm && (
                            <button className="absolute right-4 top-1/2 transform -translate-y-1/2">
                                <ArrowRight className="w-6 h-6 text-orange-500" />
                            </button>
                        )}
                    </div>

                    {/* Search Results Dropdown */}
                    {showResults && searchResults.length > 0 && (
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-full max-w-lg mt-1 bg-white border border-stone-200 rounded-md shadow-lg z-10">
                            {searchResults.map((payer) => (
                                <button
                                    key={payer.id}
                                    onClick={() => handlePayerSelect(payer)}
                                    className="w-full text-left px-4 py-3 hover:bg-stone-50 border-b border-stone-100 last:border-b-0 transition-colors"
                                >
                                    <div className="font-medium text-slate-800">{payer.name}</div>
                                    {payer.state && (
                                        <div className="text-sm text-slate-500">{payer.state}</div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* No Results */}
                    {showResults && searchResults.length === 0 && !isLoading && (
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-full max-w-lg mt-1 bg-white border border-stone-200 rounded-md shadow-lg z-10 p-4">
                            <p className="text-slate-600">No insurance plans found matching "{searchTerm}"</p>
                        </div>
                    )}
                </div>

                {/* Acceptance Status Message */}
                {getAcceptanceMessage()}

                {/* Cash Payment Option */}
                <div className="mt-8">
                    <button
                        onClick={onCashPayment}
                        className="border-2 border-orange-300 hover:border-orange-400 text-slate-800 font-medium py-3 px-6 rounded-md transition-colors bg-white"
                    >
                        I plan to pay out of pocket.
                    </button>
                </div>
            </div>
        </div>
    )
}