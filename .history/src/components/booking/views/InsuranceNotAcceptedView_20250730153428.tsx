// src/components/booking/views/InsuranceNotAcceptedView.tsx
'use client'

import { useState } from 'react'
import { Payer, BookingLead } from '@/types/database'
import { BookingScenario } from './WelcomeView'
import { ArrowLeft, AlertCircle, Mail, Phone } from 'lucide-react'

interface InsuranceNotAcceptedViewProps {
    selectedPayer: Payer
    bookingScenario: BookingScenario
    onLeadSubmitted: (leadData: any) => void
    onBack: () => void
}

export default function InsuranceNotAcceptedView({
    selectedPayer,
    bookingScenario,
    onLeadSubmitted,
    onBack
}: InsuranceNotAcceptedViewProps) {
    const [formData, setFormData] = useState({
        email: '',
        phone: '',
        preferredName: ''
    })
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Safety check for undefined payer
    if (!selectedPayer) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/30 to-[#FEF8F1] flex items-center justify-center px-4">
                <div className="max-w-2xl mx-auto text-center">
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-semibold text-[#091747] mb-4 font-['Newsreader']">
                            Something went wrong
                        </h2>
                        <p className="text-[#091747]/70 mb-6 font-['Newsreader']">
                            We couldn't find the insurance information. Please try again.
                        </p>
                        <button
                            onClick={onBack}
                            className="px-6 py-3 bg-[#BF9C73] hover:bg-[#B8936A] text-white rounded-xl transition-colors font-['Newsreader']"
                        >
                            Go Back
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            const leadData: BookingLead = {
                email: formData.email,
                phone: formData.phone || undefined,
                preferred_name: formData.preferredName || undefined,
                requested_payer_id: selectedPayer.id,
                reason: 'Insurance not currently accepted'
            }

            onLeadSubmitted(leadData)
        } catch (error) {
            console.error('Error submitting lead:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleChange = (field: keyof typeof formData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const getHeading = () => {
        const payerName = selectedPayer.name || 'this insurance'
        switch (bookingScenario) {
            case 'self':
                return `We do not yet accept ${payerName}`
            case 'referral':
            case 'case-manager':
                return `We do not yet accept ${payerName}`
            default:
                return `We do not yet accept ${payerName}`
        }
    }

    const getSubheading = () => {
        switch (bookingScenario) {
            case 'self':
                return 'We\'re working on getting credentialed with your insurance. Leave your contact information and we\'ll notify you when we\'re in-network.'
            case 'referral':
                return 'We\'re working on getting credentialed with this insurance. Leave the patient\'s contact information and we\'ll notify them when we\'re in-network.'
            case 'case-manager':
                return 'We\'re working on getting credentialed with this insurance. Leave your contact information and we\'ll notify you when we\'re in-network with your client\'s plan.'
            default:
                return 'We\'re working on getting credentialed with this insurance. Leave your contact information and we\'ll notify you when we\'re in-network.'
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/30 to-[#FEF8F1]">
            <div className="max-w-3xl mx-auto py-12 px-4">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={onBack}
                        className="flex items-center text-[#091747]/60 hover:text-[#091747] transition-colors mb-6 font-['Newsreader']"
                    >
                        <ArrowLeft className="w-5 h-5 mr-2" />
                        Back to insurance search
                    </button>

                    <div className="text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertCircle className="w-8 h-8 text-red-600" />
                        </div>

                        <h1 className="text-4xl font-light text-[#091747] mb-4 font-['Newsreader']">
                            {getHeading()}
                        </h1>

                        <p className="text-xl text-[#091747]/70 max-w-2xl mx-auto leading-relaxed font-['Newsreader']">
                            {getSubheading()}
                        </p>
                    </div>
                </div>

                {/* Contact Form */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="w-10 h-10 bg-[#BF9C73]/10 rounded-lg flex items-center justify-center">
                            <Mail className="w-5 h-5 text-[#BF9C73]" />
                        </div>
                        <h2 className="text-2xl font-semibold text-[#091747] font-['Newsreader']">
                            {bookingScenario === 'case-manager'
                                ? 'Your Contact Information'
                                : bookingScenario === 'referral'
                                    ? 'Patient Contact Information'
                                    : 'Your Contact Information'
                            }
                        </h2>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-[#091747] font-medium mb-2 font-['Newsreader']">
                                Email Address *
                            </label>
                            <input
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => handleChange('email', e.target.value)}
                                className="w-full px-4 py-3 border-2 border-[#BF9C73]/30 rounded-xl focus:border-[#BF9C73] focus:outline-none transition-colors font-['Newsreader']"
                                placeholder="your.email@example.com"
                            />
                        </div>

                        <div>
                            <label className="block text-[#091747] font-medium mb-2 font-['Newsreader']">
                                Phone Number
                            </label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => handleChange('phone', e.target.value)}
                                className="w-full px-4 py-3 border-2 border-[#BF9C73]/30 rounded-xl focus:border-[#BF9C73] focus:outline-none transition-colors font-['Newsreader']"
                                placeholder="(555) 123-4567"
                            />
                        </div>

                        {(bookingScenario === 'referral' || bookingScenario === 'case-manager') && (
                            <div>
                                <label className="block text-[#091747] font-medium mb-2 font-['Newsreader']">
                                    {bookingScenario === 'case-manager' ? 'Client Name' : 'Patient Name'}
                                </label>
                                <input
                                    type="text"
                                    value={formData.preferredName}
                                    onChange={(e) => handleChange('preferredName', e.target.value)}
                                    className="w-full px-4 py-3 border-2 border-[#BF9C73]/30 rounded-xl focus:border-[#BF9C73] focus:outline-none transition-colors font-['Newsreader']"
                                    placeholder="Patient's name"
                                />
                            </div>
                        )}

                        {/* Information box */}
                        <div className="bg-[#BF9C73]/5 p-4 rounded-xl">
                            <p className="text-[#091747]/70 text-sm font-['Newsreader']">
                                {bookingScenario === 'case-manager'
                                    ? 'We\'ll notify you as the case manager when this insurance becomes available. You can then book appointments for your clients.'
                                    : 'We\'ll send you an email as soon as we\'re able to accept this insurance plan.'
                                }
                            </p>
                        </div>

                        {/* Submit Button */}
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-8 py-4 bg-[#BF9C73] hover:bg-[#B8936A] disabled:bg-[#BF9C73]/50 text-white font-semibold rounded-xl transition-all duration-200 hover:shadow-lg font-['Newsreader']"
                            >
                                {isSubmitting ? 'Submitting...' : 'Notify Me When Available'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Alternative Options */}
                <div className="mt-8 text-center">
                    <p className="text-[#091747]/60 mb-4 font-['Newsreader']">
                        Need to book an appointment right away?
                    </p>
                    <button
                        onClick={() => {/* Handle cash payment */ }}
                        className="px-6 py-3 border-2 border-[#BF9C73] text-[#BF9C73] hover:bg-[#BF9C73] hover:text-white rounded-xl transition-all duration-200 font-['Newsreader']"
                    >
                        {bookingScenario === 'self'
                            ? 'Continue with cash payment'
                            : 'Patient will pay out of pocket'
                        }
                    </button>
                </div>
            </div>
        </div>
    )
}