// src/components/booking/BookingFlow.tsx
'use client'

import { useState } from 'react'
import { Payer, TimeSlot, PatientInfo, InsuranceInfo, ROIContact } from '@/types/database'

// Import components with new WelcomeView
import WelcomeView, { BookingScenario } from './views/WelcomeView'
import PayerSearchView from './views/PayerSearchView'
import CalendarView from './views/CalendarView'
import InsuranceNotAcceptedView from './views/InsuranceNotAcceptedView'
import InsuranceFutureView from './views/InsuranceFutureView'
import InsuranceInfoView from './views/InsuranceInfoView'
import ROIView from './views/ROIView'
import ConfirmationView from './views/ConfirmationView'

// Enhanced booking steps
type BookingStep =
    | 'welcome'
    | 'payer-search'
    | 'insurance-not-accepted'
    | 'insurance-future'
    | 'calendar'
    | 'insurance-info'
    | 'roi'
    | 'confirmation'

// Enhanced booking state with case manager support
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

    // New case manager fields
    caseManagerInfo?: {
        name: string
        email: string
        phone?: string
        organization?: string
    }

    // Enhanced communication preferences
    communicationPreferences?: {
        sendToPatient: boolean  // Only if patient has email
        sendToCaseManager: boolean  // For case manager scenarios
        patientHasEmail: boolean  // Track if patient has email access
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

    // Enhanced welcome handler for three scenarios
    const handleWelcomeSelection = (scenario: BookingScenario) => {
        const updates: Partial<BookingState> = {
            bookingScenario: scenario,
        }

        // Set up communication preferences based on scenario
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
                    patientHasEmail: true // Assume yes, but can be changed later
                }
                break
            case 'case-manager':
                updates.communicationPreferences = {
                    sendToPatient: false, // Start with case manager only
                    sendToCaseManager: true,
                    patientHasEmail: false // Assume no, but can be changed later
                }
                break
        }

        updateState(updates)
        goToStep('payer-search')
    }

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

    const handleInsuranceInfoSubmitted = (insuranceInfo: InsuranceInfo) => {
        updateState({ insuranceInfo })
        goToStep('roi')
    }

    const handleROISubmitted = (roiContacts: ROIContact[]) => {
        updateState({ roiContacts })
        // TODO: Create appointment and send to confirmation
        goToStep('confirmation')
    }

    const handleLeadSubmitted = (leadData: any) => {
        // Handle lead submission for unaccepted insurance
        console.log('Lead submitted:', leadData)
        goToStep('confirmation')
    }

    // Render appropriate view based on current step
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
                    />
                )

            case 'insurance-not-accepted':
                return (
                    <InsuranceNotAcceptedView
                        selectedPayer={state.selectedPayer!}
                        bookingScenario={state.bookingScenario}
                        onLeadSubmitted={handleLeadSubmitted}
                        onBack={() => goToStep('payer-search')}
                    />
                )

            case 'insurance-future':
                return (
                    <InsuranceFutureView
                        selectedPayer={state.selectedPayer!}
                        bookingScenario={state.bookingScenario}
                        onLeadSubmitted={handleLeadSubmitted}
                        onBack={() => goToStep('payer-search')}
                    />
                )

            case 'calendar':
                return (
                    <CalendarView
                        selectedPayer={state.selectedPayer!}
                        bookingScenario={state.bookingScenario}
                        onTimeSlotSelected={handleTimeSlotSelected}
                        onBack={() => goToStep('payer-search')}
                    />
                )

            case 'insurance-info':
                return (
                    <InsuranceInfoView
                        selectedPayer={state.selectedPayer!}
                        selectedTimeSlot={state.selectedTimeSlot!}
                        bookingScenario={state.bookingScenario}
                        caseManagerInfo={state.caseManagerInfo}
                        communicationPreferences={state.communicationPreferences!}
                        onSubmit={handleInsuranceInfoSubmitted}
                        onUpdateCaseManager={(caseManagerInfo) => updateState({ caseManagerInfo })}
                        onUpdateCommunicationPrefs={(prefs) => updateState({
                            communicationPreferences: { ...state.communicationPreferences, ...prefs }
                        })}
                        onBack={() => goToStep('calendar')}
                    />
                )

            case 'roi':
                return (
                    <ROIView
                        patientInfo={state.patientInfo!}
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
                return <div>Unknown step</div>
        }
    }

    return (
        <div className="min-h-screen">
            {renderCurrentView()}
        </div>
    )
}