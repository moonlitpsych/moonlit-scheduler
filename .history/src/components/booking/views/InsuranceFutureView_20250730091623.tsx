// src/components/booking/views/InsuranceFutureView.tsx
'use client'

import { Payer } from '@/types/database'

interface InsuranceFutureViewProps {
    payer: Payer
    onWaitForEffectiveDate: () => void
    onCashPayment: () => void
}

export default function InsuranceFutureView({ payer, onWaitForEffectiveDate, onCashPayment }: InsuranceFutureViewProps) {
    const effectiveDate = payer.effective_date ? new Date(payer.effective_date).toLocaleDateString() : 'soon'

    return (
        <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-normal text-slate-800 mb-4">
                    We accept your insurance starting {effectiveDate}
                </h2>
                <p className="text-slate-600 mb-8">
                    Your insurance will be active with us on {effectiveDate}.
                    You can wait until then to book, or proceed with cash payment now.
                </p>

                <div className="space-y-4">
                    <button
                        onClick={onWaitForEffectiveDate}
                        className="btn-primary block w-full max-w-md mx-auto"
                    >
                        Wait for insurance to be active
                    </button>

                    <button
                        onClick={onCashPayment}
                        className="btn-secondary block w-full max-w-md mx-auto"
                    >
                        Continue with cash payment
                    </button>
                </div>
            </div>
        </div>
    )
}