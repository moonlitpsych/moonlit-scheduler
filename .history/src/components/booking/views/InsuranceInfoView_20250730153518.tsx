// src/components/booking/views/InsuranceInfoView.tsx
'use client'

import { useState } from 'react'
import { Payer, TimeSlot, InsuranceInfo, PatientInfo } from '@/types/database'
import { BookingScenario } from './WelcomeView'
import { ArrowLeft, Mail, Phone, Building2, User, CreditCard, Calendar, Clock, AlertCircle, Check } from 'lucide-react'

interface CaseManagerInfo {
    name: string
    email: string
    phone?: string
    organization?: string
}

interface CommunicationPreferences {
    sendToPatient: boolean
    sendToCaseManager: boolean
    patientHasEmail: boolean
}

interface InsuranceInfoViewProps {
    selectedPayer: Payer
    selectedTimeSlot: TimeSlot
    bookingScenario: BookingScenario
    caseManagerInfo?: CaseManagerInfo
    communicationPreferences: CommunicationPreferences
    onSubmit: (insuranceInfo: InsuranceInfo, patientInfo: PatientInfo) => void
    onUpdateCaseManager: (caseManagerInfo: CaseManagerInfo) => void
    onUpdateCommunicationPrefs: (prefs: Partial<CommunicationPreferences>) => void
    onBack: () => void
}

