// src/components/booking/views/InsuranceInfoView.tsx
'use client'

import { useState } from 'react'
import { PatientInfo, InsuranceInfo } from '@/types/database'

interface InsuranceInfoViewProps {
    isForSelf: boolean
    onComplete: (insuranceInfo: InsuranceInfo) => void
}

export default function InsuranceInfoView({ isForSelf, onComplete }: InsuranceInfoViewProps) {
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
                                className="form-input"
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
                                className="form-input"
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
                            className="form-input"
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
                            className="form-input"
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
                            className="form-input"
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
                            className="form-input"
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
                            className="form-input"
                        />
                    </div>

                    <div className="text-center pt-4">
                        <button
                            type="submit"
                            className="btn-primary"
                        >
                            Continue to Care Team
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}