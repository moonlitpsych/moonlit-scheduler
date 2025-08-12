'use client'

import { InsuranceInfo, PatientInfo, Payer, ROIContact, TimeSlot } from '@/types/database'
import { useState } from 'react'

import CalendarView from './views/CalendarView'
import ConfirmationView from './views/ConfirmationView'
import InsuranceFutureView from './views/InsuranceFutureView'
import InsuranceInfoView from './views/InsuranceInfoView'
import InsuranceNotAcceptedView from './views/InsuranceNotAcceptedView'
import PayerSearchView from './views/PayerSearchView'
import ROIView from './views/ROIView'
import WelcomeView, { BookingScenario } from './views/WelcomeView'

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
    bookingScenario: BookingScenario
    selectedPayer?: Payer
    payerAcceptanceStatus?: 'not-accepted' | 'future' | 'active'
    selectedTimeSlot?: TimeSlot
    patientInfo?: PatientInfo
    insuranceInfo?: InsuranceInfo
    roiContacts: ROIContact[]
    appointmentId?: string
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
}

export default function BookingFlow() {
    const [state, setState] = useState<BookingState>({
        step: 'welcome',
        bookingScenario: 'self',
        roiContacts: [],
        communicationPreferences: {
            sendToPatient: true,
            sendToCaseManager: false,
            patientHasEmail: true
        }
    })

    const updateState = (updates: Partial<BookingState>) => {
        setState(prev => ({ ...prev, ...updates }))
    }

    const goToStep = (step: BookingStep) => {
        setState(prev => ({ ...prev, step }))
    }

    const handleWelcomeSelection = (scenario: BookingScenario) => {
        console.log('Welcome selection:', scenario)
        
        const updates: Partial<BookingState> = {
            bookingScenario: scenario,
        }

        switch (scenario) {
            case 'self':
                updates.communicationPreferences = {
                    sendToPatient: true,
                    sendToCaseManager: false,
                    patientHasEmail: true
                }
                break
            case 'referral':
                updates.communicationPreferences = {
                    sendToPatient: true,
                    sendToCaseManager: false,
                    patientHasEmail: true
                }
                break
            case 'case-manager':
                updates.communicationPreferences = {
                    sendToPatient: false,
                    sendToCaseManager: true,
                    patientHasEmail: false
                }
                break
        }

        updateState(updates)
        goToStep('payer-search')
    }

    const handlePayerSelected = (payer: Payer, acceptanceStatus: BookingState['payerAcceptanceStatus']) => {
        console.log('Payer selected:', payer.name, 'Status:', acceptanceStatus)
        
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
        console.log('Time slot selected:', timeSlot)
        updateState({ selectedTimeSlot: timeSlot })
        goToStep('insurance-info')
    }

    const handleInsuranceInfoSubmitted = (insuranceInfo: InsuranceInfo) => {
        updateState({ insuranceInfo })
        goToStep('roi')
    }

    const handleROISubmitted = (roiContacts: ROIContact[]) => {
        updateState({ roiContacts })
        goToStep('confirmation')
    }

    const handleBackToInsurance = () => {
        goToStep('payer-search')
    }

    const handleBackToCalendar = () => {
        goToStep('calendar')
    }

    const handleBackToWelcome = () => {
        goToStep('welcome')
    }

    const renderCurrentView = () => {
        switch (state.step) {
            case 'welcome':
                return (
                    <WelcomeView
                        onSelection={handleWelcomeSelection}
                    />
                )

            case 'payer-search':
                return (
                    <PayerSearchView
                        onPayerSelected={handlePayerSelected}
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
                        bookingScenario={state.bookingScenario}
                        onLeadSubmitted={() => goToStep('confirmation')}
                        onBackToPayers={handleBackToInsurance}
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
                        bookingScenario={state.bookingScenario}
                        onLeadSubmitted={() => goToStep('confirmation')}
                        onBackToPayers={handleBackToInsurance}
                    />
                )

            case 'calendar':
                if (!state.selectedPayer) {
                    return (
                        <div className="min-h-screen flex items-center justify-center bg-stone-50">
                            <div className="text-center space-y-4">
                                <p className="text-stone-600">Please select your insurance first.</p>
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
                    />
                )

            case 'insurance-info':
                if (!state.selectedPayer || !state.selectedTimeSlot) {
                    return (
                        <div className="min-h-screen flex items-center justify-center bg-stone-50">
                            <div className="text-center space-y-4">
                                <p className="text-stone-600">Appointment information missing.</p>
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
                        selectedPayer={state.selectedPayer}
                        selectedTimeSlot={state.selectedTimeSlot}
                        bookingScenario={state.bookingScenario}
                        caseManagerInfo={state.caseManagerInfo}
                        communicationPreferences={state.communicationPreferences!}
                        onSubmit={handleInsuranceInfoSubmitted}
                        onBack={handleBackToCalendar}
                    />
                )

            case 'roi':
                return (
                    <ROIView
                        patientInfo={state.patientInfo}
                        bookingScenario={state.bookingScenario}
                        caseManagerInfo={state.caseManagerInfo}
                        onSubmit={handleROISubmitted}
                        onBack={() => goToStep('insurance-info')}
                    />
                )

            case 'confirmation':
                return (
                    <ConfirmationView
                        appointmentId={state.appointmentId}
                        patientInfo={state.patientInfo}
                        selectedTimeSlot={state.selectedTimeSlot}
                        bookingScenario={state.bookingScenario}
                        caseManagerInfo={state.caseManagerInfo}
                        communicationPreferences={state.communicationPreferences}
                        onStartOver={() => {
                            setState({
                                step: 'welcome',
                                bookingScenario: 'self',
                                roiContacts: [],
                                communicationPreferences: {
                                    sendToPatient: true,
                                    sendToCaseManager: false,
                                    patientHasEmail: true
                                }
                            })
                        }}
                    />
                )

            default:
                return (
                    <div className="min-h-screen flex items-center justify-center bg-stone-50">
                        <div className="text-center space-y-4">
                            <p className="text-stone-600">Something went wrong.</p>
                            <button 
                                onClick={handleBackToWelcome}
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
            {renderCurrentView()}
        </div>
    )
}