export default function InsuranceInfoView({
    selectedPayer,
    selectedTimeSlot,
    bookingScenario,
    caseManagerInfo,
    communicationPreferences,
    onSubmit,
    onUpdateCaseManager,
    onUpdateCommunicationPrefs,
    onBack
}: InsuranceInfoViewProps) {
    // Form state
    const [patientInfo, setPatientInfo] = useState({
        first_name: '',
        last_name: '',
        date_of_birth: '',
        email: '',
        phone: '',
        preferred_name: ''
    })

    const [insuranceInfo, setInsuranceInfo] = useState({
        member_id: '',
        group_number: '',
        effective_date: ''
    })

    const [localCaseManagerInfo, setLocalCaseManagerInfo] = useState<CaseManagerInfo>(
        caseManagerInfo || {
            name: '',
            email: '',
            phone: '',
            organization: ''
        }
    )

    const [showCommunicationOptions, setShowCommunicationOptions] = useState(false)

    // Handle form submission
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        // Update case manager info if in case manager scenario
        if (bookingScenario === 'case-manager') {
            onUpdateCaseManager(localCaseManagerInfo)
        }

        const finalInsuranceInfo: InsuranceInfo = {
            payer_id: selectedPayer.id,
            member_id: insuranceInfo.member_id,
            group_number: insuranceInfo.group_number,
            effective_date: insuranceInfo.effective_date
        }

        const finalPatientInfo: PatientInfo = {
            first_name: patientInfo.first_name,
            last_name: patientInfo.last_name,
            date_of_birth: patientInfo.date_of_birth,
            email: patientInfo.email,
            phone: patientInfo.phone,
            preferred_name: patientInfo.preferred_name
        }

        onSubmit(finalInsuranceInfo, finalPatientInfo)
    }

    const formatTimeSlot = (timeSlot: TimeSlot) => {
        const start = new Date(timeSlot.start_time)
        const end = new Date(timeSlot.end_time)
        return {
            date: start.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
            time: `${start.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            })} - ${end.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            })}`
        }
    }

    const timeSlotFormatted = formatTimeSlot(selectedTimeSlot)

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/30 to-[#FEF8F1]">
            <div className="max-w-4xl mx-auto py-12 px-4">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={onBack}
                        className="flex items-center text-[#091747]/60 hover:text-[#091747] transition-colors mb-6 font-['Newsreader']"
                    >
                        <ArrowLeft className="w-5 h-5 mr-2" />
                        Back to calendar
                    </button>

                    <h1 className="text-4xl font-light text-[#091747] mb-4 font-['Newsreader']">
                        {bookingScenario === 'case-manager'
                            ? 'Please provide your information and your client\'s details'
                            : 'Please input your information'
                        }
                    </h1>

                    <div className="bg-white rounded-2xl p-6 shadow-lg mb-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 bg-[#17DB4E]/10 rounded-xl flex items-center justify-center">
                                    <Calendar className="w-6 h-6 text-[#17DB4E]" />
                                </div>
                                <div>
                                    <p className="text-[#091747] font-semibold font-['Newsreader']">{timeSlotFormatted.date}</p>
                                    <p className="text-[#091747]/70 font-['Newsreader']">{timeSlotFormatted.time}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[#091747] font-semibold font-['Newsreader']">{selectedPayer.name}</p>
                                <p className="text-[#091747]/70 text-sm font-['Newsreader']">Insurance accepted</p>
                            </div>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Case Manager Information (if applicable) */}
                    {bookingScenario === 'case-manager' && (
                        <div className="bg-white rounded-2xl p-8 shadow-lg">
                            <div className="flex items-center space-x-3 mb-6">
                                <div className="w-10 h-10 bg-[#17DB4E]/10 rounded-lg flex items-center justify-center">
                                    <User className="w-5 h-5 text-[#17DB4E]" />
                                </div>
                                <h2 className="text-2xl font-semibold text-[#091747] font-['Newsreader']">
                                    Your Information (Case Manager)
                                </h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[#091747] font-medium mb-2 font-['Newsreader']">
                                        Your Full Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={localCaseManagerInfo.name}
                                        onChange={(e) => setLocalCaseManagerInfo(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full px-4 py-3 border-2 border-[#BF9C73]/30 rounded-xl focus:border-[#BF9C73] focus:outline-none transition-colors font-['Newsreader']"
                                        placeholder="Your name"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[#091747] font-medium mb-2 font-['Newsreader']">
                                        Organization
                                    </label>
                                    <input
                                        type="text"
                                        value={localCaseManagerInfo.organization}
                                        onChange={(e) => setLocalCaseManagerInfo(prev => ({ ...prev, organization: e.target.value }))}
                                        className="w-full px-4 py-3 border-2 border-[#BF9C73]/30 rounded-xl focus:border-[#BF9C73] focus:outline-none transition-colors font-['Newsreader']"
                                        placeholder="Organization or agency"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[#091747] font-medium mb-2 font-['Newsreader']">
                                        Your Email Address *
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={localCaseManagerInfo.email}
                                        onChange={(e) => setLocalCaseManagerInfo(prev => ({ ...prev, email: e.target.value }))}
                                        className="w-full px-4 py-3 border-2 border-[#BF9C73]/30 rounded-xl focus:border-[#BF9C73] focus:outline-none transition-colors font-['Newsreader']"
                                        placeholder="your.email@example.com"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[#091747] font-medium mb-2 font-['Newsreader']">
                                        Your Phone Number
                                    </label>
                                    <input
                                        type="tel"
                                        value={localCaseManagerInfo.phone}
                                        onChange={(e) => setLocalCaseManagerInfo(prev => ({ ...prev, phone: e.target.value }))}
                                        className="w-full px-4 py-3 border-2 border-[#BF9C73]/30 rounded-xl focus:border-[#BF9C73] focus:outline-none transition-colors font-['Newsreader']"
                                        placeholder="(555) 123-4567"
                                    />
                                </div>
                            </div>

                            {/* Add another case manager button */}
                            <div className="mt-6 flex justify-start">
                                <button
                                    type="button"
                                    className="px-4 py-2 border-2 border-[#17DB4E]/30 hover:border-[#17DB4E] text-[#17DB4E] hover:bg-[#17DB4E]/5 rounded-lg transition-colors font-['Newsreader'] text-sm"
                                >
                                    + Add Another Case Manager
                                </button>
                            </div>

                            {/* Communication preferences for case manager */}
                            <div className="mt-6 p-4 bg-[#17DB4E]/5 rounded-xl">
                                <div className="flex items-start space-x-3">
                                    <Check className="w-5 h-5 text-[#17DB4E] mt-0.5" />
                                    <div>
                                        <p className="text-[#091747] font-semibold font-['Newsreader']">
                                            You'll receive all appointment communications
                                        </p>
                                        <p className="text-[#091747]/70 text-sm font-['Newsreader']">
                                            Booking confirmation, intake forms, and meeting links will be sent to your email.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Patient Information */}
                    <div className="bg-white rounded-2xl p-8 shadow-lg">
                        <div className="flex items-center space-x-3 mb-6">
                            <div className="w-10 h-10 bg-[#BF9C73]/10 rounded-lg flex items-center justify-center">
                                <User className="w-5 h-5 text-[#BF9C73]" />
                            </div>
                            <h2 className="text-2xl font-semibold text-[#091747] font-['Newsreader']">
                                {bookingScenario === 'case-manager' ? 'Client Information' : 'Your Information'}
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[#091747] font-medium mb-2 font-['Newsreader']">
                                    First Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={patientInfo.first_name}
                                    onChange={(e) => setPatientInfo(prev => ({ ...prev, first_name: e.target.value }))}
                                    className="w-full px-4 py-3 border-2 border-[#BF9C73]/30 rounded-xl focus:border-[#BF9C73] focus:outline-none transition-colors font-['Newsreader']"
                                />
                            </div>

                            <div>
                                <label className="block text-[#091747] font-medium mb-2 font-['Newsreader']">
                                    Last Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={patientInfo.last_name}
                                    onChange={(e) => setPatientInfo(prev => ({ ...prev, last_name: e.target.value }))}
                                    className="w-full px-4 py-3 border-2 border-[#BF9C73]/30 rounded-xl focus:border-[#BF9C73] focus:outline-none transition-colors font-['Newsreader']"
                                />
                            </div>

                            <div>
                                <label className="block text-[#091747] font-medium mb-2 font-['Newsreader']">
                                    Date of Birth *
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={patientInfo.date_of_birth}
                                    onChange={(e) => setPatientInfo(prev => ({ ...prev, date_of_birth: e.target.value }))}
                                    className="w-full px-4 py-3 border-2 border-[#BF9C73]/30 rounded-xl focus:border-[#BF9C73] focus:outline-none transition-colors font-['Newsreader']"
                                />
                            </div>

                            <div>
                                <label className="block text-[#091747] font-medium mb-2 font-['Newsreader']">
                                    Phone Number
                                </label>
                                <input
                                    type="tel"
                                    value={patientInfo.phone}
                                    onChange={(e) => setPatientInfo(prev => ({ ...prev, phone: e.target.value }))}
                                    className="w-full px-4 py-3 border-2 border-[#BF9C73]/30 rounded-xl focus:border-[#BF9C73] focus:outline-none transition-colors font-['Newsreader']"
                                />
                            </div>

                            {/* Patient email - conditional based on scenario */}
                            <div className="md:col-span-2">
                                <label className="block text-[#091747] font-medium mb-2 font-['Newsreader']">
                                    {bookingScenario === 'case-manager' ? 'Client Email Address' : 'Email Address'}
                                    {bookingScenario !== 'case-manager' && ' *'}
                                </label>
                                <input
                                    type="email"
                                    required={bookingScenario !== 'case-manager'}
                                    value={patientInfo.email}
                                    onChange={(e) => {
                                        setPatientInfo(prev => ({ ...prev, email: e.target.value }))
                                        // Update communication preferences based on whether patient has email
                                        if (bookingScenario === 'case-manager') {
                                            const hasEmail = e.target.value.trim().length > 0
                                            onUpdateCommunicationPrefs({
                                                patientHasEmail: hasEmail,
                                                sendToPatient: hasEmail
                                            })
                                        }
                                    }}
                                    className="w-full px-4 py-3 border-2 border-[#BF9C73]/30 rounded-xl focus:border-[#BF9C73] focus:outline-none transition-colors font-['Newsreader']"
                                    placeholder={bookingScenario === 'case-manager' ? 'Optional - only if client has email access' : 'your.email@example.com'}
                                />

                                {bookingScenario === 'case-manager' && (
                                    <p className="text-[#091747]/60 text-sm mt-2 font-['Newsreader']">
                                        Leave blank if your client doesn't have email or device access.
                                        You'll receive all communications as the case manager.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Insurance Information */}
                    <div className="bg-white rounded-2xl p-8 shadow-lg">
                        <div className="flex items-center space-x-3 mb-6">
                            <div className="w-10 h-10 bg-[#BF9C73]/10 rounded-lg flex items-center justify-center">
                                <CreditCard className="w-5 h-5 text-[#BF9C73]" />
                            </div>
                            <h2 className="text-2xl font-semibold text-[#091747] font-['Newsreader']">
                                Insurance Information
                            </h2>
                        </div>

                        <div className="mb-4 p-4 bg-[#BF9C73]/5 rounded-xl">
                            <p className="text-[#091747] font-semibold font-['Newsreader']">Selected Insurance: {selectedPayer.name}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[#091747] font-medium mb-2 font-['Newsreader']">
                                    Member ID *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={insuranceInfo.member_id}
                                    onChange={(e) => setInsuranceInfo(prev => ({ ...prev, member_id: e.target.value }))}
                                    className="w-full px-4 py-3 border-2 border-[#BF9C73]/30 rounded-xl focus:border-[#BF9C73] focus:outline-none transition-colors font-['Newsreader']"
                                />
                            </div>

                            <div>
                                <label className="block text-[#091747] font-medium mb-2 font-['Newsreader']">
                                    Group Number
                                </label>
                                <input
                                    type="text"
                                    value={insuranceInfo.group_number}
                                    onChange={(e) => setInsuranceInfo(prev => ({ ...prev, group_number: e.target.value }))}
                                    className="w-full px-4 py-3 border-2 border-[#BF9C73]/30 rounded-xl focus:border-[#BF9C73] focus:outline-none transition-colors font-['Newsreader']"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Submit and Back Buttons */}
                    <div className="flex justify-between items-center">
                        <button
                            type="button"
                            onClick={onBack}
                            className="flex items-center px-6 py-3 text-[#091747]/60 hover:text-[#091747] transition-colors font-['Newsreader']"
                        >
                            <ArrowLeft className="w-5 h-5 mr-2" />
                            Back to calendar
                        </button>

                        <button
                            type="submit"
                            className="px-8 py-4 bg-[#BF9C73] hover:bg-[#B8936A] text-white font-semibold rounded-xl transition-all duration-200 hover:shadow-lg font-['Newsreader']"
                        >
                            Continue to Release of Information
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}