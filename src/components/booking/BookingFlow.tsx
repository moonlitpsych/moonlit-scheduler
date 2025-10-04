'use client'

import { InsuranceInfo, Payer, ROIContact, TimeSlot } from '@/types/database'
import { useState } from 'react'

// Import view components (ensure these match your actual imports)
import AppointmentSummaryView from './views/AppointmentSummaryView'
import CalendarView from './views/CalendarView'
import ConfirmationView from './views/ConfirmationView'
import InsuranceFutureView from './views/InsuranceFutureView'
import InsuranceInfoView from './views/InsuranceInfoView'
import InsuranceNotAcceptedView from './views/InsuranceNotAcceptedView'
import PayerSearchView from './views/PayerSearchView'
import ProviderInsuranceMismatchView from './views/ProviderInsuranceMismatchView'
import ROIView from './views/ROIView'
import WaitlistConfirmationView from './views/WaitlistConfirmationView'
import WelcomeView from './views/WelcomeView'

export type BookingStep =
    | 'welcome'
    | 'payer-search'
    | 'insurance-not-accepted'
    | 'provider-insurance-mismatch' // NEW: for provider-specific insurance issues
    | 'insurance-future'
    | 'waitlist-confirmation'
    | 'calendar'
    | 'insurance-info'
    | 'roi'
    | 'appointment-summary'
    | 'confirmation'

export type BookingScenario = 'self' | 'third-party' | 'case-manager'
export type BookingIntent = 'book' | 'explore'

export interface BookingState {
    step: BookingStep
    bookingScenario: BookingScenario
    selectedPayer?: Payer
    payerAcceptanceStatus?: 'not-accepted' | 'future' | 'active' | 'waitlist'
    bookingMode?: 'normal' | 'from-effective-date' // NEW: for "book anyway" functionality
    selectedProvider?: { id: string, name: string } // NEW: for provider-specific booking
    selectedTimeSlot?: TimeSlot
    insuranceInfo?: InsuranceInfo
    roiContacts: ROIContact[]
    appointmentId?: string
    intent: BookingIntent // NEW: user's intent (book vs explore)
    // NEW: Third-party booking detection
    bookingForSomeoneElse?: boolean // Checkbox state on patient info page
    thirdPartyType?: 'case-manager' | 'referral' // Only appears when checkbox is checked
    // NEW: Insurance acceptance data with service instance
    acceptance?: {
        service_instance_id?: string
        serviceInstanceId?: string
        verified?: boolean
        status?: 'verified' | 'accepted' | 'pending'
    }
}

interface BookingFlowProps {
    intent?: BookingIntent
    selectedProviderId?: string // For provider-specific booking
    selectedProvider?: any // The provider object with name info
    providerSpecific?: boolean // Whether this is a provider-specific flow
    preselectedScenario?: BookingScenario // Pre-select booking scenario and skip to insurance
}

