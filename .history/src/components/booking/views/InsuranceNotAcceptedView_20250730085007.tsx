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

export function InsuranceNotAcceptedView({ payer, onLeadSubmitted, onCashPayment }: InsuranceNotAcceptedViewProps) {
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
                        className="w-full max-w-md mx-auto bg-white border-2 border-stone-200 rounded-md py-3 px-4 text-slate-800 placeholder-slate-500 focus:outline-none focus:border-orange-300"
                    />
                    <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Phone number (optional)"
                        className="w-full max-w-md mx-auto bg-white border-2 border-stone-200 rounded-md py-3 px-4 text-slate-800 placeholder-slate-500 focus:outline-none focus:border-orange-300"
                    />
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-orange-300 hover:bg-orange-400 disabled:bg-stone-300 text-slate-800 font-medium py-3 px-6 rounded-md transition-colors"
                    >
                        {isSubmitting ? 'Submitting...' : 'Notify me when available'}
                    </button>
                </form>

                <p className="text-slate-600 mb-4">Or, you can proceed with cash payment:</p>
                <button
                    onClick={onCashPayment}
                    className="border-2 border-orange-300 hover:border-orange-400 text-slate-800 font-medium py-3 px-6 rounded-md transition-colors bg-white"
                >
                    Continue with cash payment
                </button>
            </div>
        </div>
    )
}

// src/components/booking/views/InsuranceFutureView.tsx
interface InsuranceFutureViewProps {
    payer: Payer
    onWaitForEffectiveDate: () => void
    onCashPayment: () => void
}

export function InsuranceFutureView({ payer, onWaitForEffectiveDate, onCashPayment }: InsuranceFutureViewProps) {
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
                        className="block w-full max-w-md mx-auto bg-orange-300 hover:bg-orange-400 text-slate-800 font-medium py-4 px-6 rounded-md transition-colors"
                    >
                        Wait for insurance to be active
                    </button>

                    <button
                        onClick={onCashPayment}
                        className="block w-full max-w-md mx-auto border-2 border-orange-300 hover:border-orange-400 text-slate-800 font-medium py-4 px-6 rounded-md transition-colors bg-white"
                    >
                        Continue with cash payment
                    </button>
                </div>
            </div>
        </div>
    )
}

// src/components/booking/views/InsuranceInfoView.tsx
import { PatientInfo, InsuranceInfo } from '@/types/database'

interface InsuranceInfoViewProps {
    isForSelf: boolean
    onComplete: (insuranceInfo: InsuranceInfo) => void
}

