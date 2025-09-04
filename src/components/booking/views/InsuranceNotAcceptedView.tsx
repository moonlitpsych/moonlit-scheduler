'use client'

import { Payer } from '@/types/database'
import { AlertCircle, ArrowLeft, Mail } from 'lucide-react'
import { useState } from 'react'

interface InsuranceNotAcceptedViewProps {
    selectedPayer: Payer
    onBackToPayers: () => void
    onCashPayment: () => void
    onWaitlistSubmitted: () => void
}

export default function InsuranceNotAcceptedView({ 
    selectedPayer, 
    onBackToPayers,
    onCashPayment,
    onWaitlistSubmitted
}: InsuranceNotAcceptedViewProps) {
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [preferredName, setPreferredName] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleWaitlistSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!email.trim()) {
            setError('Please enter your email address')
            return
        }

        setIsSubmitting(true)
        setError(null)

        try {
            const response = await fetch('/api/booking-leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim(),
                    phone: phone.trim() || null,
                    preferred_name: preferredName.trim() || null,
                    requested_payer_id: selectedPayer.id,
                    reason: 'out_of_network',
                    status: 'pending'
                })
            })

            if (!response.ok) {
                throw new Error('Failed to join waitlist')
            }

            // Success! Redirect to waitlist confirmation
            onWaitlistSubmitted()
            
        } catch (err) {
            console.error('Error submitting waitlist:', err)
            setError('Unable to join waitlist. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const payerName = selectedPayer?.name || 'this insurance'

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
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-8">
                        <AlertCircle className="w-10 h-10 text-red-600" />
                    </div>
                    
                    <h1 className="text-4xl md:text-5xl font-light text-[#091747] mb-6 font-['Newsreader']">
                        We cannot accept {payerName} as payment
                    </h1>
                    
                    <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed mb-12">
                        We are not credentialed with this insurance, but it's important for us to know 
                        that you'd like us to accept it. Leave your contact information and we'll let 
                        you know if we pursue credentialing with this provider in the future.
                    </p>
                </div>

                <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 mb-8">
                    <div className="max-w-md mx-auto">
                        <div className="flex items-center space-x-3 mb-6">
                            <Mail className="w-6 h-6 text-[#BF9C73]" />
                            <h3 className="text-xl font-medium text-[#091747] font-['Newsreader']">
                                Patient Contact Information
                            </h3>
                        </div>

                        <form onSubmit={handleWaitlistSubmit} className="space-y-6">
                            {error && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                                    <p className="text-red-700 text-sm">{error}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Email address *
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="your.email@example.com"
                                    required
                                    className="w-full px-4 py-3 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Phone number (optional)
                                </label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="(555) 123-4567"
                                    className="w-full px-4 py-3 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Preferred name (optional)
                                </label>
                                <input
                                    type="text"
                                    value={preferredName}
                                    onChange={(e) => setPreferredName(e.target.value)}
                                    placeholder="What should we call you?"
                                    className="w-full px-4 py-3 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-4 px-6 bg-[#BF9C73] hover:bg-[#A8875F] disabled:bg-stone-400 text-white rounded-xl font-medium transition-colors"
                            >
                                {isSubmitting ? 'Submitting interest...' : 'Let us know you\'re interested'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Cash Payment Alternative */}
                <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12">
                    <div className="text-center">
                        <h3 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                            Or, you can proceed with cash payment
                        </h3>
                        <p className="text-slate-600 mb-6">
                            Book your appointment now and pay out of pocket. You may be able to get reimbursed later.
                        </p>
                        <button
                            onClick={onCashPayment}
                            className="py-4 px-8 bg-white border-2 border-[#17DB4E] text-[#17DB4E] hover:bg-[#17DB4E] hover:text-white rounded-xl font-medium transition-colors"
                        >
                            Patient will pay out of pocket
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}