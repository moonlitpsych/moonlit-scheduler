// src/components/booking/views/ROIView.tsx
'use client'

import { useState } from 'react'
import { ROIContact } from '@/types/database'

interface ROIViewProps {
    isForSelf: boolean
    onComplete: (roiContacts: ROIContact[]) => void
    onBack: () => void
}

export default function ROIView({ isForSelf, onComplete, onBack }: ROIViewProps) {
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
            onComplete(contacts)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1]" style={{ fontFamily: 'Newsreader, serif' }}>
            <div className="max-w-3xl mx-auto py-16 px-4">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-light text-[#091747] mb-6">
                        Would you like others to be involved in your care?
                    </h1>
                    <p className="text-lg text-[#091747]/70 max-w-2xl mx-auto leading-relaxed">
                        You can add family members, friends, case managers, or other support people
                        who you'd like us to be able to communicate with about your care.
                    </p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Contact List */}
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
                                            className="text-[#F46D3C] hover:text-[#F46D3C]/80 font-medium transition-colors"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add Contact Form */}
                        <div className="space-y-6 border-t border-[#BF9C73]/20 pt-8">
                            <h3 className="text-lg font-medium text-[#091747]">Add Contact:</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-[#091747] mb-3">
                                        Contact Name
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Enter contact name"
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
                                        Email Address
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
                                        Organization (optional)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Organization name"
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

                            <button
                                type="button"
                                onClick={saveContact}
                                disabled={!newContact.name || !newContact.email}
                                className={`
                                    py-3 px-8 rounded-xl font-medium transition-all duration-200
                                    ${newContact.name && newContact.email
                                        ? 'bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-[#FEF8F1] hover:shadow-md hover:scale-105'
                                        : 'bg-[#BF9C73]/30 text-[#091747]/50 cursor-not-allowed'
                                    }
                                `}
                                style={{ fontFamily: 'Newsreader, serif' }}
                            >
                                Save Contact
                            </button>
                        </div>

                        {/* ROI Consent */}
                        <div className="border-t border-[#BF9C73]/20 pt-8">
                            <label className="flex items-start space-x-4">
                                <input
                                    type="checkbox"
                                    checked={agreedToROI}
                                    onChange={(e) => setAgreedToROI(e.target.checked)}
                                    className="mt-2 w-5 h-5 text-[#BF9C73] border-2 border-[#BF9C73]/30 rounded focus:ring-[#BF9C73] focus:ring-2"
                                />
                                <span className="text-[#091747]/80 leading-relaxed" style={{ fontFamily: 'Newsreader, serif' }}>
                                    I consent to Moonlit sharing my protected health information
                                    with the contacts listed above for the purpose of coordinating my care.
                                    I understand I can revoke this consent at any time.
                                </span>
                            </label>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-8">
                            <button
                                type="button"
                                onClick={onBack}
                                className="
                                    border-2 border-[#BF9C73]/50 hover:border-[#BF9C73] 
                                    text-[#091747] font-medium py-3 px-8 rounded-xl 
                                    transition-all duration-200 hover:shadow-md
                                    bg-white hover:bg-[#FEF8F1]
                                "
                                style={{ fontFamily: 'Newsreader, serif' }}
                            >
                                ← Back to information
                            </button>

                            <button
                                type="submit"
                                disabled={!agreedToROI}
                                className={`
                                    font-medium py-3 px-8 rounded-xl transition-all duration-200
                                    ${agreedToROI
                                        ? 'bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-[#FEF8F1] shadow-md hover:shadow-lg hover:scale-105'
                                        : 'bg-[#BF9C73]/30 text-[#091747]/50 cursor-not-allowed'
                                    }
                                `}
                                style={{ fontFamily: 'Newsreader, serif' }}
                            >
                                Complete Booking →
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}