export function InsuranceInfoView({ isForSelf, onComplete }: InsuranceInfoViewProps) {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        email: '',
        phone: '',
        memberId: '',
        groupNumber: ''
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        const insuranceInfo: InsuranceInfo = {
            payer_id: 'selected-payer-id', // This would come from context
            member_id: formData.memberId,
            group_number: formData.groupNumber || undefined
        }

        onComplete(insuranceInfo)
    }

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-normal text-slate-800 mb-8">
                    Please input your insurance information
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6 text-left">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                First Name *
                            </label>
                            <input
                                type="text"
                                value={formData.firstName}
                                onChange={(e) => handleChange('firstName', e.target.value)}
                                required
                                className="w-full bg-white border-2 border-stone-200 rounded-md py-3 px-4 text-slate-800 focus:outline-none focus:border-orange-300"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Last Name *
                            </label>
                            <input
                                type="text"
                                value={formData.lastName}
                                onChange={(e) => handleChange('lastName', e.target.value)}
                                required
                                className="w-full bg-white border-2 border-stone-200 rounded-md py-3 px-4 text-slate-800 focus:outline-none focus:border-orange-300"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Date of Birth *
                        </label>
                        <input
                            type="date"
                            value={formData.dateOfBirth}
                            onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                            required
                            className="w-full bg-white border-2 border-stone-200 rounded-md py-3 px-4 text-slate-800 focus:outline-none focus:border-orange-300"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Email Address *
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleChange('email', e.target.value)}
                            required
                            className="w-full bg-white border-2 border-stone-200 rounded-md py-3 px-4 text-slate-800 focus:outline-none focus:border-orange-300"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Phone Number
                        </label>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => handleChange('phone', e.target.value)}
                            className="w-full bg-white border-2 border-stone-200 rounded-md py-3 px-4 text-slate-800 focus:outline-none focus:border-orange-300"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Insurance Member ID *
                        </label>
                        <input
                            type="text"
                            value={formData.memberId}
                            onChange={(e) => handleChange('memberId', e.target.value)}
                            required
                            className="w-full bg-white border-2 border-stone-200 rounded-md py-3 px-4 text-slate-800 focus:outline-none focus:border-orange-300"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Group Number
                        </label>
                        <input
                            type="text"
                            value={formData.groupNumber}
                            onChange={(e) => handleChange('groupNumber', e.target.value)}
                            className="w-full bg-white border-2 border-stone-200 rounded-md py-3 px-4 text-slate-800 focus:outline-none focus:border-orange-300"
                        />
                    </div>

                    <div className="text-center pt-4">
                        <button
                            type="submit"
                            className="bg-orange-300 hover:bg-orange-400 text-slate-800 font-medium py-3 px-8 rounded-md transition-colors"
                        >
                            Continue to Care Team
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// src/components/booking/views/ROIView.tsx
import { ROIContact } from '@/types/database'

interface ROIViewProps {
    onComplete: (roiContacts: ROIContact[]) => void
}