export default function BookingFlow({ 
    intent = 'book', 
    selectedProviderId,
    selectedProvider,
    providerSpecific = false,
    preselectedScenario
}: BookingFlowProps) {
    const [state, setState] = useState<BookingState>({
        step: 'payer-search', // NEW: Always start with insurance selection
        bookingScenario: preselectedScenario || 'self', // Default to 'self' but will be determined later
        roiContacts: [],
        intent: intent,
        bookingForSomeoneElse: false, // Default to booking for self
        thirdPartyType: preselectedScenario === 'case-manager' ? 'case-manager' : undefined
    })

    const updateState = (updates: Partial<BookingState>) => {
        setState(prev => ({ ...prev, ...updates }))
    }

    const goToStep = (step: BookingStep) => {
        setState(prev => ({ ...prev, step }))
    }

    // Navigation handlers
    const handleWelcomeSelection = (scenario: BookingScenario) => {
        updateState({ bookingScenario: scenario })
        goToStep('payer-search')
    }

    const handlePayerSelected = async (payer: Payer, acceptanceStatus: BookingState['payerAcceptanceStatus']) => {
        updateState({ 
            selectedPayer: payer, 
            payerAcceptanceStatus: acceptanceStatus 
        })

        // If this is provider-specific booking, check if this specific provider accepts the insurance
        if (providerSpecific && selectedProviderId && acceptanceStatus === 'active') {
            try {
                console.log('🔍 Checking provider-specific insurance acceptance...')
                const response = await fetch(`/api/providers/${selectedProviderId}/accepts-insurance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ payer_id: payer.id })
                })

                const data = await response.json()
                
                if (data.success && !data.accepts) {
                    // Provider doesn't accept this insurance, show mismatch screen
                    goToStep('provider-insurance-mismatch')
                    return
                }
            } catch (error) {
                console.error('❌ Error checking provider insurance:', error)
                // Continue with normal flow if check fails
            }
        }

        // Normal flow
        switch (acceptanceStatus) {
            case 'not-accepted':
                goToStep('insurance-not-accepted')
                break
            case 'future':
                goToStep('insurance-future')
                break
            case 'active':
                goToStep('calendar')
                break
            case 'waitlist':
                goToStep('waitlist-confirmation')
                break
        }
    }

    const handleCashPaymentSelected = () => {
        // Use a dummy payer for cash payments so calendar can render
        updateState({
            selectedPayer: { id: 'cash-payment', name: 'Cash Payment' } as Payer,
            payerAcceptanceStatus: undefined
        })
        goToStep('calendar')
    }

    const handleTimeSlotSelected = (timeSlot: TimeSlot) => {
        // Extract acceptance data if present (from enriched CalendarView slot)
        const enrichedSlot = timeSlot as any
        if (enrichedSlot.acceptance) {
            updateState({
                selectedTimeSlot: timeSlot,
                acceptance: enrichedSlot.acceptance
            })
        } else {
            updateState({ selectedTimeSlot: timeSlot })
        }
        goToStep('insurance-info')
    }

    const handleInsuranceInfoSubmitted = (insuranceInfo: InsuranceInfo, bookingForSomeoneElse?: boolean, thirdPartyType?: 'case-manager' | 'referral') => {
        // Update booking scenario based on third-party checkbox selection
        let newScenario: BookingScenario = 'self'
        if (bookingForSomeoneElse) {
            newScenario = thirdPartyType === 'case-manager' ? 'case-manager' : 'third-party'
        }

        updateState({ 
            insuranceInfo,
            bookingForSomeoneElse,
            thirdPartyType,
            bookingScenario: newScenario
        })
        
        goToStep('roi')
    }

    const handleROISubmitted = async (roiContacts: ROIContact[]) => {
        updateState({ roiContacts })
        goToStep('appointment-summary')
    }

    const handleAppointmentConfirmed = async () => {
        // Create appointment with enhanced error handling
        try {
            // Map normalized slot → booking payload with exact API structure
            const slot = state.selectedTimeSlot
            const patient = state.insuranceInfo
            const acceptance = state.acceptance || (state as any).acceptance

            // Build payload with exact keys our API expects (camelCase)
            const payload = {
                providerId: slot?.provider_id,
                serviceInstanceId: acceptance?.service_instance_id || acceptance?.serviceInstanceId,
                payerId: state.selectedPayer?.id,
                date: slot?.date,
                time: slot?.time,
                durationMinutes: slot?.duration_minutes ?? 60,
                patient: {
                    firstName: patient?.first_name || patient?.firstName,
                    lastName: patient?.last_name || patient?.lastName,
                    phone: patient?.phone,
                    email: patient?.email,
                    dob: patient?.dob
                }
            }

            // ✅ UUID validation helper
            const isUuid = (v?: string) => !!v && /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12}$/.test(v)

            // ✅ DEV-ONLY GUARD: Surface mistakes immediately
            if (process.env.NODE_ENV === 'development') {
                const required = [
                    'providerId', 'serviceInstanceId', 'payerId', 'date', 'time',
                    'patient.firstName', 'patient.lastName', 'patient.phone'
                ]
                const missing = required.filter(k => !k.split('.').reduce((o, p) => o?.[p], payload))
                if (missing.length) {
                    console.error('Missing fields', { missing, payload })
                    alert('Dev: Missing ' + missing.join(', '))
                    return
                }

                // Dev guard: ensure valid UUID and correct service
                if (!isUuid(payload.serviceInstanceId)) {
                    console.error('Invalid serviceInstanceId', payload.serviceInstanceId)
                    alert('Dev: serviceInstanceId missing/invalid')
                    return
                }

                // Additional check for expected seeded UUIDs
                const expectedUUIDs = [
                    '12191f44-a09c-426f-8e22-0c5b8e57b3b7', // Housed
                    '1a659f8e-249a-4690-86e7-359c6c381bc0'  // Unhoused
                ]
                if (!expectedUUIDs.includes(payload.serviceInstanceId)) {
                    console.warn('⚠️ Dev: Unexpected serviceInstanceId (not in seeded list):', payload.serviceInstanceId)
                }
            }

            // ✅ USER-SAFE BLOCK: If we can't resolve the SID, show friendly message and stop
            if (!payload.serviceInstanceId) {
                alert('This clinician is not yet configured for Telehealth Intake with your insurance. Please pick another clinician or contact support.')
                return
            }

            // Enhanced frontend logging
            console.log('🚀 BOOKING DEBUG - Starting appointment creation:', {
                hasTimeSlot: !!slot,
                hasProvider: !!slot?.provider_id,
                hasPayer: !!state.selectedPayer?.id,
                hasPatientInfo: !!patient,
                hasServiceInstanceId: !!payload.serviceInstanceId,
                patientName: `${payload.patient.firstName} ${payload.patient.lastName}`,
                selectedDate: slot?.date,
                selectedTime: slot?.time,
                payload
            })

            console.log('📋 BOOKING DEBUG - Appointment payload:', payload)
            console.log('📤 CREATE-APPT payload (client)', payload)

            const response = await fetch('/api/patient-booking/create-appointment-v2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            let result: any = null
            try { 
                result = await response.json() 
            } catch (parseError) { 
                console.error('❌ BOOKING DEBUG - Failed to parse response:', parseError)
                throw new Error('Invalid response from server')
            }

            console.log('📨 BOOKING DEBUG - API Response:', {
                status: response.status,
                ok: response.ok,
                success: result?.success,
                hasAppointmentId: !!result?.data?.appointment?.id,
                error: result?.error
            })

            // Only proceed to confirmation if API returned success with appointment ID
            if (!response.ok || !result?.success || !result?.data?.appointment?.id) {
                console.error('❌ BOOKING DEBUG - Appointment creation failed:', { 
                    status: response.status, 
                    result 
                })
                alert(`Appointment failed: ${result?.error ?? response.statusText ?? 'Unknown error'}`)
                return // STOP — do not go to confirmation
            }

            // Success case
            console.log('✅ BOOKING DEBUG - Appointment created successfully:', result.data.appointment.id)
            updateState({ 
                appointmentId: result.data.appointment.id,
                roiContacts: state.roiContacts
            })
            goToStep('confirmation') // Only on success

        } catch (error: any) {
            console.error('❌ BOOKING DEBUG - Unexpected error:', error)
            alert(`Booking failed: ${error.message}`)
            return // STOP — do not go to confirmation
        }
    }

    const handleWaitlistSubmitted = () => {
        goToStep('waitlist-confirmation')
    }

    const handleWaitForEffectiveDate = () => {
        // This could add them to a different type of waitlist
        // For now, treat same as waitlist
        goToStep('waitlist-confirmation')
    }

    const handleBookAnyway = () => {
        // Set booking mode to only show dates from effective date forward
        updateState({ 
            bookingMode: 'from-effective-date',
            payerAcceptanceStatus: 'active' // Treat as active but with date restrictions
        })
        goToStep('calendar')
    }

    // Back navigation handlers
    const handleBackToWelcome = () => {
        goToStep('welcome')
    }

    const handleBackToInsurance = () => {
        goToStep('payer-search')
    }

    const handleBackToCalendar = () => {
        goToStep('calendar')
    }

    const handleRestartFlow = () => {
        setState({
            step: 'welcome',
            bookingScenario: 'self',
            roiContacts: [],
            intent: state.intent // Preserve the original intent
        })
    }

    // Main render function
    const renderCurrentStep = () => {
        switch (state.step) {
            case 'welcome':
                return (
                    <WelcomeView 
                        onSelection={handleWelcomeSelection} 
                        intent={state.intent}
                    />
                )

            case 'payer-search':
                return (
                    <PayerSearchView
                        onPayerSelected={handlePayerSelected}
                        bookingScenario={state.bookingScenario}
                        intent={state.intent}
                        onBack={undefined} // No back button since this is the first step
                    />
                )

            case 'insurance-not-accepted':
                if (!state.selectedPayer) {
                    return (
                        <div className="min-h-screen flex items-center justify-center bg-stone-50">
                            <div className="text-center space-y-4">
                                <p className="text-stone-600">Insurance information missing.</p>
                                <button 
                                    onClick={handleBackToInsurance}
                                    className="px-6 py-3 bg-[#BF9C73] text-white rounded-xl hover:bg-[#A8875F] transition-colors"
                                >
                                    Back to Insurance Selection
                                </button>
                            </div>
                        </div>
                    )
                }
                return (
                    <InsuranceNotAcceptedView
                        selectedPayer={state.selectedPayer}
                        onBackToPayers={handleBackToInsurance}
                        onCashPayment={handleCashPaymentSelected}
                        onWaitlistSubmitted={handleWaitlistSubmitted}
                    />
                )

            case 'provider-insurance-mismatch':
                if (!state.selectedPayer || !selectedProviderId) {
                    return (
                        <div className="min-h-screen flex items-center justify-center bg-stone-50">
                            <div className="text-center space-y-4">
                                <p className="text-stone-600">Provider or insurance information missing.</p>
                                <button 
                                    onClick={handleBackToInsurance}
                                    className="px-6 py-3 bg-[#BF9C73] text-white rounded-xl hover:bg-[#A8875F] transition-colors"
                                >
                                    Back to Insurance Selection
                                </button>
                            </div>
                        </div>
                    )
                }
                return (
                    <ProviderInsuranceMismatchView
                        state={state}
                        providerName={selectedProvider ? `${selectedProvider.first_name} ${selectedProvider.last_name}` : 'Provider'}
                        insuranceName={state.selectedPayer.name}
                        onContinueWithOthers={() => {
                            // Go directly to calendar view with selected insurance preserved
                            goToStep('calendar')
                        }}
                        onJoinWaitlist={() => {
                            goToStep('waitlist-confirmation')
                        }}
                    />
                )

            case 'insurance-future':
                if (!state.selectedPayer) {
                    return (
                        <div className="min-h-screen flex items-center justify-center bg-stone-50">
                            <div className="text-center space-y-4">
                                <p className="text-stone-600">Insurance information missing.</p>
                                <button 
                                    onClick={handleBackToInsurance}
                                    className="px-6 py-3 bg-[#BF9C73] text-white rounded-xl hover:bg-[#A8875F] transition-colors"
                                >
                                    Back to Insurance Selection
                                </button>
                            </div>
                        </div>
                    )
                }
                return (
                    <InsuranceFutureView
                        selectedPayer={state.selectedPayer}
                        onBackToPayers={handleBackToInsurance}
                        onCashPayment={handleCashPaymentSelected}
                        onWaitForEffectiveDate={handleWaitForEffectiveDate}
                        onBookAnyway={handleBookAnyway}
                    />
                )

            case 'waitlist-confirmation':
                if (!state.selectedPayer) {
                    return (
                        <div className="min-h-screen flex items-center justify-center bg-stone-50">
                            <div className="text-center space-y-4">
                                <p className="text-stone-600">Insurance information missing.</p>
                                <button 
                                    onClick={handleRestartFlow}
                                    className="px-6 py-3 bg-[#BF9C73] text-white rounded-xl hover:bg-[#A8875F] transition-colors"
                                >
                                    Start Over
                                </button>
                            </div>
                        </div>
                    )
                }
                return (
                    <WaitlistConfirmationView
                        selectedPayer={state.selectedPayer}
                        onReturnHome={handleRestartFlow}
                    />
                )

            case 'calendar':
                if (!state.selectedPayer) {
                    return (
                        <div className="min-h-screen flex items-center justify-center bg-stone-50">
                            <div className="text-center space-y-4">
                                <p className="text-stone-600">Please select a payer or cash option first.</p>
                                <button
                                    onClick={handleBackToInsurance}
                                    className="px-6 py-3 bg-[#BF9C73] text-white rounded-xl hover:bg-[#A8875F] transition-colors"
                                >
                                    Back to Insurance Selection
                                </button>
                            </div>
                        </div>
                    )
                }

                return (
                    <CalendarView
                        selectedPayer={state.selectedPayer}
                        onTimeSlotSelected={handleTimeSlotSelected}
                        onBackToInsurance={handleBackToInsurance}
                        bookingMode={state.bookingMode}
                        intent={state.intent}
                        selectedProvider={state.selectedProvider}
                    />
                )

            case 'insurance-info':
                if (!state.selectedTimeSlot) {
                    return (
                        <div className="min-h-screen flex items-center justify-center bg-stone-50">
                            <div className="text-center space-y-4">
                                <p className="text-stone-600">Please select a time slot first.</p>
                                <button 
                                    onClick={handleBackToCalendar}
                                    className="px-6 py-3 bg-[#BF9C73] text-white rounded-xl hover:bg-[#A8875F] transition-colors"
                                >
                                    Back to Calendar
                                </button>
                            </div>
                        </div>
                    )
                }
                return (
                    <InsuranceInfoView
                        selectedPayer={state.selectedPayer!}
                        selectedTimeSlot={state.selectedTimeSlot}
                        bookingScenario={state.bookingScenario}
                        onSubmit={handleInsuranceInfoSubmitted}
                        onBack={handleBackToCalendar}
                    />
                )

            case 'roi':
                return (
                    <ROIView
                        bookingScenario={state.bookingScenario}
                        onSubmit={handleROISubmitted}
                        onBack={() => goToStep('insurance-info')}
                    />
                )

            case 'appointment-summary':
                return (
                    <AppointmentSummaryView
                        selectedPayer={state.selectedPayer}
                        selectedTimeSlot={state.selectedTimeSlot}
                        insuranceInfo={state.insuranceInfo}
                        roiContacts={state.roiContacts}
                        bookingScenario={state.bookingScenario}
                        onConfirmBooking={handleAppointmentConfirmed}
                        onEditInsurance={() => goToStep('insurance-info')}
                        onEditTimeSlot={() => goToStep('calendar')}
                        onEditROI={() => goToStep('roi')}
                        onBack={() => goToStep('roi')}
                    />
                )

            case 'confirmation':
                return (
                    <ConfirmationView
                        appointmentId={state.appointmentId}
                        patientInfo={state.insuranceInfo}
                        selectedPayer={state.selectedPayer}
                        selectedTimeSlot={state.selectedTimeSlot}
                        bookingScenario={state.bookingScenario}
                        onStartOver={handleRestartFlow}
                    />
                )

            default:
                return (
                    <div className="min-h-screen flex items-center justify-center bg-stone-50">
                        <div className="text-center space-y-4">
                            <p className="text-stone-600">Unknown step: {state.step}</p>
                            <button 
                                onClick={handleRestartFlow}
                                className="px-6 py-3 bg-[#BF9C73] text-white rounded-xl hover:bg-[#A8875F] transition-colors"
                            >
                                Start Over
                            </button>
                        </div>
                    </div>
                )
        }
    }

    return (
        <div className="min-h-screen">
            {renderCurrentStep()}
        </div>
    )
}