'use client'

import { PatientInfo, TimeSlot } from '@/types/database'
import { BookingScenario } from './WelcomeView'

interface ConfirmationViewProps {
    appointmentId?: string
    patientInfo?: PatientInfo
    selectedTimeSlot?: TimeSlot
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
    bookingScenario,
    caseManagerInfo,
    communicationPreferences,
    onStartOver,
    onChangeAppointment,
    onChangeInsurance
}: ConfirmationViewProps) {
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

    const getScenarioTitle = () => {
        switch (bookingScenario) {
            case 'self':
                return 'Your Appointment is Confirmed!'
            case 'referral':
                return 'Referral Appointment Confirmed!'
            case 'case-manager':
                return 'Patient Appointment Confirmed!'
            default:
                return 'Appointment Confirmed!'
        }
    }

    const getScenarioMessage = () => {
        switch (bookingScenario) {
            case 'self':
                return 'Thank you for booking with Moonlit Psychiatry. We look forward to seeing you!'
            case 'referral':
                return 'The referral has been successfully submitted. The patient will receive confirmation details.'
            case 'case-manager':
                return 'The appointment has been booked for your patient. Confirmation details will be sent according to your preferences.'
            default:
                return 'Your appointment has been successfully booked.'
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#1a2c5b] to-[#2d4a7c]">
            <div className="container mx-auto px-4 py-8">
                {/* Success Header */}
                <div className="text-white text-center mb-12">
                    {/* Success Icon */}
                    <div className="flex justify-center mb-6">
                        <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center">
                            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    </div>

                    <h1 className="text-4xl font-bold mb-4">{getScenarioTitle()}</h1>
                    <p className="text-xl opacity-90 mb-6">{getScenarioMessage()}</p>

                    {appointmentId && (
                        <div className="bg-white/20 rounded-xl p-4 max-w-md mx-auto">
                            <p className="text-sm opacity-80 mb-1">Appointment Reference</p>
                            <p className="text-lg font-mono font-bold">{appointmentId}</p>
                        </div>
                    )}
                </div>

                {/* Appointment Details */}
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-2xl p-8 shadow-lg mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">Appointment Details</h2>

                        {selectedTimeSlot && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Date & Time</h3>
                                    <p className="text-gray-700 mb-2">
                                        {formatDateTime(selectedTimeSlot.date, selectedTimeSlot.start_time)}
                                    </p>
                                    {selectedTimeSlot.duration_minutes && (
                                        <p className="text-sm text-gray-600">
                                            Duration: {selectedTimeSlot.duration_minutes} minutes
                                        </p>
                                    )}
                                    {onChangeAppointment && (
                                        <button
                                            type="button"
                                            onClick={onChangeAppointment}
                                            className="mt-2 text-sm text-[#BF9C73] hover:text-[#A8865F] transition-colors"
                                        >
                                            Change Appointment Time
                                        </button>
                                    )}
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Provider</h3>
                                    <p className="text-gray-700">
                                        {selectedTimeSlot.provider_name || 'Moonlit Psychiatry'}
                                    </p>
                                    <p className="text-sm text-gray-600 mt-2">
                                        Location: Telehealth Appointment
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Patient Information */}
                        {patientInfo && (
                            <div className="border-t pt-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Patient Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-gray-600">Name</p>
                                        <p className="text-gray-900">
                                            {patientInfo.firstName} {patientInfo.lastName}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Phone</p>
                                        <p className="text-gray-900">{patientInfo.phone}</p>
                                    </div>
                                    {patientInfo.email && (
                                        <div>
                                            <p className="text-sm text-gray-600">Email</p>
                                            <p className="text-gray-900">{patientInfo.email}</p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-sm text-gray-600">Date of Birth</p>
                                        <p className="text-gray-900">{patientInfo.dateOfBirth}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Case Manager Information */}
                        {bookingScenario === 'case-manager' && caseManagerInfo && (
                            <div className="border-t pt-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Case Manager Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-gray-600">Name</p>
                                        <p className="text-gray-900">{caseManagerInfo.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Email</p>
                                        <p className="text-gray-900">{caseManagerInfo.email}</p>
                                    </div>
                                    {caseManagerInfo.phone && (
                                        <div>
                                            <p className="text-sm text-gray-600">Phone</p>
                                            <p className="text-gray-900">{caseManagerInfo.phone}</p>
                                        </div>
                                    )}
                                    {caseManagerInfo.organization && (
                                        <div>
                                            <p className="text-sm text-gray-600">Organization</p>
                                            <p className="text-gray-900">{caseManagerInfo.organization}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Insurance Information */}
                        {onChangeInsurance && (
                            <div className="border-t pt-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-gray-900">Insurance</h3>
                                    <button
                                        type="button"
                                        onClick={onChangeInsurance}
                                        className="text-sm text-[#BF9C73] hover:text-[#A8865F] transition-colors"
                                    >
                                        Change Insurance
                                    </button>
                                </div>
                                <p className="text-gray-700 mt-2">Insurance verification completed</p>
                            </div>
                        )}
                    </div>

                    {/* Next Steps */}
                    <div className="bg-white rounded-2xl p-8 shadow-lg mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">What Happens Next?</h2>
                        
                        <div className="space-y-4">
                            <div className="flex items-start space-x-4">
                                <div className="flex-shrink-0 w-8 h-8 bg-[#BF9C73] rounded-full flex items-center justify-center text-white font-bold">
                                    1
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">Confirmation Email</h3>
                                    <p className="text-gray-600">
                                        {communicationPreferences?.sendToPatient 
                                            ? "You'll receive a confirmation email with appointment details and preparation instructions."
                                            : communicationPreferences?.sendToCaseManager
                                            ? "The case manager will receive a confirmation email with appointment details."
                                            : "Confirmation details will be sent according to your preferences."}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-4">
                                <div className="flex-shrink-0 w-8 h-8 bg-[#BF9C73] rounded-full flex items-center justify-center text-white font-bold">
                                    2
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">Pre-Appointment Preparation</h3>
                                    <p className="text-gray-600">
                                        Complete any required forms and gather insurance information before your visit.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-4">
                                <div className="flex-shrink-0 w-8 h-8 bg-[#BF9C73] rounded-full flex items-center justify-center text-white font-bold">
                                    3
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">Telehealth Link</h3>
                                    <p className="text-gray-600">
                                        You'll receive a secure telehealth link 30 minutes before your appointment.
                                    </p>
                                </div>
                            </div>

                            {bookingScenario === 'case-manager' && (
                                <div className="flex items-start space-x-4">
                                    <div className="flex-shrink-0 w-8 h-8 bg-[#BF9C73] rounded-full flex items-center justify-center text-white font-bold">
                                        4
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">Case Manager Coordination</h3>
                                        <p className="text-gray-600">
                                            Our team will coordinate with the case manager for any additional requirements.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Contact Information */}
                    <div className="bg-white rounded-2xl p-8 shadow-lg mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">Need Help?</h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-2">Questions about your appointment?</h3>
                                <p className="text-gray-600 mb-2">Call our scheduling team:</p>
                                <p className="text-[#BF9C73] font-semibold">(555) 123-4567</p>
                            </div>
                            
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-2">Technical issues?</h3>
                                <p className="text-gray-600 mb-2">Email our support team:</p>
                                <p className="text-[#BF9C73] font-semibold">support@moonlitpsychiatry.com</p>
                            </div>
                        </div>

                        <div className="mt-6 p-4 bg-blue-50 rounded-xl">
                            <div className="flex items-start space-x-3">
                                <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <div>
                                    <h3 className="font-semibold text-blue-900">Need to reschedule?</h3>
                                    <p className="text-blue-800 text-sm">
                                        Please call us at least 24 hours before your appointment to reschedule without any fees.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="text-center">
                        <div className="space-y-4">
                            {/* Quick Change Options */}
                            {(onChangeAppointment || onChangeInsurance) && (
                                <div className="flex items-center justify-center gap-4 mb-6">
                                    {onChangeAppointment && (
                                        <button
                                            type="button"
                                            onClick={onChangeAppointment}
                                            className="px-6 py-3 border border-[#BF9C73] text-[#BF9C73] rounded-xl hover:bg-[#BF9C73]/5 transition-colors"
                                        >
                                            Change Appointment
                                        </button>
                                    )}
                                    {onChangeInsurance && (
                                        <button
                                            type="button"
                                            onClick={onChangeInsurance}
                                            className="px-6 py-3 border border-[#BF9C73] text-[#BF9C73] rounded-xl hover:bg-[#BF9C73]/5 transition-colors"
                                        >
                                            Change Insurance
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Primary Actions */}
                            <div className="space-y-3">
                                <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="px-8 py-3 bg-[#BF9C73] text-white rounded-xl font-medium hover:bg-[#A8865F] transition-colors"
                                >
                                    Print Confirmation
                                </button>
                                
                                <div>
                                    <button
                                        type="button"
                                        onClick={onStartOver}
                                        className="px-6 py-2 text-white/80 hover:text-white transition-colors"
                                    >
                                        Book Another Appointment
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}