export function ROIView({ onComplete }: ROIViewProps) {
    const [contacts, setContacts] = useState<ROIContact[]>([])
    const [newContact, setNewContact] = useState({ name: '', email: '', relationship: '', organization: '' })
    const [agreedToROI, setAgreedToROI] = useState(false)

    const addContact = () => {
        if (newContact.name && newContact.email) {
            setContacts([...contacts, { ...newContact }])
            setNewContact({ name: '', email: '', relationship: '', organization: '' })
        }
    }

    const removeContact = (index: number) => {
        setContacts(contacts.filter((_, i) => i !== index))
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (agreedToROI) {
            onComplete(contacts)
        }
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-normal text-slate-800 mb-8">
                    Would you like others to be involved in your care?
                </h2>

                <div className="text-left space-y-6">
                    <p className="text-slate-600">
                        You can add family members, friends, case managers, or other support people
                        who you'd like us to be able to communicate with about your care.
                    </p>

                    {/* Contact List */}
                    {contacts.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="font-medium text-slate-800">Added Contacts:</h3>
                            {contacts.map((contact, index) => (
                                <div key={index} className="flex items-center justify-between bg-stone-50 p-3 rounded-md">
                                    <div>
                                        <p className="font-medium">{contact.name}</p>
                                        <p className="text-sm text-slate-600">{contact.email}</p>
                                        {contact.relationship && (
                                            <p className="text-sm text-slate-600">{contact.relationship}</p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => removeContact(index)}
                                        className="text-red-600 hover:text-red-800 text-sm"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add Contact Form */}
                    <div className="space-y-4 border-t pt-6">
                        <h3 className="font-medium text-slate-800">Add Contact:</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                                type="text"
                                placeholder="Contact Name"
                                value={newContact.name}
                                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                                className="w-full bg-white border-2 border-stone-200 rounded-md py-3 px-4 text-slate-800 focus:outline-none focus:border-orange-300"
                            />
                            <input
                                type="email"
                                placeholder="Email Address"
                                value={newContact.email}
                                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                                className="w-full bg-white border-2 border-stone-200 rounded-md py-3 px-4 text-slate-800 focus:outline-none focus:border-orange-300"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                                type="text"
                                placeholder="Relationship (e.g., Mother, Case Manager)"
                                value={newContact.relationship}
                                onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
                                className="w-full bg-white border-2 border-stone-200 rounded-md py-3 px-4 text-slate-800 focus:outline-none focus:border-orange-300"
                            />
                            <input
                                type="text"
                                placeholder="Organization (optional)"
                                value={newContact.organization}
                                onChange={(e) => setNewContact({ ...newContact, organization: e.target.value })}
                                className="w-full bg-white border-2 border-stone-200 rounded-md py-3 px-4 text-slate-800 focus:outline-none focus:border-orange-300"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={addContact}
                            className="border-2 border-orange-300 hover:border-orange-400 text-slate-800 font-medium py-2 px-4 rounded-md transition-colors bg-white"
                        >
                            Add Contact
                        </button>
                    </div>

                    {/* ROI Consent */}
                    <div className="border-t pt-6">
                        <label className="flex items-start space-x-3">
                            <input
                                type="checkbox"
                                checked={agreedToROI}
                                onChange={(e) => setAgreedToROI(e.target.checked)}
                                className="mt-1"
                            />
                            <span className="text-sm text-slate-600">
                                I consent to Moonlit Psychiatry sharing my protected health information
                                with the contacts listed above for the purpose of coordinating my care.
                                I understand I can revoke this consent at any time.
                            </span>
                        </label>
                    </div>

                    <div className="text-center pt-6">
                        <button
                            onClick={handleSubmit}
                            disabled={!agreedToROI}
                            className={`
                py-3 px-8 rounded-md font-medium transition-colors
                ${agreedToROI
                                    ? 'bg-orange-300 hover:bg-orange-400 text-slate-800'
                                    : 'bg-stone-300 text-stone-500 cursor-not-allowed'
                                }
              `}
                        >
                            Complete Booking
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// src/components/booking/views/ConfirmationView.tsx
interface ConfirmationViewProps {
    appointment: {
        payer?: Payer
        timeSlot?: TimeSlot
        patientInfo?: PatientInfo
        appointmentId?: string
    }
    onStartOver: () => void
}

export function ConfirmationView({ appointment, onStartOver }: ConfirmationViewProps) {
    const { payer, timeSlot, appointmentId } = appointment

    return (
        <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-normal text-slate-800 mb-8">
                    Thank you for booking with Moonlit
                </h2>

                <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
                    <h3 className="text-lg font-medium text-slate-800 mb-4">
                        Your appointment is confirmed!
                    </h3>

                    {timeSlot && (
                        <div className="space-y-2 text-slate-700">
                            <p>
                                <strong>Date & Time:</strong> {new Date(timeSlot.start_time).toLocaleDateString()}
                                at {new Date(timeSlot.start_time).toLocaleTimeString()}
                            </p>
                            <p>
                                <strong>Duration:</strong> 60 minutes
                            </p>
                            <p>
                                <strong>Type:</strong> Video appointment
                            </p>
                            {payer && (
                                <p>
                                    <strong>Insurance:</strong> {payer.name}
                                </p>
                            )}
                            {appointmentId && (
                                <p>
                                    <strong>Confirmation #:</strong> {appointmentId}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div className="space-y-4 text-slate-600">
                    <p>
                        You'll receive a confirmation email with appointment details and
                        instructions for joining your video session.
                    </p>
                    <p>
                        If you need to reschedule or have questions, please contact our office
                        at least 24 hours before your appointment.
                    </p>
                </div>

                <div className="mt-8">
                    <button
                        onClick={onStartOver}
                        className="border-2 border-orange-300 hover:border-orange-400 text-slate-800 font-medium py-3 px-6 rounded-md transition-colors bg-white"
                    >
                        Book Another Appointment
                    </button>
                </div>
            </div>
        </div>
    )
}

// Export all components
export default function ViewsIndex() {
    // This is just for bundling - actual exports happen individually
    return null
}