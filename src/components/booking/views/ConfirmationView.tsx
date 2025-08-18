// src/components/booking/views/ConfirmationView.tsx
'use client'

import { PatientInfo, Payer, TimeSlot } from '@/types/database'
import { Calendar, CheckCircle, FileText, Mail, MapPin, Phone, User } from 'lucide-react'
import { BookingScenario } from '../BookingFlow'

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
    appointmentData?: any
    patientInfo?: PatientInfo
    selectedTimeSlot?: TimeSlot
    selectedProvider?: any
    selectedPayer?: Payer
    bookingScenario: BookingScenario
    caseManagerInfo?: CaseManagerInfo
    communicationPreferences?: CommunicationPreferences
    onStartOver: () => void
}

export default function ConfirmationView({
    appointmentId,
    appointmentData,
    patientInfo,
    selectedTimeSlot,
    selectedProvider,
    selectedPayer,
    bookingScenario,
    caseManagerInfo,
    communicationPreferences,
    onStartOver
}: ConfirmationViewProps) {

    // **FIXED**: Proper time formatting using actual appointment data
    const formatAppointmentDateTime = () => {
        try {
            // Use appointment data if available, fallback to selected time slot
            const timeSource = appointmentData?.start_time || selectedTimeSlot?.start_time
            
            if (!timeSource) {
                return {
                    date: 'Date to be confirmed',
                    time: 'Time to be confirmed'
                }
            }

            const appointmentDate = new Date(timeSource)
            
            // Validate the date
            if (isNaN(appointmentDate.getTime())) {
                console.error('Invalid date:', timeSource)
                return {
                    date: 'Date to be confirmed',
                    time: 'Time to be confirmed'
                }
            }

            const formattedDate = appointmentDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })

            const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            })

            return {
                date: formattedDate,
                time: formattedTime
            }
        } catch (error) {
            console.error('Error formatting appointment time:', error)
            return {
                date: 'Date to be confirmed',
                time: 'Time to be confirmed'
            }
        }
    }

    const { date: appointmentDate, time: appointmentTime } = formatAppointmentDateTime()

    // **FIXED**: Get provider name from appointment data or selected provider
    const getProviderInfo = () => {
        if (appointmentData?.provider) {
            return {
                name: `${appointmentData.provider.first_name} ${appointmentData.provider.last_name}`,
                title: appointmentData.provider.title || 'Psychiatrist',
                email: appointmentData.provider.email
            }
        } else if (selectedProvider) {
            return {
                name: `${selectedProvider.first_name} ${selectedProvider.last_name}`,
                title: selectedProvider.title || 'Psychiatrist',
                email: selectedProvider.email
            }
        } else {
            return {
                name: 'Moonlit Psychiatry Provider',
                title: 'Psychiatrist',
                email: 'appointments@moonlitpsychiatry.com'
            }
        }
    }

    const providerInfo = getProviderInfo()

    // **FIXED**: Get payer name from appointment data or selected payer
    const getPayerName = () => {
        if (appointmentData?.payer) {
            return appointmentData.payer.display_name || appointmentData.payer.name
        } else if (selectedPayer) {
            return selectedPayer.display_name || selectedPayer.name
        } else {
            return 'Self-pay'
        }
    }

    const getConfirmationTitle = () => {
        if (!appointmentId) {
            return 'Booking request submitted!'
        }

        switch (bookingScenario) {
            case 'self':
                return 'Your appointment is confirmed!'
            case 'referral':
                return 'Appointment successfully booked!'
            case 'case-manager':
                return 'Client appointment confirmed!'
            default:
                return 'Your appointment is confirmed!'
        }
    }

    const getConfirmationMessage = () => {
        if (!appointmentId) {
            return 'Thank you for your booking request. We will contact you shortly to confirm your appointment details.'
        }

        switch (bookingScenario) {
            case 'self':
                return 'Thank you for booking with Moonlit Psychiatry. We look forward to seeing you!'
            case 'referral':
                return 'The appointment has been scheduled successfully. The patient will receive confirmation and appointment details.'
            case 'case-manager':
                return `${patientInfo?.first_name}'s appointment has been scheduled. As the case manager, you'll receive all communications and can coordinate their care.`
            default:
                return 'Thank you for booking with Moonlit Psychiatry. We look forward to seeing you!'
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/30 to-[#FEF8F1] flex items-center justify-center px-4" style={{ fontFamily: 'Newsreader, serif' }}>
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

                    {/* **FIXED**: Show confirmation code if available */}
                    {appointmentData?.confirmation_code && (
                        <div className="mt-6 p-4 bg-[#BF9C73]/10 rounded-xl border border-[#BF9C73]/20">
                            <p className="text-sm text-[#091747]/60 mb-1 font-['Newsreader']">Confirmation Code</p>
                            <p className="text-2xl font-bold text-[#BF9C73] tracking-wider font-['Newsreader']">
                                {appointmentData.confirmation_code}
                            </p>
                        </div>
                    )}
                </div>

                {/* Appointment Details */}
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                    <h2 className="text-2xl font-semibold text-[#091747] mb-6 font-['Newsreader']">
                        Appointment Details
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Date & Time */}
                        <div>
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="w-10 h-10 bg-[#BF9C73]/10 rounded-lg flex items-center justify-center">
                                    <Calendar className="w-5 h-5 text-[#BF9C73]" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-[#091747] font-['Newsreader']">Date & Time</h3>
                                    <p className="text-[#091747]/70 font-['Newsreader']">
                                        {appointmentDate}
                                    </p>
                                    <p className="text-[#091747]/70 font-['Newsreader'] font-medium">
                                        {appointmentTime}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Provider */}
                        <div>
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="w-10 h-10 bg-[#BF9C73]/10 rounded-lg flex items-center justify-center">
                                    <User className="w-5 h-5 text-[#BF9C73]" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-[#091747] font-['Newsreader']">Provider</h3>
                                    <p className="text-[#091747]/70 font-['Newsreader'] font-medium">
                                        {providerInfo.name}, {providerInfo.title}
                                    </p>
                                    <p className="text-sm text-[#091747]/60 font-['Newsreader']">
                                        Moonlit Psychiatry
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Appointment Type */}
                        <div>
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="w-10 h-10 bg-[#BF9C73]/10 rounded-lg flex items-center justify-center">
                                    <MapPin className="w-5 h-5 text-[#BF9C73]" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-[#091747] font-['Newsreader']">Location</h3>
                                    <p className="text-[#091747]/70 font-['Newsreader']">
                                        Telehealth Appointment
                                    </p>
                                    <p className="text-sm text-[#091747]/60 font-['Newsreader']">
                                        Video call link will be sent via email
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Insurance */}
                        <div>
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="w-10 h-10 bg-[#BF9C73]/10 rounded-lg flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-[#BF9C73]" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-[#091747] font-['Newsreader']">Insurance</h3>
                                    <p className="text-[#091747]/70 font-['Newsreader']">
                                        {getPayerName()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Patient Information */}
                    {patientInfo && (
                        <div className="mt-8 pt-8 border-t border-stone-200">
                            <h3 className="text-lg font-semibold text-[#091747] mb-4 font-['Newsreader']">
                                {bookingScenario === 'case-manager' ? 'Client' : bookingScenario === 'referral' ? 'Patient' : 'Your'} Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-[#091747]/60 font-['Newsreader']">Name</p>
                                    <p className="text-[#091747] font-['Newsreader']">
                                        {patientInfo.first_name} {patientInfo.last_name}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-[#091747]/60 font-['Newsreader']">Email</p>
                                    <p className="text-[#091747] font-['Newsreader']">
                                        {patientInfo.email}
                                    </p>
                                </div>
                                {patientInfo.phone && (
                                    <div>
                                        <p className="text-sm text-[#091747]/60 font-['Newsreader']">Phone</p>
                                        <p className="text-[#091747] font-['Newsreader']">
                                            {patientInfo.phone}
                                        </p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm text-[#091747]/60 font-['Newsreader']">Date of Birth</p>
                                    <p className="text-[#091747] font-['Newsreader']">
                                        {new Date(patientInfo.date_of_birth).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* What Happens Next */}
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                    <h2 className="text-2xl font-semibold text-[#091747] mb-6 font-['Newsreader']">
                        What Happens Next?
                    </h2>

                    <div className="space-y-6">
                        <div className="flex items-start space-x-4">
                            <div className="w-8 h-8 bg-[#BF9C73] text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm">
                                1
                            </div>
                            <div>
                                <h3 className="font-semibold text-[#091747] mb-2 font-['Newsreader']">Confirmation Email</h3>
                                <p className="text-[#091747]/70 font-['Newsreader']">
                                    {communicationPreferences?.sendToPatient 
                                        ? "You'll receive a confirmation email with appointment details and next steps."
                                        : "Your case manager will receive confirmation details and coordinate with you."
                                    }
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-4">
                            <div className="w-8 h-8 bg-[#BF9C73] text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm">
                                2
                            </div>
                            <div>
                                <h3 className="font-semibold text-[#091747] mb-2 font-['Newsreader']">Pre-Appointment Preparation</h3>
                                <p className="text-[#091747]/70 font-['Newsreader']">
                                    Complete any required forms and gather insurance information before your visit.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-4">
                            <div className="w-8 h-8 bg-[#BF9C73] text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm">
                                3
                            </div>
                            <div>
                                <h3 className="font-semibold text-[#091747] mb-2 font-['Newsreader']">Join Your Appointment</h3>
                                <p className="text-[#091747]/70 font-['Newsreader']">
                                    You'll receive a secure video call link 24 hours before your appointment.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contact Information */}
                <div className="bg-[#BF9C73]/5 rounded-2xl p-8 text-center">
                    <h3 className="text-xl font-semibold text-[#091747] mb-4 font-['Newsreader']">
                        Questions about your appointment?
                    </h3>
                    <p className="text-[#091747]/70 mb-6 font-['Newsreader']">
                        Our team is here to help. Contact us anytime.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <a 
                            href="mailto:appointments@moonlitpsychiatry.com" 
                            className="flex items-center justify-center space-x-2 bg-[#BF9C73] text-white px-6 py-3 rounded-xl hover:bg-[#BF9C73]/90 transition-colors font-['Newsreader']"
                        >
                            <Mail className="w-5 h-5" />
                            <span>Email Us</span>
                        </a>
                        <a 
                            href="tel:+1-555-MOONLIT" 
                            className="flex items-center justify-center space-x-2 bg-white text-[#BF9C73] border-2 border-[#BF9C73] px-6 py-3 rounded-xl hover:bg-[#BF9C73]/5 transition-colors font-['Newsreader']"
                        >
                            <Phone className="w-5 h-5" />
                            <span>Call Us</span>
                        </a>
                    </div>
                </div>

                {/* Start Over Button */}
                <div className="text-center mt-8">
                    <button
                        onClick={onStartOver}
                        className="text-[#BF9C73] hover:text-[#BF9C73]/80 font-medium font-['Newsreader'] flex items-center justify-center space-x-2 mx-auto"
                    >
                        <span>Book Another Appointment</span>
                    </button>
                </div>
            </div>
        </div>
    )
}