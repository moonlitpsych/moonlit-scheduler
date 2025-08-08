// src/components/booking/views/ConfirmationView.tsx
'use client'

import { PatientInfo, TimeSlot } from '@/types/database'
import { BookingScenario } from './WelcomeView'
import { Calendar, Clock, Mail, Phone, User, Building2, CheckCircle, AlertCircle, Repeat } from 'lucide-react'

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

interface ConfirmationViewProps {
    appointmentId?: string
    patientInfo?: PatientInfo
    selectedTimeSlot?: TimeSlot
    bookingScenario: BookingScenario
    caseManagerInfo?: CaseManagerInfo
    communicationPreferences?: CommunicationPreferences
    onStartOver: () => void
}

export default function ConfirmationView({
    appointmentId,
    patientInfo,
    selectedTimeSlot,
    bookingScenario,
    caseManagerInfo,
    communicationPreferences,
    onStartOver
}: ConfirmationViewProps) {
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

    const timeSlotFormatted = selectedTimeSlot ? formatTimeSlot(selectedTimeSlot) : null

    const getConfirmationTitle = () => {
        switch (bookingScenario) {
            case 'self':
                return 'Thank you for booking with Moonlit!'
            case 'referral':
                return 'Appointment successfully booked!'
            case 'case-manager':
                return 'Client appointment confirmed!'
            default:
                return 'Booking confirmed!'
        }
    }

    const getConfirmationMessage = () => {
        switch (bookingScenario) {
            case 'self':
                return 'Your appointment has been scheduled. You\'ll receive a confirmation email shortly with all the details.'
            case 'referral':
                return 'The appointment has been scheduled successfully. The patient will receive confirmation and appointment details.'
            case 'case-manager':
                return `${patientInfo?.first_name}'s appointment has been scheduled. As the case manager, you'll receive all communications and can coordinate their care.`
            default:
                return 'The appointment has been booked successfully.'
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/30 to-[#FEF8F1] flex items-center justify-center px-4">
            <div className="max-w-4xl mx-auto py-12">
                {/* Success Header */}
                <div className="text-center mb-12">
                    <div className="w-24 h-24 bg-[#17DB4E] rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-12 h-12 text-white" />
                    </div>

                    <h1 className="text-4xl font-light text-[#091747] mb-4 font-['Newsreader']">
                        {getConfirmationTitle()}
                    </h1>

                    <p className="text-xl text-[#091747]/70 max-w-2xl mx-auto leading-relaxed font-['Newsreader']">
                        {getConfirmationMessage()}
                    </p>
                </div>

                {/* Appointment Details */}
                {selectedTimeSlot && patientInfo && (
                    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                        <h2 className="text-2xl font-semibold text-[#091747] mb-6 font-['Newsreader']">
                            Appointment Details
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Patient Information */}
                            <div>
                                <div className="flex items-center space-x-3 mb-4">
                                    <div className="w-10 h-10 bg-[#BF9C73]/10 rounded-lg flex items-center justify-center">
                                        <User className="w-5 h-5 text-[#BF9C73]" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-[#091747] font-['Newsreader']">
                                        {bookingScenario === 'case-manager' ? 'Client' : 'Patient'}
                                    </h3>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[#091747] font-medium font-['Newsreader']">
                                        {patientInfo.first_name} {patientInfo.last_name}
                                    </p>
                                    <p className="text-[#091747]/70 font-['Newsreader']">
                                        Born: {new Date(patientInfo.date_of_birth).toLocaleDateString()}
                                    </p>
                                    {patientInfo.email && (
                                        <div className="flex items-center space-x-2">
                                            <Mail className="w-4 h-4 text-[#091747]/60" />
                                            <span className="text-[#091747]/70 font-['Newsreader']">{patientInfo.email}</span>
                                        </div>
                                    )}
                                    {patientInfo.phone && (
                                        <div className="flex items-center space-x-2">
                                            <Phone className="w-4 h-4 text-[#091747]/60" />
                                            <span className="text-[#091747]/70 font-['Newsreader']">{patientInfo.phone}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Appointment Time */}
                            <div>
                                <div className="flex items-center space-x-3 mb-4">
                                    <div className="w-10 h-10 bg-[#17DB4E]/10 rounded-lg flex items-center justify-center">
                                        <Calendar className="w-5 h-5 text-[#17DB4E]" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-[#091747] font-['Newsreader']">
                                        Appointment Time
                                    </h3>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[#091747] font-medium font-['Newsreader']">
                                        {timeSlotFormatted?.date}
                                    </p>
                                    <div className="flex items-center space-x-2">
                                        <Clock className="w-4 h-4 text-[#091747]/60" />
                                        <span className="text-[#091747]/70 font-['Newsreader']">
                                            {timeSlotFormatted?.time}
                                        </span>
                                    </div>
                                    <p className="text-[#091747]/70 text-sm font-['Newsreader']">
                                        60-minute telehealth appointment
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Case Manager Information */}
                        {bookingScenario === 'case-manager' && caseManagerInfo && (
                            <div className="mt-8 pt-6 border-t border-[#BF9C73]/20">
                                <div className="flex items-center space-x-3 mb-4">
                                    <div className="w-10 h-10 bg-[#17DB4E]/10 rounded-lg flex items-center justify-center">
                                        <Building2 className="w-5 h-5 text-[#17DB4E]" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-[#091747] font-['Newsreader']">
                                        Case Manager
                                    </h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[#091747] font-medium font-['Newsreader']">
                                            {caseManagerInfo.name}
                                        </p>
                                        {caseManagerInfo.organization && (
                                            <p className="text-[#091747]/70 font-['Newsreader']">
                                                {caseManagerInfo.organization}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center space-x-2">
                                            <Mail className="w-4 h-4 text-[#091747]/60" />
                                            <span className="text-[#091747]/70 font-['Newsreader']">
                                                {caseManagerInfo.email}
                                            </span>
                                        </div>
                                        {caseManagerInfo.phone && (
                                            <div className="flex items-center space-x-2">
                                                <Phone className="w-4 h-4 text-[#091747]/60" />
                                                <span className="text-[#091747]/70 font-['Newsreader']">
                                                    {caseManagerInfo.phone}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Communication Setup */}
                {communicationPreferences && (
                    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                        <h2 className="text-2xl font-semibold text-[#091747] mb-6 font-['Newsreader']">
                            Communication Setup
                        </h2>

                        <div className="space-y-4">
                            {bookingScenario === 'case-manager' && (
                                <>
                                    <div className="flex items-start space-x-3 p-4 bg-[#17DB4E]/5 rounded-xl">
                                        <CheckCircle className="w-5 h-5 text-[#17DB4E] mt-0.5" />
                                        <div>
                                            <p className="text-[#091747] font-semibold font-['Newsreader']">
                                                Case manager receives all communications
                                            </p>
                                            <p className="text-[#091747]/70 text-sm font-['Newsreader']">
                                                Booking confirmation, intake forms, and meeting links will be sent to {caseManagerInfo?.email}
                                            </p>
                                        </div>
                                    </div>

                                    {communicationPreferences.sendToPatient && patientInfo?.email ? (
                                        <div className="flex items-start space-x-3 p-4 bg-[#BF9C73]/5 rounded-xl">
                                            <CheckCircle className="w-5 h-5 text-[#BF9C73] mt-0.5" />
                                            <div>
                                                <p className="text-[#091747] font-semibold font-['Newsreader']">
                                                    Client also receives communications
                                                </p>
                                                <p className="text-[#091747]/70 text-sm font-['Newsreader']">
                                                    Appointment reminders will also be sent to {patientInfo.email}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-start space-x-3 p-4 bg-[#091747]/5 rounded-xl">
                                            <AlertCircle className="w-5 h-5 text-[#091747]/60 mt-0.5" />
                                            <div>
                                                <p className="text-[#091747] font-semibold font-['Newsreader']">
                                                    Client communications handled by case manager
                                                </p>
                                                <p className="text-[#091747]/70 text-sm font-['Newsreader']">
                                                    All appointment information will be provided through the case manager
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {bookingScenario === 'self' && (
                                <div className="flex items-start space-x-3 p-4 bg-[#17DB4E]/5 rounded-xl">
                                    <CheckCircle className="w-5 h-5 text-[#17DB4E] mt-0.5" />
                                    <div>
                                        <p className="text-[#091747] font-semibold font-['Newsreader']">
                                            All communications sent to you
                                        </p>
                                        <p className="text-[#091747]/70 text-sm font-['Newsreader']">
                                            Confirmation, intake forms, and meeting link sent to {patientInfo?.email}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {bookingScenario === 'referral' && (
                                <div className="flex items-start space-x-3 p-4 bg-[#17DB4E]/5 rounded-xl">
                                    <CheckCircle className="w-5 h-5 text-[#17DB4E] mt-0.5" />
                                    <div>
                                        <p className="text-[#091747] font-semibold font-['Newsreader']">
                                            Patient receives all communications
                                        </p>
                                        <p className="text-[#091747]/70 text-sm font-['Newsreader']">
                                            All appointment information will be sent directly to {patientInfo?.email}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Next Steps */}
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                    <h2 className="text-2xl font-semibold text-[#091747] mb-6 font-['Newsreader']">
                        What's Next?
                    </h2>

                    <div className="space-y-4">
                        <div className="flex items-start space-x-3">
                            <div className="w-6 h-6 bg-[#BF9C73] text-white rounded-full flex items-center justify-center text-sm font-semibold">
                                1
                            </div>
                            <div>
                                <p className="text-[#091747] font-semibold font-['Newsreader']">
                                    Check your email for confirmation
                                </p>
                                <p className="text-[#091747]/70 text-sm font-['Newsreader']">
                                    {bookingScenario === 'case-manager'
                                        ? 'You\'ll receive a detailed confirmation with all appointment information.'
                                        : 'You should receive a confirmation email within the next few minutes.'
                                    }
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3">
                            <div className="w-6 h-6 bg-[#BF9C73] text-white rounded-full flex items-center justify-center text-sm font-semibold">
                                2
                            </div>
                            <div>
                                <p className="text-[#091747] font-semibold font-['Newsreader']">
                                    Complete intake forms
                                </p>
                                <p className="text-[#091747]/70 text-sm font-['Newsreader']">
                                    {bookingScenario === 'case-manager'
                                        ? 'You\'ll receive intake forms to complete with your client before the appointment.'
                                        : 'Please complete the intake forms that will be emailed to you.'
                                    }
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3">
                            <div className="w-6 h-6 bg-[#BF9C73] text-white rounded-full flex items-center justify-center text-sm font-semibold">
                                3
                            </div>
                            <div>
                                <p className="text-[#091747] font-semibold font-['Newsreader']">
                                    Join your telehealth appointment
                                </p>
                                <p className="text-[#091747]/70 text-sm font-['Newsreader']">
                                    {bookingScenario === 'case-manager'
                                        ? 'You\'ll receive the meeting link and can help your client join the video call.'
                                        : 'A meeting link will be provided closer to your appointment date.'
                                    }
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="text-center">
                    <button
                        onClick={onStartOver}
                        className="inline-flex items-center space-x-2 px-6 py-3 border-2 border-[#BF9C73] text-[#BF9C73] hover:bg-[#BF9C73] hover:text-white rounded-xl transition-all duration-200 font-['Newsreader']"
                    >
                        <Repeat className="w-5 h-5" />
                        <span>Book Another Appointment</span>
                    </button>
                </div>
            </div>
        </div>
    )
}