// src/components/booking/BookingFlow.tsx
'use client'

import { useState } from 'react'
import { Payer, PatientInfo, InsuranceInfo, ROIContact, TimeSlot } from '@/types/database'

// Make sure these are ALL default imports (no curly braces)
import WelcomeView from './views/WelcomeView'
import PayerSearchView from './views/PayerSearchView'
import InsuranceNotAcceptedView from './views/InsuranceNotAcceptedView'
import InsuranceFutureView from './views/InsuranceFutureView'
import CalendarView from './views/CalendarView'
import InsuranceInfoView from './views/InsuranceInfoView'
import ROIView from './views/ROIView'
import ConfirmationView from './views/ConfirmationView'

export type BookingStep =
    | 'welcome'
    | 'payer-search'
    | 'insurance-not-accepted'
    | 'insurance-future'
    | 'calendar'
    | 'insurance-info'
    | 'roi'
    | 'confirmation'

export interface BookingState {
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

    // Navigation logic based on business rules
    const handlePayerSelected = (payer: Payer, acceptanceStatus: BookingState['payerAcceptanceStatus']) => {
        updateState({ selectedPayer: payer, payerAcceptanceStatus: acceptanceStatus })

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
        // TODO: Submit appointment booking
        goToStep('confirmation')
    }

    const handleCashPaymentSelected = () => {
        updateState({
            selectedPayer: undefined,
            payerAcceptanceStatus: undefined
        })
        goToStep('calendar')
    }

    // Render current step
    const renderCurrentView = () => {
        switch (state.step) {
            case 'welcome':
                return (
                    <WelcomeView
                        onSelection={(isForSelf) => {
                            updateState({ isForSelf })
                            goToStep('payer-search')
                        }}
                    />
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
                        onLeadSubmitted={() => goToStep('confirmation')}
                        onCashPayment={handleCashPaymentSelected}
                    />
                )

            case 'insurance-future':
                return (
                    <InsuranceFutureView
                        payer={state.selectedPayer!}
                        onWaitForEffectiveDate={() => goToStep('confirmation')}
                        onCashPayment={handleCashPaymentSelected}
                    />
                )

            case 'calendar':
                return (
                    <CalendarView
                        payer={state.selectedPayer}
                        onTimeSlotSelected={handleTimeSlotSelected}
                    />
                )

            case 'insurance-info':
                return (
                    <InsuranceInfoView
                        isForSelf={state.isForSelf}
                        onComplete={handleInsuranceInfoComplete}
                    />
                )

            case 'roi':
                return (
                    <ROIView
                        onComplete={handleROIComplete}
                    />
                )

            case 'confirmation':
                return (
                    <ConfirmationView
                        appointment={{
                            payer: state.selectedPayer,
                            timeSlot: state.selectedTimeSlot,
                            patientInfo: state.patientInfo,
                            appointmentId: state.appointmentId
                        }}
                        onStartOver={() => {
                            setState({
                                step: 'welcome',
                                isForSelf: true,
                                roiContacts: []
                            })
                        }}
                    />
                )

            default:
                return <div>Invalid step</div>
        }
    }

    return (
        <div className="min-h-screen bg-stone-50">
            {/* Header */}
            <header className="bg-white border-b border-stone-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center space-x-2">
                            <div className="flex space-x-1">
                                <div className="w-3 h-3 bg-slate-700 rounded-full"></div>
                                <div className="w-3 h-3 bg-slate-700 rounded-full"></div>
                                <div className="w-3 h-3 bg-slate-500 rounded-full"></div>
                                <div className="w-3 h-3 bg-slate-500 rounded-full"></div>
                            </div>
                            <span className="text-xl font-semibold text-slate-800">moonlit</span>
                            <span className="text-sm text-slate-600 uppercase tracking-wide">PSYCHIATRY</span>
                        </div>
                        <nav className="flex items-center space-x-8">
                            <a href="#" className="text-slate-700 hover:text-slate-900">Our providers</a>
                            <a href="#" className="text-slate-700 hover:text-slate-900">Refer a client</a>
                            <button className="bg-amber-700 text-white px-4 py-2 rounded-md hover:bg-amber-800 transition-colors">
                                Book now
                            </button>
                        </nav>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-semibold text-slate-800 tracking-wide">
                        BOOK WITH MOONLIT
                    </h1>
                </div>

                {renderCurrentView()}
            </main>
        </div>
    )
}