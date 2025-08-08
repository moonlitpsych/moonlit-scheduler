// src/components/booking/views/BookingConfirmationView.tsx
'use client'

import { bookingService } from '@/lib/services/BookingService'
import { eligibilityService } from '@/lib/services/EligibilityService'
import { AlertCircle, CheckCircle, Loader2, Shield, X } from 'lucide-react'
import { useState } from 'react'

interface BookingConfirmationViewProps {
    patientInfo: {
        firstName: string
        lastName: string
        dob: string
        email: string
        phone: string
    }
    insuranceInfo: {
        payerId: string
        payerName: string
        payerType?: string
        memberId?: string
        ssnLast4?: string
    } | null
    appointmentDetails: {
        providerId: string
        providerName: string
        serviceId: string
        serviceName: string
        startTime: string
        endTime: string
        appointmentType: 'telehealth' | 'in-person'
    }
    roiContacts?: string[]
    onConfirmed: (bookingId: string) => void
    onBack: () => void
}

export default function BookingConfirmationView({
    patientInfo,
    insuranceInfo,
    appointmentDetails,
    roiContacts = [],
    onConfirmed,
    onBack
}: BookingConfirmationViewProps) {
    const [loading, setLoading] = useState(false)
    const [eligibilityStatus, setEligibilityStatus] = useState<'checking' | 'passed' | 'failed' | null>(null)
    const [eligibilityMessage, setEligibilityMessage] = useState('')
    const [bookingError, setBookingError] = useState('')

    const formatDateTime = (dateTime: string) => {
        const date = new Date(dateTime)
        return date.toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        })
    }

    const handleConfirmBooking = async () => {
        setLoading(true)
        setBookingError('')

        try {
            // Step 1: Check eligibility if insurance is provided and it's Medicaid
            if (insuranceInfo) {
                const isMedicaid = insuranceInfo.payerType?.toLowerCase() === 'medicaid' ||
                    insuranceInfo.payerName?.toLowerCase().includes('medicaid')

                if (isMedicaid && eligibilityService.isEligibilityCheckEnabled()) {
                    setEligibilityStatus('checking')
                    setEligibilityMessage('Verifying insurance eligibility...')

                    const eligibilityResult = await eligibilityService.checkEligibility(
                        patientInfo,
                        insuranceInfo
                    )

                    if (!eligibilityResult.eligible) {
                        // Eligibility check failed - don't proceed with booking
                        setEligibilityStatus('failed')
                        setEligibilityMessage(
                            eligibilityResult.message || 'Insurance eligibility could not be verified'
                        )
                        setLoading(false)
                        return // Stop here, don't book the appointment
                    }

                    // Eligibility check passed
                    setEligibilityStatus('passed')
                    setEligibilityMessage(eligibilityResult.message || 'Insurance verified')

                    // Small delay to show success message
                    await new Promise(resolve => setTimeout(resolve, 1000))
                }
            }

            // Step 2: Create the appointment
            setEligibilityMessage('Creating your appointment...')

            // Prepare booking data
            const bookingData = {
                provider_id: appointmentDetails.providerId,
                service_instance_id: appointmentDetails.serviceId,
                payer_id: insuranceInfo?.payerId || null,
                start_time: appointmentDetails.startTime,
                end_time: appointmentDetails.endTime,
                timezone: 'America/Denver',
                patient_info: patientInfo,
                insurance_info: insuranceInfo ? {
                    payer_id: insuranceInfo.payerId,
                    payer_name: insuranceInfo.payerName,
                    member_id: insuranceInfo.memberId,
                    ssn_last_4: insuranceInfo.ssnLast4
                } : null,
                roi_contacts: roiContacts.length > 0 ? roiContacts : null,
                appointment_type: appointmentDetails.appointmentType,
                booking_source: 'widget'
            }

            // Call booking service to create appointment
            const booking = await bookingService.createAppointment(bookingData)

            if (booking && booking.id) {
                // Success!
                setEligibilityStatus('passed')
                setEligibilityMessage('Appointment confirmed!')

                // Small delay before navigating
                await new Promise(resolve => setTimeout(resolve, 500))

                onConfirmed(booking.id)
            } else {
                throw new Error('Failed to create appointment')
            }

        } catch (error: any) {
            console.error('Booking error:', error)
            setEligibilityStatus('failed')
            setBookingError(error.message || 'Failed to confirm appointment. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto p-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
                {/* Header */}
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">
                        Confirm Your Appointment
                    </h2>
                    <p className="text-gray-600">
                        Please review your appointment details before confirming
                    </p>
                </div>

                {/* Appointment Details */}
                <div className="space-y-4 mb-6">
                    {/* Provider & Service */}
                    <div className="border-l-4 border-blue-500 pl-4">
                        <h3 className="font-semibold text-gray-800">
                            {appointmentDetails.serviceName}
                        </h3>
                        <p className="text-gray-600">
                            with {appointmentDetails.providerName}
                        </p>
                    </div>

                    {/* Date & Time */}
                    <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-1">Appointment Time</p>
                        <p className="font-medium text-gray-800">
                            {formatDateTime(appointmentDetails.startTime)}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                            {appointmentDetails.appointmentType === 'telehealth'
                                ? '📹 Video Visit'
                                : '🏥 In-Person Visit'}
                        </p>
                    </div>

                    {/* Patient Info */}
                    <div>
                        <p className="text-sm text-gray-600 mb-1">Patient</p>
                        <p className="font-medium text-gray-800">
                            {patientInfo.firstName} {patientInfo.lastName}
                        </p>
                        <p className="text-sm text-gray-600">
                            {patientInfo.email} • {patientInfo.phone}
                        </p>
                    </div>

                    {/* Insurance Info */}
                    {insuranceInfo ? (
                        <div>
                            <p className="text-sm text-gray-600 mb-1">Insurance</p>
                            <p className="font-medium text-gray-800">
                                {insuranceInfo.payerName}
                            </p>
                            {insuranceInfo.memberId && (
                                <p className="text-sm text-gray-600">
                                    Member ID: {insuranceInfo.memberId}
                                </p>
                            )}
                        </div>
                    ) : (
                        <div>
                            <p className="text-sm text-gray-600 mb-1">Payment</p>
                            <p className="font-medium text-gray-800">
                                Self-Pay / Out of Pocket
                            </p>
                        </div>
                    )}

                    {/* ROI Contacts */}
                    {roiContacts.length > 0 && (
                        <div>
                            <p className="text-sm text-gray-600 mb-1">
                                Care Team Members (will receive appointment info)
                            </p>
                            {roiContacts.map((contact, index) => (
                                <p key={index} className="text-sm text-gray-700">
                                    • {contact}
                                </p>
                            ))}
                        </div>
                    )}
                </div>

                {/* Eligibility Status Display */}
                {eligibilityStatus && (
                    <div className={`mb-6 p-4 rounded-lg border ${eligibilityStatus === 'checking'
                            ? 'bg-blue-50 border-blue-200'
                            : eligibilityStatus === 'passed'
                                ? 'bg-green-50 border-green-200'
                                : 'bg-red-50 border-red-200'
                        }`}>
                        <div className="flex items-center space-x-3">
                            {eligibilityStatus === 'checking' ? (
                                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                            ) : eligibilityStatus === 'passed' ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                                <X className="h-5 w-5 text-red-600" />
                            )}
                            <div className="flex-1">
                                <p className={`font-medium ${eligibilityStatus === 'checking'
                                        ? 'text-blue-800'
                                        : eligibilityStatus === 'passed'
                                            ? 'text-green-800'
                                            : 'text-red-800'
                                    }`}>
                                    {eligibilityMessage}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error Display */}
                {bookingError && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start space-x-3">
                            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                            <div>
                                <p className="font-medium text-red-800">
                                    Unable to confirm appointment
                                </p>
                                <p className="text-sm text-red-700 mt-1">
                                    {bookingError}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-4">
                    <button
                        onClick={onBack}
                        disabled={loading}
                        className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Back
                    </button>
                    <button
                        onClick={handleConfirmBooking}
                        disabled={loading || eligibilityStatus === 'failed'}
                        className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                Processing...
                            </>
                        ) : (
                            'Confirm Appointment'
                        )}
                    </button>
                </div>

                {/* Feature Flag Notice (only shown in development) */}
                {process.env.NODE_ENV === 'development' && (
                    <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-start space-x-2">
                            <Shield className="h-4 w-4 text-yellow-600 mt-0.5" />
                            <div className="text-xs text-yellow-800">
                                <p className="font-semibold">Dev Info:</p>
                                <p>
                                    Eligibility Checker: {eligibilityService.isEligibilityCheckEnabled() ? 'ON' : 'OFF'}
                                    {' '}(Toggle via NEXT_PUBLIC_ELIGIBILITY_CHECKER in .env.local)
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}