// src/components/booking/views/ConfirmationView.tsx
'use client'

import { CheckCircle, Calendar, Clock, User, Mail, Phone } from 'lucide-react'
import { Payer, TimeSlot, PatientInfo, InsuranceInfo, ROIContact } from '@/types/database'

interface AppointmentData {
    selectedPayer?: Payer
    selectedTimeSlot?: TimeSlot
    patientInfo?: PatientInfo
    insuranceInfo?: InsuranceInfo
    roiContacts?: ROIContact[]
    appointmentId?: string
}

interface ConfirmationViewProps {
    appointmentData: AppointmentData
    onRestart: () => void
}

export default function ConfirmationView({ appointmentData, onRestart }: ConfirmationViewProps) {
    // Safely destructure with fallbacks
    const {
        selectedPayer,
        selectedTimeSlot,
        patientInfo,
        insuranceInfo,
        roiContacts = [],
        appointmentId
    } = appointmentData || {}

    const formatAppointmentTime = (timeSlot?: TimeSlot) => {
        if (!timeSlot) return 'Time to be confirmed'

        const date = new Date(timeSlot.start_time)
        const dateStr = date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
        const timeStr = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        })

        return `${dateStr} at ${timeStr}`
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#17DB4E]/10 via-[#FEF8F1] to-[#17DB4E]/5 flex items-center justify-center" style={{ fontFamily: 'Newsreader, serif' }}>
            <div className="max-w-2xl mx-auto px-4 py-16">
                <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
                    {/* Success Icon */}
                    <div className="mb-8">
                        <div className="w-20 h-20 bg-[#17DB4E] rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                            <CheckCircle className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-4xl font-light text-[#091747] mb-4">
                            Thank you for booking with Moonlit!
                        </h1>
                        <p className="text-lg text-[#091747]/70 leading-relaxed">
                            Your appointment request has been submitted successfully.
                            We'll send you a confirmation email shortly.
                        </p>
                    </div>

                    {/* Appointment Details */}
                    <div className="bg-[#FEF8F1] rounded-xl p-6 mb-8 text-left">
                        <h2 className="text-xl font-medium text-[#091747] mb-6 text-center">
                            Appointment Details
                        </h2>

                        <div className="space-y-4">
                            {/* Date & Time */}
                            <div className="flex items-start space-x-3">
                                <Calendar className="w-5 h-5 text-[#BF9C73] mt-1" />
                                <div>
                                    <p className="font-medium text-[#091747]">Date & Time</p>
                                    <p className="text-[#091747]/70">{formatAppointmentTime(selectedTimeSlot)}</p>
                                </div>
                            </div>

                            {/* Appointment Type */}
                            <div className="flex items-start space-x-3">
                                <Clock className="w-5 h-5 text-[#BF9C73] mt-1" />
                                <div>
                                    <p className="font-medium text-[#091747]">Appointment Type</p>
                                    <p className="text-[#091747]/70">60-minute video consultation</p>
                                </div>
                            </div>

                            {/* Insurance */}
                            {selectedPayer && (
                                <div className="flex items-start space-x-3">
                                    <User className="w-5 h-5 text-[#BF9C73] mt-1" />
                                    <div>
                                        <p className="font-medium text-[#091747]">Insurance</p>
                                        <p className="text-[#091747]/70">{selectedPayer.name}</p>
                                    </div>
                                </div>
                            )}

                            {/* Contact Information */}
                            {insuranceInfo && (
                                <div className="flex items-start space-x-3">
                                    <Mail className="w-5 h-5 text-[#BF9C73] mt-1" />
                                    <div>
                                        <p className="font-medium text-[#091747]">Contact</p>
                                        <p className="text-[#091747]/70">
                                            Confirmation details will be sent to your email
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* ROI Contacts */}
                            {roiContacts.length > 0 && (
                                <div className="flex items-start space-x-3">
                                    <User className="w-5 h-5 text-[#BF9C73] mt-1" />
                                    <div>
                                        <p className="font-medium text-[#091747]">Care Team Contacts</p>
                                        <p className="text-[#091747]/70">
                                            {roiContacts.length} contact{roiContacts.length > 1 ? 's' : ''} added for care coordination
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Appointment ID */}
                            {appointmentId && (
                                <div className="border-t border-[#BF9C73]/20 pt-4 mt-6">
                                    <p className="text-sm text-[#091747]/60">
                                        Reference ID: <span className="font-mono text-[#091747]">{appointmentId}</span>
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Next Steps */}
                    <div className="bg-[#FAB515]/10 rounded-xl p-6 mb-8 text-left">
                        <h3 className="font-medium text-[#091747] mb-4">What happens next?</h3>
                        <ul className="space-y-3 text-[#091747]/80">
                            <li className="flex items-start space-x-3">
                                <div className="w-2 h-2 bg-[#BF9C73] rounded-full mt-2"></div>
                                <span>You'll receive a confirmation email within 5 minutes</span>
                            </li>
                            <li className="flex items-start space-x-3">
                                <div className="w-2 h-2 bg-[#BF9C73] rounded-full mt-2"></div>
                                <span>Our team will review your appointment request</span>
                            </li>
                            <li className="flex items-start space-x-3">
                                <div className="w-2 h-2 bg-[#BF9C73] rounded-full mt-2"></div>
                                <span>We'll send you a calendar invite with video meeting details</span>
                            </li>
                            <li className="flex items-start space-x-3">
                                <div className="w-2 h-2 bg-[#BF9C73] rounded-full mt-2"></div>
                                <span>If you need to reschedule, please contact us at least 24 hours in advance</span>
                            </li>
                        </ul>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-4">
                        <button
                            onClick={onRestart}
                            className="
                                w-full border-2 border-[#BF9C73]/50 hover:border-[#BF9C73] 
                                text-[#091747] font-medium py-4 px-8 rounded-xl 
                                transition-all duration-200 hover:shadow-md hover:scale-105
                                bg-white hover:bg-[#FEF8F1]
                            "
                            style={{ fontFamily: 'Newsreader, serif' }}
                        >
                            Book Another Appointment
                        </button>

                        <p className="text-sm text-[#091747]/60">
                            Questions? Contact us at{' '}
                            <a href="mailto:support@moonlit.com" className="text-[#BF9C73] hover:underline">
                                support@moonlit.com
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}