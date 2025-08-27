'use client'

import { InsuranceInfo, Payer, ROIContact, TimeSlot } from '@/types/database'
import { BookingScenario } from '../BookingFlow'

interface AppointmentSummaryViewProps {
    selectedPayer?: Payer
    selectedTimeSlot?: TimeSlot
    insuranceInfo?: InsuranceInfo
    roiContacts: ROIContact[]
    bookingScenario: BookingScenario
    onConfirmBooking: () => void
    onEditInsurance: () => void
    onEditTimeSlot: () => void
    onEditROI: () => void
    onBack: () => void
}

export default function AppointmentSummaryView({
    selectedPayer,
    selectedTimeSlot,
    insuranceInfo,
    roiContacts,
    bookingScenario,
    onConfirmBooking,
    onEditInsurance,
    onEditTimeSlot,
    onEditROI,
    onBack
}: AppointmentSummaryViewProps) {
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
                return 'Review Your Appointment'
            case 'third-party':
                return 'Review Patient Appointment'
            case 'case-manager':
                return 'Review Case Management Appointment'
            default:
                return 'Review Appointment Details'
        }
    }

    const getSubmitButtonText = () => {
        switch (bookingScenario) {
            case 'self':
                return 'Confirm My Appointment'
            case 'third-party':
                return 'Submit Booking Request'
            case 'case-manager':
                return 'Confirm Patient Appointment'
            default:
                return 'Submit Booking Request'
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#1a2c5b] to-[#2d4a7c]">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="text-white text-center mb-8">
                    <h1 className="text-4xl font-bold mb-4">{getScenarioTitle()}</h1>
                    <p className="text-xl opacity-90">
                        Please review all details before confirming your appointment
                    </p>
                </div>

                {/* Summary Card */}
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                        
                        {/* Appointment Details Section */}
                        <div className="p-8 border-b border-gray-200">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">Appointment Details</h2>
                                <button
                                    type="button"
                                    onClick={onEditTimeSlot}
                                    className="text-[#BF9C73] hover:text-[#A8865F] text-sm font-medium transition-colors"
                                >
                                    Edit Time
                                </button>
                            </div>

                            {selectedTimeSlot && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Date & Time</h3>
                                        <p className="text-gray-700 text-lg">
                                            {formatDateTime(selectedTimeSlot.date, selectedTimeSlot.start_time)}
                                        </p>
                                        {selectedTimeSlot.duration_minutes && (
                                            <p className="text-sm text-gray-600 mt-1">
                                                Duration: {selectedTimeSlot.duration_minutes} minutes
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Provider</h3>
                                        <p className="text-gray-700">
                                            {selectedTimeSlot.provider_name || 'Moonlit Psychiatry'}
                                        </p>
                                        <p className="text-sm text-gray-600 mt-1">
                                            Telehealth Appointment
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Insurance Information Section */}
                        <div className="p-8 border-b border-gray-200">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">Insurance Information</h2>
                                <button
                                    type="button"
                                    onClick={onEditInsurance}
                                    className="text-[#BF9C73] hover:text-[#A8865F] text-sm font-medium transition-colors"
                                >
                                    Edit Insurance
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Insurance Provider</h3>
                                    <p className="text-gray-700">
                                        {selectedPayer?.name || 'Cash Payment'}
                                    </p>
                                </div>

                                {selectedPayer && selectedPayer.id !== 'cash-payment' && (
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Status</h3>
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                            Verified & Accepted
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Patient Information Section */}
                        {insuranceInfo && (
                            <div className="p-8 border-b border-gray-200">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900">
                                        {bookingScenario === 'self' ? 'Your Information' : 'Patient Information'}
                                    </h2>
                                    <button
                                        type="button"
                                        onClick={onEditInsurance}
                                        className="text-[#BF9C73] hover:text-[#A8865F] text-sm font-medium transition-colors"
                                    >
                                        Edit Details
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-gray-600">Name</p>
                                        <p className="text-gray-900 font-medium">
                                            {insuranceInfo.firstName} {insuranceInfo.lastName}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Phone</p>
                                        <p className="text-gray-900">{insuranceInfo.phone}</p>
                                    </div>
                                    {insuranceInfo.email && (
                                        <div>
                                            <p className="text-sm text-gray-600">Email</p>
                                            <p className="text-gray-900">{insuranceInfo.email}</p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-sm text-gray-600">Date of Birth</p>
                                        <p className="text-gray-900">{insuranceInfo.dob}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ROI Information Section */}
                        {roiContacts.length > 0 && (
                            <div className="p-8 border-b border-gray-200">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900">Release of Information</h2>
                                    <button
                                        type="button"
                                        onClick={onEditROI}
                                        className="text-[#BF9C73] hover:text-[#A8865F] text-sm font-medium transition-colors"
                                    >
                                        Edit ROI
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {roiContacts.map((contact, index) => (
                                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div>
                                                    <p className="text-sm text-gray-600">Name</p>
                                                    <p className="text-gray-900">{contact.name}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-600">Relationship</p>
                                                    <p className="text-gray-900">{contact.relationship}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-600">Contact</p>
                                                    <p className="text-gray-900">{contact.phone || contact.email}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Important Notice */}
                        <div className="p-8 bg-blue-50">
                            <div className="flex items-start space-x-3">
                                <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-blue-900 mb-2">Important Reminders</h3>
                                    <ul className="text-blue-800 text-sm space-y-1">
                                        <li>• Please arrive 5-10 minutes early for your telehealth appointment</li>
                                        <li>• You'll receive a secure meeting link 30 minutes before your appointment</li>
                                        <li>• Have your insurance card and ID ready</li>
                                        <li>• Ensure you're in a private, quiet space for your session</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            type="button"
                            onClick={onBack}
                            className="px-8 py-4 bg-white/20 text-white rounded-xl font-medium hover:bg-white/30 transition-colors"
                        >
                            ← Back to Previous Step
                        </button>
                        
                        <button
                            type="button"
                            onClick={onConfirmBooking}
                            className="px-12 py-4 bg-[#BF9C73] text-white rounded-xl font-semibold text-lg hover:bg-[#A8865F] transition-colors shadow-lg hover:shadow-xl"
                        >
                            {getSubmitButtonText()}
                        </button>
                    </div>

                    {/* Terms Notice */}
                    <div className="mt-6 text-center">
                        <p className="text-white/80 text-sm">
                            By confirming this appointment, you agree to our{' '}
                            <a href="/terms" className="text-[#BF9C73] hover:text-white underline">
                                Terms of Service
                            </a>{' '}
                            and{' '}
                            <a href="/privacy" className="text-[#BF9C73] hover:text-white underline">
                                Privacy Policy
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}