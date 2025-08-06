// src/components/booking/views/ROIView.tsx
'use client'

import { PatientInfo, ROIContact } from '@/types/database'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

// Define types locally since they may not be exported from WelcomeView
export type BookingScenario = 'self' | 'referral' | 'case-manager'

interface CaseManagerInfo {
    name: string
    email: string
    phone?: string
    organization?: string
}

interface ROIViewProps {
    patientInfo?: PatientInfo
    bookingScenario: BookingScenario
    caseManagerInfo?: CaseManagerInfo
    onSubmit: (roiContacts: ROIContact[]) => void
    onBack: () => void
}

export default function ROIView({ 
    patientInfo, 
    bookingScenario, 
    caseManagerInfo, 
    onSubmit, 
    onBack 
}: ROIViewProps) {
    const [contacts, setContacts] = useState<ROIContact[]>([])
    const [newContact, setNewContact] = useState({
        name: '',
        email: '',
        relationship: '',
        organization: ''
    })
    const [agreedToROI, setAgreedToROI] = useState(false)

    const saveContact = () => {
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
            onSubmit(contacts)
        }
    }

    const getTitle = () => {
        switch (bookingScenario) {
            case 'self':
                return 'Would you like others to be involved in your care?'
            case 'referral':
                return 'Who should be involved in their care?'
            case 'case-manager':
                return `Who should be involved in ${patientInfo?.first_name || 'the patient'}'s care?`
            default:
                return 'Care Team Information'
        }
    }

    const getDescription = () => {
        switch (bookingScenario) {
            case 'self':
                return 'You can add family members, friends, case managers, or other support people who you\'d like us to be able to communicate with about your care.'
            case 'referral':
                return 'Add family members, friends, case managers, or other support people who the patient would like to be involved in their care.'
            case 'case-manager':
                return `Add family members, friends, other case managers, or support people who should be involved in ${patientInfo?.first_name || 'the patient'}'s care.`
            default:
                return 'Add people who should be involved in care coordination.'
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1]" style={{ fontFamily: 'Newsreader, serif' }}>
            <div className="max-w-3xl mx-auto py-16 px-4">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-light text-[#091747] mb-6">
                        {getTitle()}
                    </h1>
                    <p className="text-lg text-[#091747]/70 max-w-2xl mx-auto leading-relaxed">
                        {getDescription()}
                    </p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Existing Contacts */}
                        {contacts.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium text-[#091747] mb-4">Added Contacts:</h3>
                                {contacts.map((contact, index) => (
                                    <div key={index} className="flex items-center justify-between bg-[#FEF8F1] p-4 rounded-xl border border-[#BF9C73]/20">
                                        <div>
                                            <p className="font-medium text-[#091747] text-lg">{contact.name}</p>
                                            <p className="text-[#091747]/70">{contact.email}</p>
                                            {contact.relationship && (
                                                <p className="text-[#091747]/70 text-sm">{contact.relationship}</p>
                                            )}
                                            {contact.organization && (
                                                <p className="text-[#091747]/70 text-sm">{contact.organization}</p>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeContact(index)}
                                            className="text-[#F46D3C] hover:text-[#F46D3C]/80 font-medium transition-colors flex items-center space-x-1"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            <span>Remove</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add New Contact Form */}
                        <div className="space-y-6">
                            <h3 className="text-lg font-medium text-[#091747] flex items-center space-x-2">
                                <Plus className="w-5 h-5" />
                                <span>Add Contact</span>
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-[#091747] mb-3">
                                        Name *
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Contact's full name"
                                        value={newContact.name}
                                        onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                                        className="
                                            w-full bg-[#FEF8F1] border-2 border-[#BF9C73]/30 rounded-xl 
                                            py-4 px-6 text-[#091747] placeholder-[#091747]/50 
                                            focus:outline-none focus:border-[#BF9C73] focus:bg-white
                                            transition-all duration-200
                                        "
                                        style={{ fontFamily: 'Newsreader, serif' }}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[#091747] mb-3">
                                        Email *
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="contact@example.com"
                                        value={newContact.email}
                                        onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                                        className="
                                            w-full bg-[#FEF8F1] border-2 border-[#BF9C73]/30 rounded-xl 
                                            py-4 px-6 text-[#091747] placeholder-[#091747]/50 
                                            focus:outline-none focus:border-[#BF9C73] focus:bg-white
                                            transition-all duration-200
                                        "
                                        style={{ fontFamily: 'Newsreader, serif' }}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-[#091747] mb-3">
                                        Relationship
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g., Mother, Case Manager"
                                        value={newContact.relationship}
                                        onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
                                        className="
                                            w-full bg-[#FEF8F1] border-2 border-[#BF9C73]/30 rounded-xl 
                                            py-4 px-6 text-[#091747] placeholder-[#091747]/50 
                                            focus:outline-none focus:border-[#BF9C73] focus:bg-white
                                            transition-all duration-200
                                        "
                                        style={{ fontFamily: 'Newsreader, serif' }}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[#091747] mb-3">
                                        Organization
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g., First Step House, Family Services"
                                        value={newContact.organization}
                                        onChange={(e) => setNewContact({ ...newContact, organization: e.target.value })}
                                        className="
                                            w-full bg-[#FEF8F1] border-2 border-[#BF9C73]/30 rounded-xl 
                                            py-4 px-6 text-[#091747] placeholder-[#091747]/50 
                                            focus:outline-none focus:border-[#BF9C73] focus:bg-white
                                            transition-all duration-200
                                        "
                                        style={{ fontFamily: 'Newsreader, serif' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <button
                                    type="button"
                                    onClick={saveContact}
                                    disabled={!newContact.name || !newContact.email}
                                    className="
                                        px-6 py-3 bg-[#17DB4E] hover:bg-[#17DB4E]/90 
                                        disabled:bg-gray-300 disabled:cursor-not-allowed
                                        text-white rounded-xl font-medium transition-colors
                                        flex items-center space-x-2
                                    "
                                    style={{ fontFamily: 'Newsreader, serif' }}
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Add Contact</span>
                                </button>
                            </div>
                        </div>

                        {/* ROI Agreement */}
                        <div className="bg-[#FEF8F1] rounded-xl p-6 border border-[#BF9C73]/20">
                            <div className="flex items-start space-x-3">
                                <input
                                    type="checkbox"
                                    id="roi-agreement"
                                    checked={agreedToROI}
                                    onChange={(e) => setAgreedToROI(e.target.checked)}
                                    className="mt-1 w-5 h-5 text-[#BF9C73] bg-white border-2 border-[#BF9C73]/30 rounded focus:ring-[#BF9C73] focus:ring-2"
                                />
                                <div>
                                    <label htmlFor="roi-agreement" className="text-[#091747] font-medium cursor-pointer">
                                        Release of Information Agreement
                                    </label>
                                    <p className="text-[#091747]/70 text-sm mt-2 leading-relaxed">
                                        I authorize Moonlit Psychiatry to communicate with the contacts listed above regarding 
                                        appointment scheduling, treatment coordination, and other care-related matters. 
                                        This authorization extends to phone calls, emails, and other forms of communication 
                                        necessary for coordinated care.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Navigation Buttons */}
                        <div className="flex justify-between pt-6">
                            <button
                                type="button"
                                onClick={onBack}
                                className="
                                    flex items-center space-x-2 px-6 py-3 
                                    border-2 border-[#BF9C73]/30 hover:border-[#BF9C73] 
                                    text-[#091747] rounded-xl transition-colors
                                "
                                style={{ fontFamily: 'Newsreader, serif' }}
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span>Back</span>
                            </button>

                            <button
                                type="submit"
                                disabled={!agreedToROI}
                                className="
                                    px-8 py-3 bg-[#BF9C73] hover:bg-[#BF9C73]/90 
                                    disabled:bg-gray-300 disabled:cursor-not-allowed
                                    text-white rounded-xl font-medium transition-colors
                                "
                                style={{ fontFamily: 'Newsreader, serif' }}
                            >
                                Continue to Confirmation
                            </button>
                        </div>

                        {/* Skip Option */}
                        <div className="text-center pt-4">
                            <button
                                type="button"
                                onClick={() => onSubmit([])}
                                className="text-[#091747]/60 hover:text-[#091747] text-sm underline transition-colors"
                                style={{ fontFamily: 'Newsreader, serif' }}
                            >
                                Skip - No additional contacts needed
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}