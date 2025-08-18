// src/components/booking/BookingFlow.tsx
'use client'

import { InsuranceInfo, PatientInfo, Payer, ROIContact, TimeSlot } from '@/types/database'
import { useState } from 'react'
import CalendarView from './views/CalendarView'
import ConfirmationView from './views/ConfirmationView'
import InsuranceFutureView from './views/InsuranceFutureView'
import InsuranceInfoView from './views/InsuranceInfoView'
import InsuranceNotAcceptedView from './views/InsuranceNotAcceptedView'
import PayerSearchView from './views/PayerSearchView'
import ProviderSelectionView from './views/ProviderSelectionView'
import ROIView from './views/ROIView'
import WelcomeView from './views/WelcomeView'

export type BookingScenario = 'self' | 'referral' | 'case-manager'
export type BookingStep = 
    | 'welcome'
    | 'payer-search'
    | 'insurance-not-accepted'
    | 'insurance-future'
    | 'calendar'
    | 'provider-selection'
    | 'insurance-info'
    | 'roi'
    | 'confirmation'

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

interface BookingState {
    step: BookingStep
    bookingScenario: BookingScenario
    selectedPayer?: Payer
    payerAcceptanceStatus?: 'not-accepted' | 'future' | 'active'
    bookingMode?: 'normal' | 'provider-first'
    selectedProvider?: any
    selectedTimeSlot?: TimeSlot
    patientInfo?: PatientInfo
    insuranceInfo?: InsuranceInfo
    roiContacts: ROIContact[]
    caseManagerInfo?: CaseManagerInfo
    communicationPreferences?: CommunicationPreferences
    appointmentId?: string
    appointmentData?: any
    isCreating?: boolean
    error?: string
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

