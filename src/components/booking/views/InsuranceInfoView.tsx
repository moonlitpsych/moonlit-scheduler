// src/components/booking/views/InsuranceInfoView.tsx
'use client'

import { BookingScenario, PatientInfo, Payer, TimeSlot } from '@/types/database'
import { format } from 'date-fns'
import { ArrowLeft, ArrowRight, Calendar, Clock } from 'lucide-react'
import { useState } from 'react'

interface InsuranceInfoViewProps {
    selectedPayer: Payer
    selectedTimeSlot: TimeSlot
    bookingScenario: BookingScenario
    onSubmit: (patientInfo: PatientInfo, bookingForSomeoneElse?: boolean, thirdPartyType?: 'case-manager' | 'referral') => void
    onBack: () => void
}

export default function InsuranceInfoView({ 
    selectedPayer, 
    selectedTimeSlot, 
    bookingScenario,
    onSubmit, 
    onBack 
}: InsuranceInfoViewProps) {
    const [patientInfo, setPatientInfo] = useState<PatientInfo>({
        firstName: '',
        lastName: '',
        dob: '',
        email: '',
        phone: '',
        insuranceId: '',
        address: ''
    })

    const [errors, setErrors] = useState<Record<string, string>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)
    
    // NEW: Third-party booking state
    const [bookingForSomeoneElse, setBookingForSomeoneElse] = useState(false)
    const [thirdPartyType, setThirdPartyType] = useState<'case-manager' | 'referral'>('referral')

    // FIXED: Safe time formatting function
    const formatDateTime = (timeSlot: TimeSlot): { date: string, time: string } => {
        try {
            if (!timeSlot?.start_time) {
                return { date: 'Date not available', time: 'Time not available' }
            }

            let dateToFormat: Date

            // Handle different time formats safely
            if (timeSlot.start_time.includes('T') || timeSlot.start_time.includes('-')) {
                // Full datetime string
                dateToFormat = new Date(timeSlot.start_time)
            } else {
                // Time-only string like "09:00:00" - need to create a proper date
                const today = new Date()
                const timeParts = timeSlot.start_time.split(':')
                if (timeParts.length >= 2) {
                    const hours = parseInt(timeParts[0], 10)
                    const minutes = parseInt(timeParts[1], 10)
                    dateToFormat = new Date(today)
                    dateToFormat.setHours(hours, minutes, 0, 0)
                } else {
                    // Fallback if split fails
                    dateToFormat = new Date()
                    dateToFormat.setHours(9, 0, 0, 0)
                }
            }

            // Validate the date
            if (isNaN(dateToFormat.getTime())) {
                console.warn('Invalid date created from:', timeSlot.start_time)
                return { date: 'Date not available', time: 'Time not available' }
            }

            return {
                date: format(dateToFormat, 'EEEE, MMMM d, yyyy'),
                time: format(dateToFormat, 'h:mm a')
            }
        } catch (error) {
            console.error('Error formatting datetime:', error, timeSlot)
            return { date: 'Date not available', time: 'Time not available' }
        }
    }

    const timeSlotFormatted = formatDateTime(selectedTimeSlot)

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {}

        if (!patientInfo.firstName.trim()) {
            newErrors.firstName = 'First name is required'
        }

        if (!patientInfo.lastName.trim()) {
            newErrors.lastName = 'Last name is required'
        }

        if (!patientInfo.dob) {
            newErrors.dob = 'Date of birth is required'
        }

        if (!patientInfo.email.trim()) {
            newErrors.email = 'Email is required'
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientInfo.email)) {
            newErrors.email = 'Please enter a valid email address'
        }

        if (!patientInfo.phone.trim()) {
            newErrors.phone = 'Phone number is required'
        }

        if (!patientInfo.insuranceId.trim()) {
            newErrors.insuranceId = 'Insurance ID is required'
        }

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
            // Add a small delay for better UX
            await new Promise(resolve => setTimeout(resolve, 500))
            onSubmit(patientInfo, bookingForSomeoneElse, thirdPartyType)
        } catch (error) {
            console.error('Error submitting patient info:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleInputChange = (field: keyof PatientInfo, value: string) => {
        setPatientInfo(prev => ({ ...prev, [field]: value }))
        
        // Clear error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }))
        }
    }

    const getScenarioTitle = (): string => {
        if (bookingForSomeoneElse) {
            return thirdPartyType === 'case-manager' 
                ? 'Patient Information for Case Manager Booking'
                : 'Patient Information for Referral'
        }
        return 'Your Information'
    }

    const getScenarioDescription = (): string => {
        if (bookingForSomeoneElse) {
            return thirdPartyType === 'case-manager'
                ? 'Please provide the patient\'s information below. As the case manager, you will receive all appointment communications.'
                : 'Please provide the patient\'s information for this referral.'
        }
        return 'Please provide your information below to complete the booking.'
    }

    const getFieldLabel = (baseLabel: string): string => {
        if (bookingForSomeoneElse) {
            return baseLabel.replace('Your ', 'Patient\'s ').replace('Enter ', 'Enter patient\'s ')
        }
        return baseLabel
    }

    return (
        <div className="max-w-2xl mx-auto p-6">
            {/* Header */}
            <div className="text-center mb-8">
                <h1 className="text-3xl font-normal text-slate-800 mb-2 font-['Newsreader']">
                    {getScenarioTitle()}
                </h1>
                <p className="text-slate-600 font-['Newsreader']">
                    {getScenarioDescription()}
                </p>
            </div>

            {/* Appointment Summary */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-8">
                <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-800 font-['Newsreader']">
                            Appointment Scheduled
                        </h3>
                        <p className="text-sm text-slate-600 font-['Newsreader']">
                            {selectedPayer.name}
                        </p>
                    </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-slate-600 mb-1 font-['Newsreader']">Date</p>
                        <p className="font-medium text-slate-800 font-['Newsreader']">
                            {timeSlotFormatted.date}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-600 mb-1 font-['Newsreader']">Time</p>
                        <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-slate-500" />
                            <span className="font-medium text-slate-800 font-['Newsreader']">
                                {timeSlotFormatted.time}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Third-Party Booking Detection */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 mb-8">
                <div className="flex items-center space-x-3 mb-4">
                    <input
                        type="checkbox"
                        id="bookingForSomeoneElse"
                        checked={bookingForSomeoneElse}
                        onChange={(e) => setBookingForSomeoneElse(e.target.checked)}
                        className="w-5 h-5 text-[#BF9C73] border-gray-300 rounded focus:ring-[#BF9C73]"
                    />
                    <label htmlFor="bookingForSomeoneElse" className="font-medium text-slate-800 font-['Newsreader']">
                        I'm booking this appointment for someone else
                    </label>
                </div>

                {bookingForSomeoneElse && (
                    <div className="ml-8 space-y-3">
                        <p className="text-sm text-slate-600 font-['Newsreader'] mb-3">
                            Please select your role in this appointment:
                        </p>
                        <div className="space-y-2">
                            <div className="flex items-center space-x-3">
                                <input
                                    type="radio"
                                    id="referral"
                                    name="thirdPartyType"
                                    value="referral"
                                    checked={thirdPartyType === 'referral'}
                                    onChange={() => setThirdPartyType('referral')}
                                    className="w-4 h-4 text-[#BF9C73] border-gray-300 focus:ring-[#BF9C73]"
                                />
                                <label htmlFor="referral" className="text-slate-700 font-['Newsreader']">
                                    <span className="font-medium">Referring partner</span> - I'm helping them book but won't be involved in ongoing care
                                </label>
                            </div>
                            <div className="flex items-center space-x-3">
                                <input
                                    type="radio"
                                    id="case-manager"
                                    name="thirdPartyType"
                                    value="case-manager"
                                    checked={thirdPartyType === 'case-manager'}
                                    onChange={() => setThirdPartyType('case-manager')}
                                    className="w-4 h-4 text-[#BF9C73] border-gray-300 focus:ring-[#BF9C73]"
                                />
                                <label htmlFor="case-manager" className="text-slate-700 font-['Newsreader']">
                                    <span className="font-medium">Case manager</span> - I coordinate their ongoing care and need to receive communications
                                </label>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Patient Information Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2 font-['Newsreader']">
                            {bookingForSomeoneElse ? 'Patient\'s First Name *' : 'First Name *'}
                        </label>
                        <input
                            type="text"
                            value={patientInfo.firstName}
                            onChange={(e) => handleInputChange('firstName', e.target.value)}
                            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73] transition-colors font-['Newsreader'] ${
                                errors.firstName ? 'border-red-300' : 'border-gray-300'
                            }`}
                            placeholder={bookingForSomeoneElse ? "Enter patient's first name" : "Enter first name"}
                        />
                        {errors.firstName && (
                            <p className="mt-1 text-sm text-red-600 font-['Newsreader']">{errors.firstName}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2 font-['Newsreader']">
                            {bookingForSomeoneElse ? 'Patient\'s Last Name *' : 'Last Name *'}
                        </label>
                        <input
                            type="text"
                            value={patientInfo.lastName}
                            onChange={(e) => handleInputChange('lastName', e.target.value)}
                            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73] transition-colors font-['Newsreader'] ${
                                errors.lastName ? 'border-red-300' : 'border-gray-300'
                            }`}
                            placeholder={bookingForSomeoneElse ? "Enter patient's last name" : "Enter last name"}
                        />
                        {errors.lastName && (
                            <p className="mt-1 text-sm text-red-600 font-['Newsreader']">{errors.lastName}</p>
                        )}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2 font-['Newsreader']">
                        Date of Birth *
                    </label>
                    <input
                        type="date"
                        value={patientInfo.dob}
                        onChange={(e) => handleInputChange('dob', e.target.value)}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73] transition-colors font-['Newsreader'] ${
                            errors.dob ? 'border-red-300' : 'border-gray-300'
                        }`}
                    />
                    {errors.dob && (
                        <p className="mt-1 text-sm text-red-600 font-['Newsreader']">{errors.dob}</p>
                    )}
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2 font-['Newsreader']">
                            {bookingForSomeoneElse ? 'Patient\'s Email Address *' : 'Email Address *'}
                        </label>
                        <input
                            type="email"
                            value={patientInfo.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73] transition-colors font-['Newsreader'] ${
                                errors.email ? 'border-red-300' : 'border-gray-300'
                            }`}
                            placeholder={bookingForSomeoneElse ? "Enter patient's email address" : "Enter email address"}
                        />
                        {errors.email && (
                            <p className="mt-1 text-sm text-red-600 font-['Newsreader']">{errors.email}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2 font-['Newsreader']">
                            {bookingForSomeoneElse ? 'Patient\'s Phone Number *' : 'Phone Number *'}
                        </label>
                        <input
                            type="tel"
                            value={patientInfo.phone}
                            onChange={(e) => handleInputChange('phone', e.target.value)}
                            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73] transition-colors font-['Newsreader'] ${
                                errors.phone ? 'border-red-300' : 'border-gray-300'
                            }`}
                            placeholder={bookingForSomeoneElse ? "Enter patient's phone number" : "Enter phone number"}
                        />
                        {errors.phone && (
                            <p className="mt-1 text-sm text-red-600 font-['Newsreader']">{errors.phone}</p>
                        )}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2 font-['Newsreader']">
                        {bookingForSomeoneElse ? 'Patient\'s Insurance ID *' : 'Insurance ID *'}
                    </label>
                    <input
                        type="text"
                        value={patientInfo.insuranceId}
                        onChange={(e) => handleInputChange('insuranceId', e.target.value)}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73] transition-colors font-['Newsreader'] ${
                            errors.insuranceId ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder={bookingForSomeoneElse ? "Enter patient's insurance ID/member number" : "Enter insurance ID/member number"}
                    />
                    {errors.insuranceId && (
                        <p className="mt-1 text-sm text-red-600 font-['Newsreader']">{errors.insuranceId}</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2 font-['Newsreader']">
                        Address (Optional)
                    </label>
                    <input
                        type="text"
                        value={patientInfo.address}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73] transition-colors font-['Newsreader']"
                        placeholder="Enter address"
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-6">
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 font-medium transition-colors font-['Newsreader']"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to calendar</span>
                    </button>
                    
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`flex items-center space-x-2 px-8 py-3 rounded-lg font-medium transition-all font-['Newsreader'] ${
                            isSubmitting
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-[#BF9C73] hover:bg-[#A67C52] text-white'
                        }`}
                    >
                        <span>{isSubmitting ? 'Processing...' : 'Continue'}</span>
                        {!isSubmitting && <ArrowRight className="w-4 h-4" />}
                    </button>
                </div>
            </form>
        </div>
    )
}