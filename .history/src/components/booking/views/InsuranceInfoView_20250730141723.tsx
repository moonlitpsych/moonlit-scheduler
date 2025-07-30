// src/components/booking/views/InsuranceInfoView.tsx
'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { PatientInfo, InsuranceInfo, Payer } from '@/types/database'

interface InsuranceInfoViewProps {
    isForSelf: boolean
    selectedPayer?: Payer
    onComplete: (insuranceInfo: InsuranceInfo) => void
    onBack: () => void
    onSwitchInsurance?: () => void
}

export default function InsuranceInfoView({
    isForSelf,
    selectedPayer,
    onComplete,
    onBack,
    onSwitchInsurance
}: InsuranceInfoViewProps) {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        email: '',
        phone: '',
        memberId: '',
        groupNumber: ''
    })

    const [showSwitchModal, setShowSwitchModal] = useState(false)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        const insuranceInfo: InsuranceInfo = {
            payer_id: selectedPayer?.id || 'cash',
            member_id: formData.memberId,
            group_number: formData.groupNumber || undefined
        }

        onComplete(insuranceInfo)
    }

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleSwitchInsurance = () => {
        setShowSwitchModal(false)
        if (onSwitchInsurance) {
            onSwitchInsurance()
        }
    }

    return (
        <>
            <div className="min-h-screen bg-gradient-to-br from-stone-50 via-orange-50/30 to-stone-100">
                <div className="max-w-3xl mx-auto py-16 px-4">
                    <div className="text-center mb-12">
                        <h1 className="text-4xl font-light text-slate-800 mb-6">
                            Please input your information
                        </h1>
                        <p className="text-lg text-slate-600">
                            We'll use this information to verify your insurance and create your appointment.
                        </p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Insurance Type Field */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-3">
                                    Type of insurance
                                </label>
                                <div className="flex items-center justify-between bg-stone-50 border-2 border-stone-200 rounded-xl py-4 px-6">
                                    <span className="text-slate-800 font-medium">
                                        {selectedPayer?.name || 'Cash / Self-pay'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setShowSwitchModal(true)}
                                        className="text-blue-500 hover:text-blue-600 font-medium underline transition-colors"
                                    >
                                        Switch insurance
                                    </button>
                                </div>
                            </div>

                            {/* Name Fields */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-3">
                                        First Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.firstName}
                                        onChange={(e) => handleChange('firstName', e.target.value)}
                                        required
                                        className="
                                            w-full bg-stone-50 border-2 border-stone-200 rounded-xl 
                                            py-4 px-6 text-slate-800 placeholder-slate-500 
                                            focus:outline-none focus:border-orange-300 focus:bg-white
                                            transition-all duration-200
                                        "
                                        placeholder="Enter your first name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-3">
                                        Last Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.lastName}
                                        onChange={(e) => handleChange('lastName', e.target.value)}
                                        required
                                        className="
                                            w-full bg-stone-50 border-2 border-stone-200 rounded-xl 
                                            py-4 px-6 text-slate-800 placeholder-slate-500 
                                            focus:outline-none focus:border-orange-300 focus:bg-white
                                            transition-all duration-200
                                        "
                                        placeholder="Enter your last name"
                                    />
                                </div>
                            </div>

                            {/* Date of Birth */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-3">
                                    Date of Birth *
                                </label>
                                <input
                                    type="date"
                                    value={formData.dateOfBirth}
                                    onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                                    required
                                    className="
                                        w-full bg-stone-50 border-2 border-stone-200 rounded-xl 
                                        py-4 px-6 text-slate-800 placeholder-slate-500 
                                        focus:outline-none focus:border-orange-300 focus:bg-white
                                        transition-all duration-200
                                    "
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-3">
                                    Email Address *
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleChange('email', e.target.value)}
                                    required
                                    className="
                                        w-full bg-stone-50 border-2 border-stone-200 rounded-xl 
                                        py-4 px-6 text-slate-800 placeholder-slate-500 
                                        focus:outline-none focus:border-orange-300 focus:bg-white
                                        transition-all duration-200
                                    "
                                    placeholder="your.email@example.com"
                                />
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-3">
                                    Phone Number
                                </label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => handleChange('phone', e.target.value)}
                                    className="
                                        w-full bg-stone-50 border-2 border-stone-200 rounded-xl 
                                        py-4 px-6 text-slate-800 placeholder-slate-500 
                                        focus:outline-none focus:border-orange-300 focus:bg-white
                                        transition-all duration-200
                                    "
                                    placeholder="(555) 123-4567"
                                />
                            </div>

                            {/* Insurance Member ID */}
                            {selectedPayer && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-3">
                                        Insurance Member ID *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.memberId}
                                        onChange={(e) => handleChange('memberId', e.target.value)}
                                        required
                                        className="
                                            w-full bg-stone-50 border-2 border-stone-200 rounded-xl 
                                            py-4 px-6 text-slate-800 placeholder-slate-500 
                                            focus:outline-none focus:border-orange-300 focus:bg-white
                                            transition-all duration-200
                                        "
                                        placeholder="Enter your member ID from your insurance card"
                                    />
                                </div>
                            )}

                            {/* Group Number */}
                            {selectedPayer && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-3">
                                        Group Number
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.groupNumber}
                                        onChange={(e) => handleChange('groupNumber', e.target.value)}
                                        className="
                                            w-full bg-stone-50 border-2 border-stone-200 rounded-xl 
                                            py-4 px-6 text-slate-800 placeholder-slate-500 
                                            focus:outline-none focus:border-orange-300 focus:bg-white
                                            transition-all duration-200
                                        "
                                        placeholder="Enter group number (if applicable)"
                                    />
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex items-center justify-between pt-6">
                                <button
                                    type="button"
                                    onClick={onBack}
                                    className="
                                        border-2 border-stone-300 hover:border-stone-400 
                                        text-slate-700 font-medium py-3 px-8 rounded-xl 
                                        transition-all duration-200 hover:shadow-md
                                        bg-white hover:bg-stone-50
                                    "
                                >
                                    ← Back to calendar
                                </button>

                                <button
                                    type="submit"
                                    className="
                                        bg-orange-300 hover:bg-orange-400 text-slate-800 
                                        font-medium py-3 px-8 rounded-xl transition-all duration-200
                                        hover:shadow-lg hover:scale-105
                                    "
                                >
                                    Continue to Care Team →
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            {/* Switch Insurance Modal */}
            {showSwitchModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 transform animate-in fade-in-0 zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-medium text-slate-800">
                                Switch Insurance
                            </h3>
                            <button
                                onClick={() => setShowSwitchModal(false)}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <p className="text-slate-600 mb-8">
                            Would you like to start over with a new insurance search? This will take you back to the beginning of the process.
                        </p>

                        <div className="flex space-x-4">
                            <button
                                onClick={() => setShowSwitchModal(false)}
                                className="
                                    flex-1 py-3 px-6 border-2 border-stone-300 hover:border-stone-400 
                                    text-slate-700 font-medium rounded-xl transition-all duration-200
                                    bg-white hover:bg-stone-50
                                "
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSwitchInsurance}
                                className="
                                    flex-1 py-3 px-6 bg-orange-300 hover:bg-orange-400 
                                    text-slate-800 font-medium rounded-xl transition-all duration-200
                                    hover:shadow-md
                                "
                            >
                                Yes, start over
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}