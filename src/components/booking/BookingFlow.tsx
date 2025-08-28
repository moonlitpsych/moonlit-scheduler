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
import ROIView from './views/ROIView'
import WaitlistConfirmationView from './views/WaitlistConfirmationView'
import WelcomeView from './views/WelcomeView'

export type BookingStep =
    | 'welcome'
    | 'payer-search'
    | 'insurance-not-accepted'
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
    payerAcceptanceStatus?: 'not-accepted' | 'future' | 'active'
    bookingMode?: 'normal' | 'from-effective-date' // NEW: for "book anyway" functionality
    selectedTimeSlot?: TimeSlot
    insuranceInfo?: InsuranceInfo
    roiContacts: ROIContact[]
    appointmentId?: string
    intent: BookingIntent // NEW: user's intent (book vs explore)
}

interface BookingFlowProps {
    intent?: BookingIntent
}

export default function BookingFlow({ intent = 'book' }: BookingFlowProps) {
    const [state, setState] = useState<BookingState>({
        step: intent === 'explore' ? 'payer-search' : 'welcome',
        bookingScenario: 'self',
        roiContacts: [],
        intent: intent
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

    const handlePayerSelected = (payer: Payer, acceptanceStatus: BookingState['payerAcceptanceStatus']) => {
        updateState({ 
            selectedPayer: payer, 
            payerAcceptanceStatus: acceptanceStatus 
        })

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
        updateState({ selectedTimeSlot: timeSlot })
        goToStep('insurance-info')
    }

    const handleInsuranceInfoSubmitted = (insuranceInfo: InsuranceInfo) => {
        updateState({ insuranceInfo })
        goToStep('roi')
    }

    const handleROISubmitted = async (roiContacts: ROIContact[]) => {
        updateState({ roiContacts })
        goToStep('appointment-summary')
    }

    const handleAppointmentConfirmed = async () => {
        // Create appointment using the EMR integration
        try {
            console.log('📅 Creating appointment with EMR integration...')
            
            // Debug: Log current state
            console.log('🔍 Current booking state:', {
                selectedTimeSlot: state.selectedTimeSlot,
                selectedPayer: state.selectedPayer,
                insuranceInfo: state.insuranceInfo
            })
            
            // Validate required data
            if (!state.selectedTimeSlot?.provider_id || !state.selectedPayer?.id || !state.selectedTimeSlot?.start_time) {
                console.error('❌ Missing required booking data:', {
                    hasTimeSlotProviderId: !!state.selectedTimeSlot?.provider_id,
                    hasPayerId: !!state.selectedPayer?.id,
                    hasStartTime: !!state.selectedTimeSlot?.start_time,
                    timeSlot: state.selectedTimeSlot,
                    payer: state.selectedPayer
                })
                throw new Error('Missing required booking data')
            }
            
            const startTime = state.selectedTimeSlot.start_time
            const datePart = startTime.split('T')[0]
            const timePart = startTime.split('T')[1]?.substring(0, 5)
            
            if (!datePart || !timePart) {
                throw new Error('Invalid date/time format in selected time slot')
            }
            
            const appointmentData = {
                providerId: state.selectedTimeSlot.provider_id,
                payerId: state.selectedPayer.id,
                date: datePart, // Extract date from start_time
                time: timePart, // Extract HH:MM from start_time
                patient: {
                    firstName: state.insuranceInfo?.firstName || '',
                    lastName: state.insuranceInfo?.lastName || '',
                    email: state.insuranceInfo?.email || '',
                    phone: state.insuranceInfo?.phone || '',
                    dateOfBirth: state.insuranceInfo?.dob || state.insuranceInfo?.dateOfBirth || ''
                },
                appointmentType: 'consultation',
                reason: 'Scheduled appointment via booking flow',
                createInEMR: true // ✅ FIXED: Use createInEMR instead of createInAthena
            }

            console.log('📋 Appointment data:', appointmentData)

            const response = await fetch('/api/patient-booking/create-appointment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(appointmentData)
            })

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }

            const result = await response.json()
            
            if (result.success) {
                console.log('✅ Appointment created successfully:', result.data.appointment.id)
                updateState({ 
                    appointmentId: result.data.appointment.id,
                    roiContacts: state.roiContacts
                })
            } else {
                throw new Error(result.error || 'Appointment creation failed')
            }

        } catch (error: any) {
            console.error('❌ Appointment creation failed:', error)
            // Still proceed to confirmation but without appointment ID
            // User will see the error and can try again
        }
        
        goToStep('confirmation')
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
                        onBack={handleBackToWelcome}
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