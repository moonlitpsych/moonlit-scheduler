// src/components/booking/BookingFlow.tsx
'use client'

import { useState } from 'react'
import { Payer, TimeSlot, PatientInfo, InsuranceInfo, ROIContact } from '@/types/database'

// Import your existing view components (DEFAULT imports - no curly braces)
import WelcomeView from './views/WelcomeView'
import PayerSearchView from './views/PayerSearchView' // Enhanced version
import CalendarView from './views/CalendarView' // Enhanced version
import InsuranceNotAcceptedView from './views/InsuranceNotAcceptedView'
import InsuranceFutureView from './views/InsuranceFutureView'
import InsuranceInfoView from './views/InsuranceInfoView'
import ROIView from './views/ROIView'
import ConfirmationView from './views/ConfirmationView'

type BookingStep =
    | 'welcome'
    | 'payer-search'
    | 'insurance-not-accepted'
    | 'insurance-future'
    | 'calendar'
    | 'insurance-info'
    | 'roi'
    | 'confirmation'

interface BookingState {
    step: BookingStep
    isForSelf: boolean
    selectedPayer?: Payer
    payerAcceptanceStatus?: 'not-accepted' | 'future' | 'active'
    selectedTimeSlot?: TimeSlot
    patientInfo?: PatientInfo
    insuranceInfo?: InsuranceInfo
    roiContacts: ROIContact[]
    appointmentId?: string
}

export default function BookingFlow() {
    const [state, setState] = useState<BookingState>({
        step: 'welcome',
        isForSelf: true,
        roiContacts: []
    })

    const updateState = (updates: Partial<BookingState>) => {
        setState(prev => ({ ...prev, ...updates }))
    }

    const goToStep = (step: BookingStep) => {
        setState(prev => ({ ...prev, step }))
    }

    // Navigation handlers
    const handleWelcomeSelection = (isForSelf: boolean) => {
        updateState({ isForSelf })
        goToStep('payer-search')
    }

    const handlePayerSelected = (payer: Payer, acceptanceStatus: BookingState['payerAcceptanceStatus']) => {
        updateState({ selectedPayer: payer, payerAcceptanceStatus: acceptanceStatus })

        // The enhanced PayerSearchView handles the animation states internally
        // and will automatically call this function after the animations complete
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
        updateState({
            selectedPayer: undefined,
            payerAcceptanceStatus: undefined
        })
        goToStep('calendar')
    }

    const handleTimeSlotSelected = (timeSlot: TimeSlot) => {
        updateState({ selectedTimeSlot: timeSlot })
        goToStep('insurance-info')
    }

    const handleInsuranceInfoComplete = (insuranceInfo: InsuranceInfo) => {
        updateState({ insuranceInfo })
        goToStep('roi')
    }

    const handleROIComplete = (roiContacts: ROIContact[]) => {
        updateState({ roiContacts })
        // TODO: Submit appointment booking to Supabase
        goToStep('confirmation')
    }

    const handleBackToInsurance = () => {
        goToStep('payer-search')
    }

    const handleBackToCalendar = () => {
        goToStep('calendar')
    }

    const handleLeadSubmitted = () => {
        // After submitting a lead for unaccepted insurance,
        // show a thank you message or redirect
        goToStep('confirmation')
    }

    const handleWaitForEffectiveDate = () => {
        // Handle waiting for insurance to become effective
        goToStep('confirmation')
    }

    const handleSwitchInsurance = () => {
        // Reset insurance selection and go back to payer search
        updateState({
            selectedPayer: undefined,
            payerAcceptanceStatus: undefined
        })
        goToStep('payer-search')
    }

    const handleRestartFlow = () => {
        setState({
            step: 'welcome',
            isForSelf: true,
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
                    />
                )

            case 'insurance-not-accepted':
                return (
                    <InsuranceNotAcceptedView
                        payer={state.selectedPayer!}
                        onLeadSubmitted={handleLeadSubmitted}
                        onCashPayment={handleCashPaymentSelected}
                    />
                )

            case 'insurance-future':
                return (
                    <InsuranceFutureView
                        payer={state.selectedPayer!}
                        onWaitForEffectiveDate={handleWaitForEffectiveDate}
                        onCashPayment={handleCashPaymentSelected}
                    />
                )

            case 'calendar':
                return (
                    <CalendarView
                        selectedPayer={state.selectedPayer}
                        onTimeSlotSelected={handleTimeSlotSelected}
                        onBackToInsurance={handleBackToInsurance}
                    />
                )

            case 'insurance-info':
                return (
                    <InsuranceInfoView
                        isForSelf={state.isForSelf}
                        selectedPayer={state.selectedPayer}
                        onComplete={handleInsuranceInfoComplete}
                        onBack={handleBackToCalendar}
                        onSwitchInsurance={handleSwitchInsurance}
                    />
                )

            case 'roi':
                return (
                    <ROIView
                        isForSelf={state.isForSelf}
                        onComplete={handleROIComplete}
                        onBack={() => goToStep('insurance-info')}
                    />
                )

            case 'confirmation':
                return (
                    <ConfirmationView
                        appointmentData={{
                            selectedPayer: state.selectedPayer,
                            selectedTimeSlot: state.selectedTimeSlot,
                            patientInfo: state.patientInfo,
                            insuranceInfo: state.insuranceInfo,
                            roiContacts: state.roiContacts,
                            appointmentId: state.appointmentId
                        }}
                        onRestart={handleRestartFlow}
                    />
                )

            default:
                return <div>Invalid step</div>
        }
    }

    return (
        <div className="min-h-screen">
            {/* Progress indicator (optional) */}
            {state.step !== 'welcome' && state.step !== 'confirmation' && (
                <div className="fixed top-0 left-0 right-0 z-50">
                    <div className="bg-white/90 backdrop-blur-sm border-b border-[#BF9C73]/20">
                        <div className="max-w-4xl mx-auto px-4 py-3">
                            <div className="flex items-center justify-between text-sm text-[#091747]/70" style={{ fontFamily: 'Newsreader, serif' }}>
                                <div className="flex items-center space-x-4">
                                    <span className={`${['payer-search', 'insurance-not-accepted', 'insurance-future'].includes(state.step)
                                            ? 'text-[#BF9C73] font-medium'
                                            : 'text-[#091747]/40'
                                        }`}>
                                        1. Insurance
                                    </span>
                                    <span className={`${state.step === 'calendar'
                                            ? 'text-[#BF9C73] font-medium'
                                            : state.selectedTimeSlot ? 'text-[#17DB4E]' : 'text-[#091747]/40'
                                        }`}>
                                        2. Schedule
                                    </span>
                                    <span className={`${['insurance-info', 'roi'].includes(state.step)
                                            ? 'text-[#BF9C73] font-medium'
                                            : state.insuranceInfo ? 'text-[#17DB4E]' : 'text-[#091747]/40'
                                        }`}>
                                        3. Details
                                    </span>
                                </div>

                                {/* Brand */}
                                <div className="text-[#091747] font-medium">
                                    Moonlit
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main content */}
            <main className={state.step !== 'welcome' && state.step !== 'confirmation' ? 'pt-16' : ''}>
                {renderCurrentStep()}
            </main>
        </div>
    )
}