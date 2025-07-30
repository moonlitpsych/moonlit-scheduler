// src/components/booking/views/InsuranceNotAcceptedView.tsx
'use client'

import { useState } from 'react'
import { Payer, BookingLead } from '@/types/database'
import { supabase } from '@/lib/supabase'

interface InsuranceNotAcceptedViewProps {
    payer: Payer
    onLeadSubmitted: () => void
    onCashPayment: () => void
}

export default function InsuranceNotAcceptedView({ payer, onLeadSubmitted, onCashPayment }: InsuranceNotAcceptedViewProps) {
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            const leadData: BookingLead = {
                email,
                phone: phone || undefined,
                requested_payer_id: payer.id,
                reason: 'Insurance not currently accepted'
            }

            const { error } = await supabase
                .from('booking_leads')
                .insert([leadData])

            if (error) throw error

            onLeadSubmitted()
        } catch (error) {
            console.error('Error submitting lead:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-normal text-slate-800 mb-4">
                    We do not yet accept {payer.name}
                </h2>
                <p className="text-slate-600 mb-8">
                    We're working on getting credentialed with your insurance.
                    Leave your contact information and we'll notify you when we're in-network.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4 mb-8">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Your email address"
                        required
                        className="form-input"
                    />
                    <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Phone number (optional)"
                        className="form-input"
                    />
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn-primary disabled:bg-stone-300"
                    >
                        {isSubmitting ? 'Submitting...' : 'Notify me when available'}
                    </button>
                </form>

                <p className="text-slate-600 mb-4">Or, you can proceed with cash payment:</p>
                <button
                    onClick={onCashPayment}
                    className="btn-secondary"
                >
                    Continue with cash payment
                </button>
            </div>
        </div>
    )
}