    // Navigation handlers
    const handleWelcomeSelection = (scenario: BookingScenario) => {
        let updates: Partial<BookingState> = { bookingScenario: scenario }

        // Set initial communication preferences based on scenario
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

    const handleProviderModeSelected = () => {
        updateState({ bookingMode: 'provider-first' })
        goToStep('provider-selection')
    }

    const handleProviderSelected = (provider: any) => {
        updateState({ selectedProvider: provider })
        goToStep('calendar')
    }

    const handleInsuranceInfoSubmitted = (patientInfo: PatientInfo, insuranceInfo?: InsuranceInfo) => {
        updateState({ patientInfo, insuranceInfo })
        goToStep('roi')
    }

    const handleROISubmitted = async (roiContacts: ROIContact[]) => {
        updateState({ roiContacts, isCreating: true, error: undefined })

        try {
            console.log('🚀 Creating appointment with data:', {
                provider: state.selectedProvider,
                timeSlot: state.selectedTimeSlot,
                payer: state.selectedPayer,
                patientInfo: state.patientInfo,
                roiContacts
            })

            // **FIXED**: Actually create the appointment!
            const response = await fetch('/api/patient-booking/create-appointment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    provider_id: state.selectedProvider?.id || state.selectedTimeSlot?.provider_id,
                    payer_id: state.selectedPayer?.id,
                    time_slot: state.selectedTimeSlot,
                    patient_info: state.patientInfo,
                    insurance_info: state.insuranceInfo,
                    roi_contacts: roiContacts,
                    booking_scenario: state.bookingScenario,
                    case_manager_info: state.caseManagerInfo,
                    communication_preferences: state.communicationPreferences
                })
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to create appointment')
            }

            const appointmentResult = await response.json()
            console.log('✅ Appointment created successfully:', appointmentResult)

            updateState({ 
                appointmentId: appointmentResult.appointment.id,
                appointmentData: appointmentResult.appointment,
                isCreating: false 
            })
            
            goToStep('confirmation')

        } catch (error) {
            console.error('❌ Error creating appointment:', error)
            updateState({ 
                error: error instanceof Error ? error.message : 'Failed to create appointment',
                isCreating: false 
            })
        }
    }

    const handleLeadSubmitted = (leadData: any) => {
        console.log('Lead submitted:', leadData)
        goToStep('confirmation')
    }

    const handleStartOver = () => {
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
    }

    // Render appropriate view based on current step
    const renderCurrentView = () => {
        // Show error state if there's an error
        if (state.error) {
            return (
                <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/30 to-[#FEF8F1] flex items-center justify-center px-4">
                    <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-red-600 text-2xl">⚠️</span>
                        </div>
                        <h2 className="text-xl font-semibold text-[#091747] mb-4 font-['Newsreader']">
                            Booking Error
                        </h2>
                        <p className="text-[#091747]/70 mb-6 font-['Newsreader']">
                            {state.error}
                        </p>
                        <button
                            onClick={() => updateState({ error: undefined })}
                            className="w-full bg-[#BF9C73] text-white py-3 px-6 rounded-xl font-medium hover:bg-[#BF9C73]/90 transition-colors font-['Newsreader']"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            )
        }

        // Show loading state during appointment creation
        if (state.isCreating) {
            return (
                <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/30 to-[#FEF8F1] flex items-center justify-center px-4">
                    <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 text-center">
                        <div className="w-16 h-16 bg-[#BF9C73]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <div className="w-8 h-8 border-4 border-[#BF9C73] border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <h2 className="text-xl font-semibold text-[#091747] mb-4 font-['Newsreader']">
                            Creating Your Appointment
                        </h2>
                        <p className="text-[#091747]/70 font-['Newsreader']">
                            Please wait while we confirm your appointment details...
                        </p>
                    </div>
                </div>
            )
        }

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
                        onCashPayment={handleCashPaymentSelected}
                        bookingScenario={state.bookingScenario}
                    />
                )

            case 'insurance-not-accepted':
                return (
                    <InsuranceNotAcceptedView
                        selectedPayer={state.selectedPayer!}
                        onLeadSubmitted={handleLeadSubmitted}
                        onCashPayment={handleCashPaymentSelected}
                    />
                )

            case 'insurance-future':
                return (
                    <InsuranceFutureView
                        selectedPayer={state.selectedPayer!}
                        onWaitForEffectiveDate={() => goToStep('confirmation')}
                        onCashPayment={handleCashPaymentSelected}
                    />
                )

            case 'calendar':
                return (
                    <CalendarView
                        payer={state.selectedPayer}
                        selectedProvider={state.selectedProvider}
                        onTimeSlotSelected={handleTimeSlotSelected}
                        onProviderModeSelected={handleProviderModeSelected}
                    />
                )

            case 'provider-selection':
                return (
                    <ProviderSelectionView
                        payer={state.selectedPayer!}
                        onProviderSelected={handleProviderSelected}
                        onBack={() => goToStep('calendar')}
                    />
                )

            case 'insurance-info':
                return (
                    <InsuranceInfoView
                        selectedPayer={state.selectedPayer}
                        selectedTimeSlot={state.selectedTimeSlot}
                        bookingScenario={state.bookingScenario}
                        onSubmit={handleInsuranceInfoSubmitted}
                        onBack={() => goToStep('calendar')}
                    />
                )

            case 'roi':
                return (
                    <ROIView
                        selectedTimeSlot={state.selectedTimeSlot}
                        patientInfo={state.patientInfo}
                        bookingScenario={state.bookingScenario}
                        caseManagerInfo={state.caseManagerInfo}
                        communicationPreferences={state.communicationPreferences}
                        onSubmit={handleROISubmitted}
                        onBack={() => goToStep('insurance-info')}
                    />
                )

            case 'confirmation':
                return (
                    <ConfirmationView
                        appointmentId={state.appointmentId}
                        appointmentData={state.appointmentData}
                        patientInfo={state.patientInfo}
                        selectedTimeSlot={state.selectedTimeSlot}
                        selectedProvider={state.selectedProvider}
                        selectedPayer={state.selectedPayer}
                        bookingScenario={state.bookingScenario}
                        caseManagerInfo={state.caseManagerInfo}
                        communicationPreferences={state.communicationPreferences}
                        onStartOver={handleStartOver}
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