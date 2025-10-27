'use client'

import { Payer } from '@/types/database'
import { ArrowLeft } from 'lucide-react'

interface InsuranceFutureViewProps {
    selectedPayer: Payer
    onBackToPayers: () => void
    onCashPayment: () => void
    onWaitForEffectiveDate: () => void
    onBookAnyway: () => void
}

export default function InsuranceFutureView({ 
    selectedPayer, 
    onBackToPayers,
    onCashPayment,
    onWaitForEffectiveDate,
    onBookAnyway
}: InsuranceFutureViewProps) {
    // Safe effective date handling with null checks and timezone fix
    const getEffectiveDate = () => {
        if (!selectedPayer) return 'soon'

        const effectiveDate = selectedPayer.effective_date || selectedPayer.projected_effective_date
        if (!effectiveDate) return 'soon'

        try {
            // FIX: Parse date in Mountain Time to avoid UTC midnight causing day shift
            // '2025-11-01' should display as Nov 1, not Oct 31
            const dateStr = effectiveDate.split('T')[0] // Get YYYY-MM-DD part only
            const [year, month, day] = dateStr.split('-').map(Number)

            // Create date at noon Mountain Time to avoid timezone shifts
            const date = new Date(year, month - 1, day, 12, 0, 0) // Month is 0-indexed

            return date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'America/Denver' // Explicitly use Mountain Time
            })
        } catch (error) {
            console.error('Error formatting date:', error)
            return 'soon'
        }
    }

    // Check if effective date is within 3 weeks (timezone-aware)
    const isWithinThreeWeeks = () => {
        if (!selectedPayer) return false

        const effectiveDate = selectedPayer.effective_date || selectedPayer.projected_effective_date
        if (!effectiveDate) return false

        try {
            // FIX: Parse date in Mountain Time to avoid timezone shifts
            const dateStr = effectiveDate.split('T')[0] // Get YYYY-MM-DD part only
            const [year, month, day] = dateStr.split('-').map(Number)

            // Create date at noon Mountain Time
            const effective = new Date(year, month - 1, day, 12, 0, 0)

            const threeWeeksFromNow = new Date()
            threeWeeksFromNow.setDate(threeWeeksFromNow.getDate() + 21) // 3 weeks = 21 days

            return effective <= threeWeeksFromNow
        } catch (error) {
            console.error('Error checking date proximity:', error)
            return false
        }
    }

    const effectiveDateText = getEffectiveDate()
    const payerName = selectedPayer?.name || 'this insurance'
    const canBookAnyway = isWithinThreeWeeks()

    return (
        <div className="min-h-screen bg-gradient-to-br from-stone-50 via-orange-50/30 to-stone-100">
            <div className="max-w-4xl mx-auto py-16 px-4">
                {/* Back Button */}
                <button
                    onClick={onBackToPayers}
                    className="mb-8 flex items-center space-x-2 text-[#BF9C73] hover:text-[#A8875F] transition-colors group"
                >
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-lg font-medium">Back to insurance search</span>
                </button>

                <div className="text-center mb-12">
                    <div className="w-20 h-20 bg-orange-200 rounded-full flex items-center justify-center mx-auto mb-8">
                        <span className="text-3xl">⏰</span>
                    </div>
                    
                    <h1 className="text-4xl md:text-5xl font-light text-[#091747] mb-6 font-['Newsreader']">
                        We accept {payerName} starting {effectiveDateText}
                    </h1>
                    
                    <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed mb-12">
                        Your insurance will be active with us on {effectiveDateText}. 
                        You can wait until then to book, or proceed with cash payment now.
                    </p>
                </div>

                <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12">
                    <div className={`grid ${canBookAnyway ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-8`}>
                        {/* Wait for Insurance Option */}
                        <div className="text-center p-6 border-2 border-[#BF9C73]/20 rounded-2xl hover:border-[#BF9C73]/40 transition-colors">
                            <div className="w-16 h-16 bg-[#BF9C73]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-2xl">📅</span>
                            </div>
                            <h3 className="text-xl font-medium text-[#091747] mb-3 font-['Newsreader']">
                                Wait for Insurance
                            </h3>
                            <p className="text-slate-600 mb-6">
                                We'll notify you when {payerName} is active and you can book your appointment.
                            </p>
                            <button
                                onClick={onWaitForEffectiveDate}
                                className="w-full py-4 px-6 bg-[#BF9C73] hover:bg-[#A8875F] text-white rounded-xl font-medium transition-colors"
                            >
                                Notify me when available
                            </button>
                        </div>

                        {/* Book Anyway Option (only if within 3 weeks) */}
                        {canBookAnyway && (
                            <div className="text-center p-6 border-2 border-blue-200 rounded-2xl hover:border-blue-300 transition-colors">
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-2xl">🗓️</span>
                                </div>
                                <h3 className="text-xl font-medium text-[#091747] mb-3 font-['Newsreader']">
                                    Book Anyway
                                </h3>
                                <p className="text-slate-600 mb-6">
                                    Book an appointment for {effectiveDateText} or later when this insurance is active.
                                </p>
                                <button
                                    onClick={onBookAnyway}
                                    className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
                                >
                                    Book from {effectiveDateText}
                                </button>
                            </div>
                        )}

                        {/* Cash Payment Option */}
                        <div className="text-center p-6 border-2 border-green-200 rounded-2xl hover:border-green-300 transition-colors">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-2xl">💳</span>
                            </div>
                            <h3 className="text-xl font-medium text-[#091747] mb-3 font-['Newsreader']">
                                Continue with Cash Payment
                            </h3>
                            <p className="text-slate-600 mb-6">
                                Book your appointment now and pay out of pocket. You can get reimbursed later.
                            </p>
                            <button
                                onClick={onCashPayment}
                                className="w-full py-4 px-6 bg-white border-2 border-[#17DB4E] text-[#17DB4E] hover:bg-[#17DB4E] hover:text-white rounded-xl font-medium transition-colors"
                            >
                                Continue with cash payment
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}