// src/components/booking/views/ConfirmationView.tsx
'use client'

import { PatientInfo, TimeSlot } from '@/types/database'
import { BookingScenario } from './WelcomeView'
import { Calendar, Clock, Mail, Phone, User, Building2, CheckCircle, AlertCircle, Repeat, Loader2, Shield, X, CreditCard } from 'lucide-react'
import { eligibilityService } from '@/lib/services/EligibilityService'
import { supabase } from '@/lib/supabase'
import { useState } from 'react'

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
    // Add these new props for eligibility checking
    insuranceInfo?: {
        payerId: string
        payerName: string
        payerType?: string
        memberId?: string
        ssnLast4?: string
    } | null
    providerId?: string
    serviceId?: string
    onConfirmationComplete?: (appointmentId: string) => void
}

export default function ConfirmationView({
    appointmentId,
    patientInfo,
    selectedTimeSlot,
    bookingScenario,
    caseManagerInfo,
    communicationPreferences,
    onStartOver,
    insuranceInfo,
    providerId,
    serviceId,
    onConfirmationComplete
}: ConfirmationViewProps) {
    // Add state for eligibility checking
    const [isProcessing, setIsProcessing] = useState(false)
    const [eligibilityStatus, setEligibilityStatus] = useState<'checking' | 'passed' | 'failed' | null>(null)
    const [eligibilityMessage, setEligibilityMessage] = useState('')
    const [bookingError, setBookingError] = useState('')
    const [isConfirmed, setIsConfirmed] = useState(!!appointmentId) // Already confirmed if appointmentId exists

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
        if (!isConfirmed && !appointmentId) {
            return 'Please confirm your appointment'
        }

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
        if (!isConfirmed && !appointmentId) {
            return 'Review your appointment details and click confirm to complete your booking.'
        }

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

    // New function to handle confirmation with eligibility check
    const handleConfirmAppointment = async () => {
        if (!patientInfo || !selectedTimeSlot) return

        setIsProcessing(true)
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
                        {
                            firstName: patientInfo.first_name,
                            lastName: patientInfo.last_name,
                            dob: patientInfo.date_of_birth,
                            email: patientInfo.email,
                            phone: patientInfo.phone
                        },
                        insuranceInfo
                    )

                    if (!eligibilityResult.eligible) {
                        // Eligibility check failed - don't proceed with booking
                        setEligibilityStatus('failed')
                        setEligibilityMessage(
                            eligibilityResult.message || 'Insurance eligibility could not be verified'
                        )
                        setIsProcessing(false)
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

            // Prepare appointment data for Supabase
            const appointmentData = {
                provider_id: providerId || selectedTimeSlot.provider_id,
                service_instance_id: serviceId || selectedTimeSlot.service_instance_id,
                payer_id: insuranceInfo?.payerId || null,
                start_time: selectedTimeSlot.start_time,
                end_time: selectedTimeSlot.end_time,
                timezone: 'America/Denver',
                patient_info: patientInfo,
                insurance_info: insuranceInfo ? {
                    payer_id: insuranceInfo.payerId,
                    payer_name: insuranceInfo.payerName,
                    member_id: insuranceInfo.memberId,
                    ssn_last_4: insuranceInfo.ssnLast4
                } : null,
                roi_contacts: null, // TODO: Add ROI contacts if needed
                appointment_type: 'telehealth' as const,
                status: 'scheduled',
                booking_source: 'widget',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }

            // Insert appointment into Supabase
            const { data: appointment, error } = await supabase
                .from('appointments')
                .insert(appointmentData)
                .select()
                .single()

            if (error) {
                console.error('Error creating appointment:', error)
                throw new Error('Failed to create appointment')
            }

            if (appointment && appointment.id) {
                // Success!
                setIsConfirmed(true)
                setEligibilityStatus('passed')
                setEligibilityMessage('Appointment confirmed!')

                // Small delay before calling completion callback
                await new Promise(resolve => setTimeout(resolve, 500))

                if (onConfirmationComplete) {
                    onConfirmationComplete(appointment.id)
                }
            } else {
                throw new Error('Failed to create appointment')
            }

        } catch (error: any) {
            console.error('Booking error:', error)
            setEligibilityStatus('failed')
            setBookingError(error.message || 'Failed to confirm appointment. Please try again.')
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/30 to-[#FEF8F1] flex items-center justify-center px-4">
            <div className="max-w-4xl mx-auto py-12">
                {/* Header - shows different text if not yet confirmed */}
                <div className="text-center mb-12">
                    {isConfirmed || appointmentId ? (
                        <div className="w-24 h-24 bg-[#17DB4E] rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="w-12 h-12 text-white" />
                        </div>
                    ) : (
                        <div className="w-24 h-24 bg-[#BF9C73] rounded-full flex items-center justify-center mx-auto mb-6">
                            <Calendar className="w-12 h-12 text-white" />
                        </div>
                    )}

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
                                            {bookingScenario === 'case-manager' ? 'Client Information' : 'Patient Information'}
                                        </h3>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-[#091747] font-medium font-['Newsreader']">
                                            {patientInfo.first_name} {patientInfo.last_name}
                                        </p>
                                        <div className="flex items-center space-x-2">
                                            <Mail className="w-4 h-4 text-[#091747]/60" />
                                            <span className="text-[#091747]/70 font-['Newsreader']">
                                                {patientInfo.email || 'No email provided'}
                                            </span>
                                        </div>
                                        {patientInfo.phone && (
                                            <div className="flex items-center space-x-2">
                                                <Phone className="w-4 h-4 text-[#091747]/60" />
                                                <span className="text-[#091747]/70 font-['Newsreader']">
                                                    {patientInfo.phone}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Appointment Time */}
                                {bookingScenario === 'case-manager' && caseManagerInfo && (
                                    <div className="mt-6 pt-6 border-t border-[#BF9C73]/20">
                                        <div className="flex items-center space-x-3 mb-4">
                                            <div className="w-10 h-10 bg-[#17DB4E]/10 rounded-lg flex items-center justify-center">
                                                <Building2 className="w-5 h-5 text-[#17DB4E]" />
                                            </div>
                                            <h3 className="text-lg font-semibold text-[#091747] font-['Newsreader']">
                                                Case Manager
                                            </h3>
                                        </div>
                                        <div className="space-y-2 ml-13">
                                            <p className="text-[#091747] font-medium font-['Newsreader']">
                                                {caseManagerInfo.name}
                                            </p>
                                            {caseManagerInfo.organization && (
                                                <p className="text-[#091747]/70 font-['Newsreader']">
                                                    {caseManagerInfo.organization}
                                                </p>
                                            )}
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
                                )}

                                {/* Confirm Button (if not yet confirmed) */}
                                {!isConfirmed && !appointmentId && (
                                    <div className="mt-8 flex justify-center">
                                        <button
                                            onClick={handleConfirmAppointment}
                                            disabled={isProcessing || eligibilityStatus === 'failed'}
                                            className="px-8 py-3 bg-[#17DB4E] text-white rounded-xl hover:bg-[#14c440] transition-all duration-200 font-['Newsreader'] font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                                        >
                                            {isProcessing ? (
                                                <>
                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                    <span>Processing...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle className="h-5 w-5" />
                                                    <span>Confirm Appointment</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                )}

                            {/* Next Steps (only show after confirmation) */}
                            {(isConfirmed || appointmentId) && (
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
                            )}

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

                            {/* Feature Flag Notice (only shown in development) */}
                            {process.env.NODE_ENV === 'development' && insuranceInfo && (
                                <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                                    <div className="flex items-start space-x-2">
                                        <Shield className="h-4 w-4 text-yellow-600 mt-0.5" />
                                        <div className="text-xs text-yellow-800 font-['Newsreader']">
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
            </div>
        </div>

                            {/* Appointment Time */ }
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
                        </div >

        {/* Insurance Information (if provided) */ }
    {
        insuranceInfo && (
            <div className="mt-6 pt-6 border-t border-[#BF9C73]/20">
                <div className="flex items-center space-x-3 mb-3">
                    <div className="w-8 h-8 bg-[#091747]/10 rounded-lg flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-[#091747]" />
                    </div>
                    <h3 className="text-md font-semibold text-[#091747] font-['Newsreader']">
                        Insurance
                    </h3>
                </div>
                <p className="text-[#091747]/70 font-['Newsreader'] ml-11">
                    {insuranceInfo.payerName}
                    {insuranceInfo.memberId && ` • Member ID: ${insuranceInfo.memberId}`}
                </p>
            </div>
        )
    }

                    <h1 className="text-4xl font-light text-[#091747] mb-4 font-['Newsreader']">
                        {getConfirmationTitle()}
                    </h1>

                    <p className="text-xl text-[#091747]/70 max-w-2xl mx-auto leading-relaxed font-['Newsreader']">
                        {getConfirmationMessage()}
                    </p>
                </div >

        {/* Eligibility Status Display (only when checking) */ }
    {
        eligibilityStatus && !isConfirmed && (
            <div className={`mb-8 p-6 rounded-2xl border-2 ${eligibilityStatus === 'checking'
                    ? 'bg-blue-50 border-blue-200'
                    : eligibilityStatus === 'passed'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                }`}>
                <div className="flex items-center space-x-3">
                    {eligibilityStatus === 'checking' ? (
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    ) : eligibilityStatus === 'passed' ? (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                    ) : (
                        <X className="h-6 w-6 text-red-600" />
                    )}
                    <div className="flex-1">
                        <p className={`font-medium text-lg font-['Newsreader'] ${eligibilityStatus === 'checking'
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
        )
    }

    {/* Error Display */ }
    {
        bookingError && (
            <div className="mb-8 p-6 bg-red-50 border-2 border-red-200 rounded-2xl">
                <div className="flex items-start space-x-3">
                    <AlertCircle className="h-6 w-6 text-red-600 mt-0.5" />
                    <div>
                        <p className="font-medium text-red-800 font-['Newsreader']">
                            Unable to confirm appointment
                        </p>
                        <p className="text-sm text-red-700 mt-1 font-['Newsreader']">
                            {bookingError}
                        </p>
                    </div>
                </div>
            </div>
        )
    }