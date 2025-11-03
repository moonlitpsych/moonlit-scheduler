'use client'

import { InsuranceInfo, Payer, ROIContact, TimeSlot } from '@/types/database'
import { useState, useEffect } from 'react'

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
    | 'booking-error' // NEW: for PracticeQ sync failures

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
    // NEW: Error handling for PracticeQ sync failures
    bookingError?: string
    showPQSyncError?: boolean // Only show IntakeQ sync error banner for actual IntakeQ issues
    // NEW: Submission state to prevent duplicate requests
    isSubmitting?: boolean
    // V3.3: Progress feedback for long-running operations
    progressMessage?: string
    showRetryButton?: boolean
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
        // V2.0: Scroll to top immediately on step change
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    // V2.0: Auto-scroll to top on step changes (backup for any direct state mutations)
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [state.step])

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

        // TEMPORARILY DISABLED (Oct 27, 2025): ROI contacts feature
        // UI collects data but backend doesn't persist it - see ROI_CONTACTS_ANALYSIS_REPORT.md
        // To re-enable: change 'appointment-summary' back to 'roi' and implement backend save
        goToStep('appointment-summary')  // Skip ROI step until backend is ready
    }

    const handleROISubmitted = async (roiContacts: ROIContact[]) => {
        updateState({ roiContacts })
        goToStep('appointment-summary')
    }

    const handleAppointmentConfirmed = async () => {
        // Prevent duplicate submissions (debouncing)
        if (state.isSubmitting) {
            console.warn('⚠️ Booking already in progress, ignoring duplicate request')
            return
        }

        // Set submitting flag
        updateState({ isSubmitting: true })

        // V3.3: Add progressive feedback for long-running operations
        let progressMessage = 'Processing your booking...'
        updateState({ progressMessage })

        // Set up progress message updates
        const progressIntervals: NodeJS.Timeout[] = []

        progressIntervals.push(setTimeout(() => {
            updateState({ progressMessage: 'Creating your patient record...' })
        }, 15000)) // 15 seconds

        progressIntervals.push(setTimeout(() => {
            updateState({ progressMessage: 'Still working, this can take up to a minute...' })
        }, 30000)) // 30 seconds

        progressIntervals.push(setTimeout(() => {
            updateState({ progressMessage: 'Almost done, please don\'t close this tab...' })
        }, 60000)) // 60 seconds

        // Create appointment with enhanced error handling
        const abortController = new AbortController()

        // V3.3: Add 90-second timeout
        const timeoutId = setTimeout(() => {
            abortController.abort()
            updateState({
                progressMessage: 'The booking is taking longer than expected. You can wait or try again.',
                showRetryButton: true
            })
        }, 90000) // 90 seconds

        try {
            // Map normalized slot → Intake-only booking payload
            const slot = state.selectedTimeSlot
            const patient = state.insuranceInfo

            // Use the slot's pre-formatted ISO timestamp (includes timezone)
            // FIXED: Previously reconstructed from date+time without timezone, causing wrong appointment times
            const startDateTime = slot?.start_time || `${slot?.date}T${slot?.time}:00`

            // Generate stable idempotency key from booking intent
            const idempotencyData = {
                providerId: slot?.provider_id,
                payerId: state.selectedPayer?.id,
                start: startDateTime,
                email: patient?.email
            }
            const idempotencyKey = btoa(JSON.stringify(idempotencyData))

            // Intake-only payload (server resolves serviceInstanceId)
            // Send EITHER patientId (if exists) OR patient object (for new patients)
            const payload = {
                ...(patient?.id
                    ? { patientId: patient.id }
                    : {
                        patient: {
                            firstName: patient?.firstName || '',
                            lastName: patient?.lastName || '',
                            email: patient?.email || '',
                            phone: patient?.phone,
                            dateOfBirth: patient?.dateOfBirth || patient?.dob  // Support both field names
                        }
                    }
                ),
                providerId: slot?.provider_id,
                payerId: state.selectedPayer?.id,
                start: startDateTime,
                locationType: 'telehealth' as const,
                notes: patient?.notes || undefined,
                // Insurance enrichment fields (IntakeQ client upsert)
                memberId: patient?.insuranceId || undefined,  // Map insuranceId → memberId
                groupNumber: patient?.groupNumber || undefined
            }

            // Log payload for debugging
            console.log('🚀 INTAKE BOOKING - Starting appointment creation:', {
                hasTimeSlot: !!slot,
                hasProvider: !!slot?.provider_id,
                hasPayer: !!state.selectedPayer?.id,
                hasPatientInfo: !!patient,
                payload
            })

            // V2.0: Use new endpoint when enrichment is enabled
            const bookingEndpoint = process.env.NEXT_PUBLIC_USE_V2_BOOKING === 'true'
                ? '/api/patient-booking/book-v2'
                : '/api/patient-booking/book'

            const response = await fetch(bookingEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': idempotencyKey
                },
                body: JSON.stringify(payload),
                signal: abortController.signal
            })

            let result: any = null
            try { 
                result = await response.json() 
            } catch (parseError) { 
                console.error('❌ BOOKING DEBUG - Failed to parse response:', parseError)
                throw new Error('Invalid response from server')
            }

            console.log('BOOKING DEBUG – server response', {
                ok: response.ok,
                pqAppointmentId: result?.data?.pqAppointmentId,
                appointmentId: result?.data?.appointmentId,
                code: result?.code
            })

            // Check if we got a duplicate appointment (which is actually success)
            if (result?.success && result?.data?.isDuplicate) {
                console.log('✅ Found existing appointment, treating as success')
                updateState({
                    appointmentId: result.data.appointmentId,
                    roiContacts: state.roiContacts
                })
                goToStep('confirmation')
                return
            }

            // CRITICAL: Require at least appointmentId (pqAppointmentId is optional based on enrichment)
            if (!response.ok || !result?.success || !result?.data?.appointmentId) {
                console.error('BOOKING DEBUG – Booking failed:', {
                    status: response.status,
                    code: result?.code,
                    appointmentId: result?.details?.appointmentId
                })

                // Map error codes to user-friendly messages
                const errorMessage = result?.code === 'CONFLICT'
                    ? "That time slot is no longer available. Please choose another time."
                    : result?.code === 'DUPLICATE_REQUEST'
                    ? "You've already booked this appointment. Check your email for confirmation."
                    : result?.code === 'NO_INTAKE_INSTANCE_FOR_PAYER'
                    ? "This insurance isn't configured for new patient visits yet."
                    : result?.code === 'MISSING_PROVIDER_MAPPING'
                    ? "That provider isn't ready to book yet."
                    : result?.code === 'PATIENT_UPSERT_FAILED'
                    ? "We couldn't create your patient record. Please check your information and try again."
                    : result?.code === 'SLOT_TAKEN'
                    ? "That time was just taken. Please pick another slot."
                    : result?.code === 'EHR_WRITE_FAILED'
                    ? "We couldn't sync with our scheduling system. Your appointment was saved - we'll complete setup and email you."
                    : result?.error ?? response.statusText ?? 'Unknown error'

                // Only show PQ sync error if it's specifically an IntakeQ issue
                const showPQError = result?.code === 'EHR_WRITE_FAILED' ||
                                   result?.code === 'MISSING_PROVIDER_MAPPING'

                // Store error state and appointment ID for retry
                updateState({
                    bookingError: errorMessage,
                    appointmentId: result?.details?.appointmentId || undefined,
                    showPQSyncError: showPQError
                })
                goToStep('booking-error') // Show error UI
                return // STOP — do not go to confirmation
            }

            // Success case - store appointment ID (DB primary, PQ optional)
            console.log('BOOKING DEBUG – Booking success:', {
                appointmentId: result.data.appointmentId,
                pqAppointmentId: result.data.pqAppointmentId
            })
            updateState({
                appointmentId: result.data.appointmentId,  // Use DB ID as primary
                roiContacts: state.roiContacts
            })
            goToStep('confirmation') // Only on success

        } catch (error: any) {
            console.error('❌ BOOKING DEBUG - Unexpected error:', error)

            // Handle abort separately
            if (error.name === 'AbortError') {
                console.log('Booking request aborted')
                // V3.3: Check if this was a timeout abort
                if (!state.showRetryButton) {
                    updateState({
                        bookingError: 'The booking request timed out. Please try again.',
                        showRetryButton: true
                    })
                }
                return
            }

            alert(`Booking failed: ${error.message}`)
            return // STOP — do not go to confirmation
        } finally {
            // V3.3: Clean up all timers
            clearTimeout(timeoutId)
            progressIntervals.forEach(interval => clearTimeout(interval))

            // Always reset submitting flag and progress message
            updateState({
                isSubmitting: false,
                progressMessage: undefined,
                showRetryButton: false
            })
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
                        isSubmitting={state.isSubmitting}
                        progressMessage={state.progressMessage}
                        showRetryButton={state.showRetryButton}
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

            case 'booking-error':
                return (
                    <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1]">
                        <div className="max-w-6xl mx-auto px-4 py-8">
                            <div className="text-center mb-8">
                                <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </div>
                                <h1 className="text-4xl md:text-5xl font-light text-[#091747] mb-4 font-['Newsreader']">Booking Issue</h1>
                                <p className="text-xl text-[#091747]/70 max-w-3xl mx-auto leading-relaxed mb-8 font-['Newsreader']">
                                    {state.bookingError || 'We encountered an issue completing your booking.'}
                                </p>
                            </div>
                            <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl p-8">
                                {/* Only show PQ sync error banner if it's an IntakeQ-specific issue */}
                                {state.showPQSyncError && (
                                    <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
                                        <p className="text-red-800 font-['Newsreader']">
                                            Your appointment was saved to our system, but we couldn't sync it with our scheduling partner.
                                            {state.appointmentId && <span className="block mt-2 text-sm text-red-700">Reference: {state.appointmentId}</span>}
                                        </p>
                                    </div>
                                )}
                                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                    {state.appointmentId && (
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    const res = await fetch('/api/practiceq/retry-appointment', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ appointmentId: state.appointmentId })
                                                    })
                                                    const data = await res.json()
                                                    if (data.success) {
                                                        console.log('BOOKING DEBUG – retry success')
                                                        updateState({ appointmentId: data.data.pqAppointmentId })
                                                        goToStep('confirmation')
                                                    } else {
                                                        console.error('BOOKING DEBUG – retry failed:', data.error)
                                                        alert(`Retry failed: ${data.error}`)
                                                    }
                                                } catch (error: any) {
                                                    console.error('BOOKING DEBUG – retry exception:', error)
                                                    alert('Network error during retry')
                                                }
                                            }}
                                            className="px-8 py-3 bg-[#BF9C73] hover:bg-[#A8865F] text-white rounded-xl font-medium transition-colors font-['Newsreader']"
                                        >
                                            Retry Sync
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleRestartFlow}
                                        className="px-8 py-3 bg-white hover:bg-[#FEF8F1] text-[#091747] font-medium rounded-xl border-2 border-[#BF9C73] transition-colors font-['Newsreader']"
                                    >
                                        Start New Booking
                                    </button>
                                </div>
                                <div className="mt-8 text-center border-t pt-6">
                                    <p className="text-[#091747]/70 font-['Newsreader']">
                                        Need help? <a href="mailto:hello@trymoonlit.com" className="text-[#BF9C73] hover:text-[#091747] underline">hello@trymoonlit.com</a>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
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