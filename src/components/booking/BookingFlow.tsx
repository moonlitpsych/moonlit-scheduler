'use client'

import { InsuranceInfo, Payer, ROIContact, TimeSlot } from '@/types/database'
import { useState } from 'react'
import ProgressBar from './ProgressBar'

// Import view components (ensure these match your actual imports)
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
    | 'confirmation'

export type BookingScenario = 'self' | 'third-party' | 'case-manager'

export interface BookingState {
    step: BookingStep
    bookingScenario: BookingScenario
    currentStep: number
    totalSteps: number
    selectedPayer?: Payer
    payerAcceptanceStatus?: 'not-accepted' | 'future' | 'active'
    bookingMode?: 'normal' | 'from-effective-date' // NEW: for "book anyway" functionality
    selectedTimeSlot?: TimeSlot
    insuranceInfo?: InsuranceInfo
    roiContacts: ROIContact[]
    appointmentId?: string
}

export default function BookingFlow() {
    const [state, setState] = useState<BookingState>({
        step: 'welcome',
        bookingScenario: 'self',
        currentStep: 1,
        totalSteps: 6,
        roiContacts: []
    })

    const updateState = (updates: Partial<BookingState>) => {
        setState(prev => ({ ...prev, ...updates }))
    }

    const goToStep = (step: BookingStep, currentStep: number, totalSteps?: number) => {
        setState(prev => ({
            ...prev,
            step,
            currentStep,
            totalSteps: totalSteps ?? prev.totalSteps
        }))
    }

    // Navigation handlers
    const handleWelcomeSelection = (scenario: BookingScenario) => {
        updateState({ bookingScenario: scenario })
        goToStep('payer-search', 2)
    }

    const handlePayerSelected = (payer: Payer, acceptanceStatus: BookingState['payerAcceptanceStatus']) => {
        updateState({ 
            selectedPayer: payer, 
            payerAcceptanceStatus: acceptanceStatus 
        })

        switch (acceptanceStatus) {
            case 'not-accepted':
                goToStep('insurance-not-accepted', 3, 4)
                break
            case 'future':
                goToStep('insurance-future', 3, 4)
                break
            case 'active':
                goToStep('calendar', 3, 6)
                break
        }
    }

    const handleCashPaymentSelected = () => {
        // Use a dummy payer for cash payments so calendar can render
        updateState({
            selectedPayer: { id: 'cash-payment', name: 'Cash Payment' } as Payer,
            payerAcceptanceStatus: undefined
        })
        goToStep('calendar', 3, 6)
    }

    const handleTimeSlotSelected = (timeSlot: TimeSlot) => {
        updateState({ selectedTimeSlot: timeSlot })
        goToStep('insurance-info', state.currentStep + 1)
    }

    const handleInsuranceInfoSubmitted = (insuranceInfo: InsuranceInfo) => {
        updateState({ insuranceInfo })
        goToStep('roi', state.currentStep + 1)
    }

    const handleROISubmitted = (roiContacts: ROIContact[]) => {
        updateState({ roiContacts })
        // Here you would actually submit the appointment to your backend
        // For now, just go to confirmation
        goToStep('confirmation', state.currentStep + 1)
    }

    const handleWaitlistSubmitted = () => {
        goToStep('waitlist-confirmation', state.currentStep + 1)
    }

    const handleWaitForEffectiveDate = () => {
        // This could add them to a different type of waitlist
        // For now, treat same as waitlist
        goToStep('waitlist-confirmation', state.currentStep + 1)
    }

    const handleBookAnyway = () => {
        // Set booking mode to only show dates from effective date forward
        updateState({
            bookingMode: 'from-effective-date',
            payerAcceptanceStatus: 'active' // Treat as active but with date restrictions
        })
        goToStep('calendar', 4, 7)
    }

    // Back navigation handlers
    const handleBackToWelcome = () => {
        goToStep('welcome', 1, 6)
    }

    const handleBackToInsurance = () => {
        goToStep('payer-search', 2)
    }

    const handleBackToCalendar = () => {
        goToStep('calendar', state.currentStep - 1)
    }

    const handleRestartFlow = () => {
        setState({
            step: 'welcome',
            bookingScenario: 'self',
            currentStep: 1,
            totalSteps: 6,
            roiContacts: []
        })
    }

    // Main render function
    const renderCurrentStep = () => {
        switch (state.step) {
            case 'welcome':
                return (
                    <WelcomeView onSelection={handleWelcomeSelection} />
                )

            case 'payer-search':
                return (
                    <PayerSearchView
                        onPayerSelected={handlePayerSelected}
                        onCashPayment={handleCashPaymentSelected}
                        bookingScenario={state.bookingScenario}
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
                        onBack={() => goToStep('insurance-info', state.currentStep - 1)}
                    />
                )

            case 'confirmation':
                return (
                    <ConfirmationView
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
            <ProgressBar currentStep={state.currentStep} totalSteps={state.totalSteps} />
            {renderCurrentStep()}
        </div>
    )
}