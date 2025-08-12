'use client'

import { InsuranceInfo, Payer, TimeSlot } from '@/types/database'
import { useState } from 'react'
import { BookingScenario } from './WelcomeView'

interface InsuranceInfoViewProps {
    selectedPayer: Payer
    selectedTimeSlot: TimeSlot
    bookingScenario: BookingScenario
    caseManagerInfo?: {
        name: string
        email: string
        phone?: string
        organization?: string
    }
    communicationPreferences: {
        sendToPatient: boolean
        sendToCaseManager: boolean
        patientHasEmail: boolean
    }
    onSubmit: (insuranceInfo: InsuranceInfo) => void
    onBack: () => void
    onChangeAppointment?: () => void // NEW: Quick change appointment
    onChangeInsurance?: () => void  // NEW: Quick change insurance
}

export default function InsuranceInfoView({
    selectedPayer,
    selectedTimeSlot,
    bookingScenario,
    caseManagerInfo,
    communicationPreferences,
    onSubmit,
    onBack,
    onChangeAppointment,
    onChangeInsurance
}: InsuranceInfoViewProps) {
    const [formData, setFormData] = useState({
        // Patient Information
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        state: 'UT',
        zipCode: '',
        
        // Insurance Information
        memberId: '',
        groupNumber: '',
        subscriberName: '',
        subscriberDateOfBirth: '',
        relationshipToSubscriber: 'self',
        
        // Emergency Contact
        emergencyContactName: '',
        emergencyContactPhone: '',
        emergencyContactRelationship: '',
        
        // Medical Information
        primaryCarePhysician: '',
        reasonForVisit: '',
        currentMedications: '',
        allergies: '',
        previousPsychiatricTreatment: false,
        previousPsychiatricDetails: ''
    })

    const [errors, setErrors] = useState<Record<string, string>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target
        
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
        }))

        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }))
        }
    }

    const validateForm = () => {
        const newErrors: Record<string, string> = {}

        // Required fields
        if (!formData.firstName.trim()) newErrors.firstName = 'First name is required'
        if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required'
        if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required'
        if (!formData.phone.trim()) newErrors.phone = 'Phone number is required'
        if (!formData.memberId.trim()) newErrors.memberId = 'Member ID is required'
        
        // Email validation (only if patient has email in communication preferences)
        if (communicationPreferences.patientHasEmail && !formData.email.trim()) {
            newErrors.email = 'Email is required'
        } else if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Valid email is required'
        }

        // Emergency contact
        if (!formData.emergencyContactName.trim()) newErrors.emergencyContactName = 'Emergency contact name is required'
        if (!formData.emergencyContactPhone.trim()) newErrors.emergencyContactPhone = 'Emergency contact phone is required'

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!validateForm()) {
            return
        }

        setIsSubmitting(true)

        try {
            const insuranceInfo: InsuranceInfo = {
                patient: {
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    dateOfBirth: formData.dateOfBirth,
                    phone: formData.phone,
                    email: formData.email,
                    address: {
                        street: formData.address,
                        city: formData.city,
                        state: formData.state,
                        zipCode: formData.zipCode
                    }
                },
                insurance: {
                    payerId: selectedPayer.id,
                    payerName: selectedPayer.name,
                    memberId: formData.memberId,
                    groupNumber: formData.groupNumber,
                    subscriberName: formData.subscriberName || `${formData.firstName} ${formData.lastName}`,
                    subscriberDateOfBirth: formData.subscriberDateOfBirth || formData.dateOfBirth,
                    relationshipToSubscriber: formData.relationshipToSubscriber as 'self' | 'spouse' | 'child' | 'other'
                },
                emergencyContact: {
                    name: formData.emergencyContactName,
                    phone: formData.emergencyContactPhone,
                    relationship: formData.emergencyContactRelationship
                },
                medical: {
                    primaryCarePhysician: formData.primaryCarePhysician,
                    reasonForVisit: formData.reasonForVisit,
                    currentMedications: formData.currentMedications,
                    allergies: formData.allergies,
                    previousPsychiatricTreatment: formData.previousPsychiatricTreatment,
                    previousPsychiatricDetails: formData.previousPsychiatricDetails
                }
            }

            onSubmit(insuranceInfo)
        } catch (error) {
            console.error('Error submitting insurance info:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const formatDateTime = (date: string, startTime: string) => {
        const dateObj = new Date(date)
        const [hours, minutes] = startTime.split(':')
        dateObj.setHours(parseInt(hours), parseInt(minutes))
        
        return dateObj.toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        })
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#1a2c5b] to-[#2d4a7c]">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="text-white text-center mb-8">
                    <h1 className="text-4xl font-bold mb-4">Patient Information</h1>
                    <p className="text-xl opacity-90 mb-6">
                        Please provide your information to complete your booking
                    </p>

                    {/* Appointment Summary */}
                    <div className="bg-white/10 rounded-2xl p-6 max-w-2xl mx-auto mb-6">
                        <div className="text-left">
                            <h3 className="text-lg font-semibold mb-4">Your Appointment</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="opacity-80">Date & Time:</span>
                                    <span className="font-medium">
                                        {formatDateTime(selectedTimeSlot.date, selectedTimeSlot.start_time)}
                                    </span>
                                </div>
                                {selectedTimeSlot.provider_name && (
                                    <div className="flex justify-between items-center">
                                        <span className="opacity-80">Provider:</span>
                                        <span className="font-medium">{selectedTimeSlot.provider_name}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center">
                                    <span className="opacity-80">Insurance:</span>
                                    <span className="font-medium">{selectedPayer.name}</span>
                                </div>
                            </div>
                            
                            {/* Quick Change Options */}
                            <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-white/20">
                                {onChangeAppointment && (
                                    <button
                                        type="button"
                                        onClick={onChangeAppointment}
                                        className="text-sm text-white/80 hover:text-white transition-colors"
                                    >
                                        Change Appointment
                                    </button>
                                )}
                                {onChangeInsurance && (
                                    <button
                                        type="button"
                                        onClick={onChangeInsurance}
                                        className="text-sm text-white/80 hover:text-white transition-colors"
                                    >
                                        Change Insurance
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <div className="max-w-4xl mx-auto">
                    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 shadow-lg">
                        
                        {/* Patient Information Section */}
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">Patient Information</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                                        First Name *
                                    </label>
                                    <input
                                        type="text"
                                        id="firstName"
                                        name="firstName"
                                        value={formData.firstName}
                                        onChange={handleInputChange}
                                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73] ${
                                            errors.firstName ? 'border-red-500' : 'border-gray-300'
                                        }`}
                                    />
                                    {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
                                </div>

                                <div>
                                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                                        Last Name *
                                    </label>
                                    <input
                                        type="text"
                                        id="lastName"
                                        name="lastName"
                                        value={formData.lastName}
                                        onChange={handleInputChange}
                                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73] ${
                                            errors.lastName ? 'border-red-500' : 'border-gray-300'
                                        }`}
                                    />
                                    {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
                                </div>

                                <div>
                                    <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-2">
                                        Date of Birth *
                                    </label>
                                    <input
                                        type="date"
                                        id="dateOfBirth"
                                        name="dateOfBirth"
                                        value={formData.dateOfBirth}
                                        onChange={handleInputChange}
                                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73] ${
                                            errors.dateOfBirth ? 'border-red-500' : 'border-gray-300'
                                        }`}
                                    />
                                    {errors.dateOfBirth && <p className="text-red-500 text-sm mt-1">{errors.dateOfBirth}</p>}
                                </div>

                                <div>
                                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                                        Phone Number *
                                    </label>
                                    <input
                                        type="tel"
                                        id="phone"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        placeholder="(555) 123-4567"
                                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73] ${
                                            errors.phone ? 'border-red-500' : 'border-gray-300'
                                        }`}
                                    />
                                    {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
                                </div>

                                {communicationPreferences.patientHasEmail && (
                                    <div>
                                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                            Email Address *
                                        </label>
                                        <input
                                            type="email"
                                            id="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73] ${
                                                errors.email ? 'border-red-500' : 'border-gray-300'
                                            }`}
                                        />
                                        {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Insurance Information Section */}
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">Insurance Information</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="memberId" className="block text-sm font-medium text-gray-700 mb-2">
                                        Member ID *
                                    </label>
                                    <input
                                        type="text"
                                        id="memberId"
                                        name="memberId"
                                        value={formData.memberId}
                                        onChange={handleInputChange}
                                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73] ${
                                            errors.memberId ? 'border-red-500' : 'border-gray-300'
                                        }`}
                                    />
                                    {errors.memberId && <p className="text-red-500 text-sm mt-1">{errors.memberId}</p>}
                                </div>

                                <div>
                                    <label htmlFor="groupNumber" className="block text-sm font-medium text-gray-700 mb-2">
                                        Group Number
                                    </label>
                                    <input
                                        type="text"
                                        id="groupNumber"
                                        name="groupNumber"
                                        value={formData.groupNumber}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73]"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="relationshipToSubscriber" className="block text-sm font-medium text-gray-700 mb-2">
                                        Relationship to Subscriber
                                    </label>
                                    <select
                                        id="relationshipToSubscriber"
                                        name="relationshipToSubscriber"
                                        value={formData.relationshipToSubscriber}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73]"
                                    >
                                        <option value="self">Self</option>
                                        <option value="spouse">Spouse</option>
                                        <option value="child">Child</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Emergency Contact Section */}
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">Emergency Contact</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="emergencyContactName" className="block text-sm font-medium text-gray-700 mb-2">
                                        Name *
                                    </label>
                                    <input
                                        type="text"
                                        id="emergencyContactName"
                                        name="emergencyContactName"
                                        value={formData.emergencyContactName}
                                        onChange={handleInputChange}
                                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73] ${
                                            errors.emergencyContactName ? 'border-red-500' : 'border-gray-300'
                                        }`}
                                    />
                                    {errors.emergencyContactName && <p className="text-red-500 text-sm mt-1">{errors.emergencyContactName}</p>}
                                </div>

                                <div>
                                    <label htmlFor="emergencyContactPhone" className="block text-sm font-medium text-gray-700 mb-2">
                                        Phone Number *
                                    </label>
                                    <input
                                        type="tel"
                                        id="emergencyContactPhone"
                                        name="emergencyContactPhone"
                                        value={formData.emergencyContactPhone}
                                        onChange={handleInputChange}
                                        placeholder="(555) 123-4567"
                                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73] ${
                                            errors.emergencyContactPhone ? 'border-red-500' : 'border-gray-300'
                                        }`}
                                    />
                                    {errors.emergencyContactPhone && <p className="text-red-500 text-sm mt-1">{errors.emergencyContactPhone}</p>}
                                </div>

                                <div>
                                    <label htmlFor="emergencyContactRelationship" className="block text-sm font-medium text-gray-700 mb-2">
                                        Relationship
                                    </label>
                                    <input
                                        type="text"
                                        id="emergencyContactRelationship"
                                        name="emergencyContactRelationship"
                                        value={formData.emergencyContactRelationship}
                                        onChange={handleInputChange}
                                        placeholder="e.g., Spouse, Parent, Sibling"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Medical Information Section */}
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">Medical Information</h2>
                            <div className="space-y-6">
                                <div>
                                    <label htmlFor="reasonForVisit" className="block text-sm font-medium text-gray-700 mb-2">
                                        Reason for Visit
                                    </label>
                                    <textarea
                                        id="reasonForVisit"
                                        name="reasonForVisit"
                                        value={formData.reasonForVisit}
                                        onChange={handleInputChange}
                                        rows={3}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73]"
                                        placeholder="Please describe your main concerns or symptoms..."
                                    />
                                </div>

                                <div>
                                    <label htmlFor="currentMedications" className="block text-sm font-medium text-gray-700 mb-2">
                                        Current Medications
                                    </label>
                                    <textarea
                                        id="currentMedications"
                                        name="currentMedications"
                                        value={formData.currentMedications}
                                        onChange={handleInputChange}
                                        rows={3}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73]"
                                        placeholder="List all medications, dosages, and frequencies..."
                                    />
                                </div>

                                <div>
                                    <label htmlFor="allergies" className="block text-sm font-medium text-gray-700 mb-2">
                                        Allergies
                                    </label>
                                    <textarea
                                        id="allergies"
                                        name="allergies"
                                        value={formData.allergies}
                                        onChange={handleInputChange}
                                        rows={2}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73]"
                                        placeholder="List any known allergies or enter 'None'..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Form Actions */}
                        <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={onBack}
                                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                Back to Calendar
                            </button>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-8 py-3 bg-[#BF9C73] text-white rounded-xl font-medium hover:bg-[#A8865F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? 'Submitting...' : 'Continue to ROI'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}