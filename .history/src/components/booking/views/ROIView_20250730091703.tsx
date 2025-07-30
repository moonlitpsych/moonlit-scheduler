// src/components/booking/views/ROIView.tsx
'use client'

import { useState } from 'react'
import { ROIContact } from '@/types/database'

interface ROIViewProps {
    onComplete: (roiContacts: ROIContact[]) => void
}

export default function ROIView({ onComplete }: ROIViewProps) {
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
                                className="form-input"
                            />
                            <input
                                type="email"
                                placeholder="Email Address"
                                value={newContact.email}
                                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                                className="form-input"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                                type="text"
                                placeholder="Relationship (e.g., Mother, Case Manager)"
                                value={newContact.relationship}
                                onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
                                className="form-input"
                            />
                            <input
                                type="text"
                                placeholder="Organization (optional)"
                                value={newContact.organization}
                                onChange={(e) => setNewContact({ ...newContact, organization: e.target.value })}
                                className="form-input"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={addContact}
                            className="btn-secondary"
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
                btn-primary
                ${!agreedToROI ? 'opacity-50 cursor-not-allowed' : ''}
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