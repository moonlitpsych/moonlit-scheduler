'use client'

import { PatientInfo, TimeSlot, Payer } from '@/types/database'
import { BookingScenario } from './WelcomeView'
// import { Check } from 'lucide-react'

interface ConfirmationViewProps {
    appointmentId?: string
    patientInfo?: PatientInfo
    selectedTimeSlot?: TimeSlot
    selectedPayer?: Payer
    bookingScenario: BookingScenario
    caseManagerInfo?: {
        name: string
        email: string
        phone?: string
        organization?: string
    }
    communicationPreferences?: {
        sendToPatient: boolean
        sendToCaseManager: boolean
        patientHasEmail: boolean
    }
    onStartOver: () => void
    onChangeAppointment?: () => void // NEW: Quick change appointment
    onChangeInsurance?: () => void  // NEW: Quick change insurance
}

export default function ConfirmationView({
    appointmentId,
    patientInfo,
    selectedTimeSlot,
    selectedPayer,
    bookingScenario,
    caseManagerInfo,
    communicationPreferences,
    onStartOver,
    onChangeAppointment,
    onChangeInsurance
}: ConfirmationViewProps) {
    const formatDateTime = (startTime: string) => {
        try {
            // startTime is in format "2024-08-27T14:00:00"
            const dateObj = new Date(startTime)
            
            // Check if date is valid
            if (isNaN(dateObj.getTime())) {
                console.error('Invalid date:', startTime)
                return 'Invalid date/time'
            }
            
            return dateObj.toLocaleString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            })
        } catch (error) {
            console.error('Error formatting date:', error, startTime)
            return 'Invalid date/time'
        }
    }

    const getScenarioTitle = () => {
        switch (bookingScenario) {
            case 'self':
                return 'All Set!'
            case 'referral':
                return 'All Set!'
            case 'case-manager':
                return 'All Set!'
            default:
                return 'All Set!'
        }
    }

    const getScenarioMessage = () => {
        switch (bookingScenario) {
            case 'self':
                return (
                    <>
                        Your appointment has been saved. <strong>Check your email to submit required intake paperwork.</strong>
                    </>
                )
            case 'referral':
                return (
                    <>
                        The appointment has been saved. <strong>Check your email to submit required intake paperwork.</strong>
                    </>
                )
            case 'case-manager':
                return (
                    <>
                        The appointment has been saved. <strong>Check your email to submit required intake paperwork.</strong>
                    </>
                )
            default:
                return (
                    <>
                        Your appointment has been saved. <strong>Check your email to submit required intake paperwork.</strong>
                    </>
                )
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1]">
            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Success Header */}
                <div className="text-center mb-8">
                    <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>

                    <h1 className="text-4xl md:text-5xl font-light text-[#091747] mb-4 font-['Newsreader']">
                        {getScenarioTitle()}
                    </h1>
                    <p className="text-xl text-[#091747]/70 max-w-3xl mx-auto leading-relaxed mb-8 font-['Newsreader']">
                        {getScenarioMessage()}
                    </p>
                </div>

                {/* Appointment Summary Card */}
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
                        
                        {/* Main appointment details in a compact grid */}
                        <div className="p-8">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                {/* Date & Time */}
                                {selectedTimeSlot && (
                                    <div className="text-center md:text-left">
                                        <h3 className="text-lg font-semibold text-[#091747] mb-2 font-['Newsreader']">Date & Time</h3>
                                        <p className="text-[#091747]/90 font-['Newsreader']">
                                            {formatDateTime(selectedTimeSlot.start_time)}
                                        </p>
                                        {selectedTimeSlot.duration_minutes && (
                                            <p className="text-sm text-[#091747]/60 mt-1 font-['Newsreader']">
                                                {selectedTimeSlot.duration_minutes} minutes
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Provider */}
                                <div className="text-center md:text-left">
                                    <h3 className="text-lg font-semibold text-[#091747] mb-2 font-['Newsreader']">Provider</h3>
                                    <p className="text-[#091747]/90 font-['Newsreader']">
                                        {selectedTimeSlot?.provider_name || 'Moonlit Psychiatry'}
                                    </p>
                                    <p className="text-sm text-[#091747]/60 mt-1 font-['Newsreader']">
                                        Telehealth Appointment
                                    </p>
                                </div>

                                {/* Insurance */}
                                <div className="text-center md:text-left">
                                    <h3 className="text-lg font-semibold text-[#091747] mb-2 font-['Newsreader']">Insurance</h3>
                                    <p className="text-[#091747]/90 font-['Newsreader']">
                                        {selectedPayer?.name || 'Cash Payment'}
                                    </p>
                                    {selectedPayer && selectedPayer.id !== 'cash-payment' && (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-1 font-['Newsreader']">
                                            Verified
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Patient Information - Compact */}
                            {patientInfo && (
                                <div className="border-t pt-6 mb-6">
                                    <h3 className="text-lg font-semibold text-[#091747] mb-4 font-['Newsreader']">
                                        {bookingScenario === 'self' ? 'Your Information' : 'Patient Information'}
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                        <div>
                                            <p className="text-[#091747]/60 font-['Newsreader']">Name</p>
                                            <p className="text-[#091747] font-medium font-['Newsreader']">
                                                {patientInfo.firstName} {patientInfo.lastName}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[#091747]/60 font-['Newsreader']">Phone</p>
                                            <p className="text-[#091747] font-['Newsreader']">{patientInfo.phone}</p>
                                        </div>
                                        {patientInfo.email && (
                                            <div>
                                                <p className="text-[#091747]/60 font-['Newsreader']">Email</p>
                                                <p className="text-[#091747] font-['Newsreader']">{patientInfo.email}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Case Manager Information - Compact */}
                            {bookingScenario === 'case-manager' && caseManagerInfo && (
                                <div className="border-t pt-6 mb-6">
                                    <h3 className="text-lg font-semibold text-[#091747] mb-4 font-['Newsreader']">Case Manager</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <p className="text-[#091747]/60 font-['Newsreader']">Name</p>
                                            <p className="text-[#091747] font-['Newsreader']">{caseManagerInfo.name}</p>
                                        </div>
                                        <div>
                                            <p className="text-[#091747]/60 font-['Newsreader']">Email</p>
                                            <p className="text-[#091747] font-['Newsreader']">{caseManagerInfo.email}</p>
                                        </div>
                                        {caseManagerInfo.phone && (
                                            <div>
                                                <p className="text-[#091747]/60 font-['Newsreader']">Phone</p>
                                                <p className="text-[#091747] font-['Newsreader']">{caseManagerInfo.phone}</p>
                                            </div>
                                        )}
                                        {caseManagerInfo.organization && (
                                            <div>
                                                <p className="text-[#091747]/60 font-['Newsreader']">Organization</p>
                                                <p className="text-[#091747] font-['Newsreader']">{caseManagerInfo.organization}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Email Information Note */}
                            <div className="border-t pt-6 mb-6">
                                <div className="bg-[#FEF8F1] rounded-xl p-6 text-center">
                                    <p className="text-[#091747] font-['Newsreader']">
                                        Your <strong>video conferencing link</strong> and <strong>required intake paperwork</strong> will be in your email inbox.
                                    </p>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
                                <button
                                    type="button"
                                    onClick={onStartOver}
                                    className="px-8 py-3 bg-[#BF9C73] hover:bg-[#A8865F] text-white rounded-xl font-medium transition-colors font-['Newsreader']"
                                >
                                    Book Another Appointment
                                </button>
                                <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="px-8 py-3 bg-white hover:bg-[#FEF8F1] text-[#091747] font-medium rounded-xl transition-colors border-2 border-[#BF9C73] hover:border-[#A8865F] font-['Newsreader']"
                                >
                                    Print Appointment Information
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Simple Contact Line */}
                    <div className="mt-8 text-center">
                        <p className="text-[#091747]/60 text-sm font-['Newsreader']">
                            Questions? Email us at <a href="mailto:hello@trymoonlit.com" className="text-[#BF9C73] hover:text-[#091747] underline">hello@trymoonlit.com</a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}