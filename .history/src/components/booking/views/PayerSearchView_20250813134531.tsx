'use client'

import { supabase } from '@/lib/supabase'
import { Payer } from '@/types/database'
import { Calendar, Check, CreditCard, Loader2, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookingScenario } from './WelcomeView'

interface PayerSearchState {
    query: string
    results: Payer[]
    loading: boolean
    showResults: boolean
    error: string | null
}

interface PayerSearchViewProps {
    onPayerSelected: (payer: Payer, acceptanceStatus: 'not-accepted' | 'future' | 'active') => void
    bookingScenario: BookingScenario
    onBack?: () => void
}

/**
 * Debounced fuzzy search (ILIKE) on payers.display_name, with graceful fallbacks to name.
 * Computes acceptanceStatus from payer.effective_date:
 *   - active     => effective_date <= now
 *   - future     => effective_date within 30 days
 *   - not-accepted => otherwise/missing
 */
export default function PayerSearchView({ onPayerSelected, bookingScenario, onBack }: PayerSearchViewProps) {
    const [state, setState] = useState<PayerSearchState>({
        query: '',
        results: [],
        loading: false,
        showResults: false,
        error: null,
    })

    const debounceMs = 250
    const timerRef = useRef<number | null>(null)

    const runSearch = useCallback(
        async (q: string) => {
            if (!q || q.trim().length < 2) {
                setState((prev) => ({ ...prev, showResults: false, results: [] }))
                return
            }

            setState((prev) => ({ ...prev, loading: true, error: null }))

            try {
                // Prefer display_name, then fallback to name
                const { data: byDisplayName, error: err1 } = await supabase
                    .from('payers')
                    .select('*')
                    .ilike('display_name', `%${q}%`)
                    .order('display_name', { ascending: true })
                    .limit(15)

                if (err1) throw err1

                let merged = byDisplayName ?? []
                if (merged.length < 8) {
                    const { data: byName, error: err2 } = await supabase
                        .from('payers')
                        .select('*')
                        .ilike('name', `%${q}%`)
                        .order('name', { ascending: true })
                        .limit(15)
                    if (err2) throw err2

                    // De-dup by id
                    const existing = new Set(merged.map((p) => p.id))
                    merged = [...merged, ...(byName ?? []).filter((p) => !existing.has(p.id))]
                }

                setState((prev) => ({
                    ...prev,
                    results: merged,
                    showResults: true,
                    loading: false,
                }))
            } catch (e: any) {
                setState((prev) => ({
                    ...prev,
                    error: e?.message ?? 'Search failed',
                    loading: false,
                    showResults: true,
                }))
            }
        },
        []
    )

    // Debounce the input
    useEffect(() => {
        if (timerRef.current) window.clearTimeout(timerRef.current)
        timerRef.current = window.setTimeout(() => runSearch(state.query), debounceMs)
        return () => {
            if (timerRef.current) window.clearTimeout(timerRef.current)
        }
    }, [state.query, runSearch])

    const handleSelect = (payer: Payer) => {
        const now = new Date()
        let status: 'not-accepted' | 'future' | 'active' = 'not-accepted'

        if (payer?.effective_date) {
            const eff = new Date(payer.effective_date as any)
            if (eff <= now) {
                status = 'active'
            } else {
                const days = Math.ceil((eff.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                status = days > 30 ? 'not-accepted' : 'future'
            }
        }

        onPayerSelected(payer, status)
    }

    const handleUseCashPay = () => {
        const cashPayer: any = {
            id: 'cash-pay',
            name: 'Cash Pay',
            display_name: 'Cash / Self-Pay',
            effective_date: new Date().toISOString(),
            requires_individual_contract: false,
        }
        onPayerSelected(cashPayer, 'active')
    }

    const scenarioTitle = useMemo(() => {
        switch (bookingScenario) {
            case 'case-manager':
                return 'What insurance does the patient have?'
            case 'referral':
                return 'What insurance does your patient have?'
            default:
                return 'What insurance do you have?'
        }
    }, [bookingScenario])

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1]">
            <div className="max-w-3xl mx-auto px-4 py-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl md:text-3xl font-bold text-[#091747] font-['Newsreader']">
                        {scenarioTitle}
                    </h1>

                    {onBack && (
                        <button
                            onClick={onBack}
                            className="text-[#091747]/70 hover:text-[#091747] text-sm underline-offset-4 hover:underline"
                        >
                            Back
                        </button>
                    )}
                </div>

                {/* Search box */}
                <div className="bg-white/80 backdrop-blur rounded-2xl p-4 md:p-5 shadow-sm border border-stone-200">
                    <label className="block text-sm text-[#091747]/70 mb-1">Search insurance</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
                        <input
                            value={state.query}
                            onChange={(e) => setState((s) => ({ ...s, query: e.target.value }))}
                            placeholder="e.g., Aetna, Blue Cross Blue Shield, Molina"
                            className="w-full pl-10 pr-10 h-11 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 ring-[#BF9C73] bg-white"
                        />
                        {!!state.query && (
                            <button
                                onClick={() => setState((s) => ({ ...s, query: '', results: [], showResults: false }))}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-stone-500 hover:text-stone-700"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        )}
                    </div>

                    {/* Results */}
                    <div className="mt-4">
                        {state.loading && (
                            <div className="flex items-center gap-2 text-stone-700">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Searching...</span>
                            </div>
                        )}

                        {state.error && (
                            <div className="text-red-600 text-sm">Error: {state.error}</div>
                        )}

                        {state.showResults && !state.loading && (
                            <>
                                {state.results.length === 0 ? (
                                    <div className="text-stone-600 text-sm">No matches yet. Try a different search.</div>
                                ) : (
                                    <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 overflow-hidden">
                                        {state.results.map((payer) => (
                                            <li key={payer.id}>
                                                <button
                                                    onClick={() => handleSelect(payer)}
                                                    className="w-full flex items-center justify-between p-4 hover:bg-[#FEF8F1] transition-colors"
                                                >
                                                    <div className="text-left">
                                                        <p className="text-[#091747] font-medium">
                                                            {(payer as any).display_name || payer.name}
                                                        </p>
                                                        {payer.requires_individual_contract && (
                                                            <p className="text-xs text-[#091747]/70 mt-0.5">
                                                                * May require individual provider credential
                                                            </p>
                                                        )}
                                                    </div>
                                                    <Check className="h-5 w-5 text-[#BF9C73]" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </>
                        )}
                    </div>

                    {/* Cash / Self-pay + helper */}
                    <div className="mt-6 grid sm:grid-cols-2 gap-3">
                        <button
                            onClick={handleUseCashPay}
                            className="h-11 rounded-xl bg-[#091747] text-white hover:bg-[#0C215E] transition-colors flex items-center justify-center gap-2"
                        >
                            <CreditCard className="h-5 w-5" />
                            I’ll pay cash / self-pay
                        </button>

                        <div className="h-11 rounded-xl bg-white border border-stone-200 text-stone-700 flex items-center justify-center gap-2">
                            <Calendar className="h-5 w-5" />
                            You can choose a time next
                        </div>
                    </div>

                    <p className="mt-4 text-xs text-[#091747]/60">
                        Don’t see your plan? We’re expanding networks—email <span className="font-medium">hello@moonlit.com</span>.
                    </p>
                </div>
            </div>
        </div>
    )
}
