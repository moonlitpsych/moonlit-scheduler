'use client'

import { InsuranceInfo, PatientInfo, Payer, ROIContact, TimeSlot } from '@/types/database'
import { useState } from 'react'

import CalendarView from './views/CalendarView'
import ConfirmationView from './views/ConfirmationView'
import InsuranceFutureView from './views/InsuranceFutureView'
import InsuranceInfoView from './views/InsuranceInfoView'
import InsuranceNotAcceptedView from './views/InsuranceNotAcceptedView'
import PayerSearchView from './views/PayerSearchView'
import ProviderSelectionView from './views/ProviderSelectionView.tsx'; // NEW: Individual provider selection
import ROIView from './views/ROIView'
import WelcomeView, { BookingScenario } from './views/WelcomeView'

type BookingStep =
    | 'welcome'
    | 'payer-search'
    | 'insurance-not-accepted'
    | 'insurance-future'
    | 'calendar'
    | 'provider-selection'     // NEW: Individual provider selection step
    | 'insurance-info'
    | 'roi'
    | 'confirmation'

type CalendarViewMode = 'merged' | 'individual' // NEW: Calendar display modes

interface BookingState {
    step: BookingStep
    bookingScenario: BookingScenario
    selectedPayer?: Payer
    payerAcceptanceStatus?: 'not-accepted' | 'future' | 'active'
    selectedTimeSlot?: TimeSlot
    selectedProviderId?: string // NEW: For individual provider selection
    calendarViewMode: CalendarViewMode // NEW: Track calendar view preference
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
    // NEW: Navigation history for easy back navigation
    navigationHistory: BookingStep[]
}

export default function BookingFlow() {
    const [state, setState] = useState<BookingState>({
        step: 'welcome',
        bookingScenario: 'self',
        calendarViewMode: 'merged', // Default to merged view
        roiContacts: [],
        navigationHistory: [], // Track navigation for back button
        communicationPreferences: {
            sendToPatient: true,
            sendToCaseManager: false,
            patientHasEmail: true
        }
    })

    const updateState = (updates: Partial<BookingState>) => {
        setState(prev => ({ ...prev, ...updates }))
    }

    // Enhanced navigation with history tracking
    const goToStep = (step: BookingStep, addToHistory: boolean = true) => {
        setState(prev => ({
            ...prev,
            step,
            navigationHistory: addToHistory 
                ? [...prev.navigationHistory, prev.step]
                : prev.navigationHistory
        }))
    }

    // NEW: Enhanced back navigation using history
    const goBack = () => {
        setState(prev => {
            const history = [...prev.navigationHistory]
            const previousStep = history.pop()
            
            if (previousStep) {
                return {
                    ...prev,
                    step: previousStep,
                    navigationHistory: history
                }
            }
            
            // Fallback to logical previous step
            return prev
        })
    }

    // NEW: Reset to any step (for "change selection" functionality)
    const resetToStep = (step: BookingStep) => {
        setState(prev => ({
            ...prev,
            step,
            // Clear related data when going back to certain steps
            ...(step === 'payer-search' && {
                selectedPayer: undefined,
                payerAcceptanceStatus: undefined,
                selectedTimeSlot: undefined,
                selectedProviderId: undefined
            }),
            ...(step === 'calendar' && {
                selectedTimeSlot: undefined,
                selectedProviderId: undefined
            }),
            navigationHistory: [] // Reset navigation history
        }))
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

    // NEW: Handle calendar view mode toggle
    const handleCalendarViewModeChange = (mode: CalendarViewMode) => {
        if (mode === 'individual') {
            updateState({ calendarViewMode: mode })
            goToStep('provider-selection', false) // Don't add to history since it's a view change
        } else {
            updateState({ 
                calendarViewMode: mode,
                selectedProviderId: undefined // Clear provider selection in merged mode
            })
            goToStep('calendar', false)
        }
    }

    // NEW: Handle individual provider selection
    const handleProviderSelected = (providerId: string) => {
        updateState({ 
            selectedProviderId: providerId,
            calendarViewMode: 'individual'
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

    const handleROISubmitted = (roiContacts: ROIContact[]) => {
        updateState({ roiContacts })
        goToStep('confirmation')
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
                        onBack={() => goBack()}
                    />
                )

            case 'insurance-not-accepted':
                if (!state.selectedPayer) {
                    return (
                        <div className="min-h-screen flex items-center justify-center">
                            <button 
                                type="button"
                                onClick={() => resetToStep('welcome')} 
                                className="px-6 py-3 bg-[#BF9C73] text-white rounded-xl"
                            >
                                Start Over
                            </button>
                        </div>
                    )
                }
                return (
                    <InsuranceNotAcceptedView
                        selectedPayer={state.selectedPayer}
                        bookingScenario={state.bookingScenario}
                        onLeadSubmitted={() => goToStep('confirmation')}
                        onBackToPayers={() => resetToStep('payer-search')}
                    />
                )

            case 'insurance-future':
                if (!state.selectedPayer) {
                    return (
                        <div className="min-h-screen flex items-center justify-center">
                            <button 
                                type="button"
                                onClick={() => resetToStep('welcome')} 
                                className="px-6 py-3 bg-[#BF9C73] text-white rounded-xl"
                            >
                                Start Over
                            </button>
                        </div>
                    )
                }
                return (
                    <InsuranceFutureView
                        selectedPayer={state.selectedPayer}
                        bookingScenario={state.bookingScenario}
                        onLeadSubmitted={() => goToStep('confirmation')}
                        onBackToPayers={() => resetToStep('payer-search')}
                    />
                )

            case 'provider-selection':
                if (!state.selectedPayer) {
                    return (
                        <div className="min-h-screen flex items-center justify-center">
                            <button 
                                type="button"
                                onClick={() => resetToStep('welcome')} 
                                className="px-6 py-3 bg-[#BF9C73] text-white rounded-xl"
                            >
                                Start Over
                            </button>
                        </div>
                    )
                }
                return (
                    <ProviderSelectionView
                        selectedPayer={state.selectedPayer}
                        onProviderSelected={handleProviderSelected}
                        onBackToMergedCalendar={() => handleCalendarViewModeChange('merged')}
                        onBack={() => goBack()}
                    />
                )

            case 'calendar':
                if (!state.selectedPayer) {
                    return (
                        <div className="min-h-screen flex items-center justify-center">
                            <button 
                                type="button"
                                onClick={() => resetToStep('welcome')} 
                                className="px-6 py-3 bg-[#BF9C73] text-white rounded-xl"
                            >
                                Start Over
                            </button>
                        </div>
                    )
                }
                return (
                    <CalendarView
                        selectedPayer={state.selectedPayer}
                        selectedProviderId={state.selectedProviderId} // Pass provider ID for individual view
                        calendarViewMode={state.calendarViewMode}
                        onTimeSlotSelected={handleTimeSlotSelected}
                        onViewModeChange={handleCalendarViewModeChange} // NEW: Allow toggling view modes
                        onBackToInsurance={() => resetToStep('payer-search')}
                        onChangeProvider={() => resetToStep('provider-selection')} // NEW: Easy provider change
                    />
                )

            case 'insurance-info':
                if (!state.selectedPayer || !state.selectedTimeSlot) {
                    return (
                        <div className="min-h-screen flex items-center justify-center">
                            <button 
                                type="button"
                                onClick={() => resetToStep('welcome')} 
                                className="px-6 py-3 bg-[#BF9C73] text-white rounded-xl"
                            >
                                Start Over
                            </button>
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
                        onBack={() => goBack()}
                        onChangeAppointment={() => resetToStep('calendar')} // NEW: Easy appointment change
                        onChangeInsurance={() => resetToStep('payer-search')} // NEW: Easy insurance change
                    />
                )

            case 'roi':
                return (
                    <ROIView
                        patientInfo={state.patientInfo}
                        bookingScenario={state.bookingScenario}
                        caseManagerInfo={state.caseManagerInfo}
                        onSubmit={handleROISubmitted}
                        onBack={() => goBack()}
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
                                calendarViewMode: 'merged',
                                roiContacts: [],
                                navigationHistory: [],
                                communicationPreferences: {
                                    sendToPatient: true,
                                    sendToCaseManager: false,
                                    patientHasEmail: true
                                }
                            })
                        }}
                        // NEW: Quick action buttons for confirmation screen
                        onChangeAppointment={() => resetToStep('calendar')}
                        onChangeInsurance={() => resetToStep('payer-search')}
                    />
                )

            default:
                return (
                    <div className="min-h-screen flex items-center justify-center">
                        <button 
                            type="button"
                            onClick={() => resetToStep('welcome')} 
                            className="px-6 py-3 bg-[#BF9C73] text-white rounded-xl"
                        >
                            Start Over
                        </button>
                    </div>
                )
        }
    }

    return (
        <div className="min-h-screen">
            {/* NEW: Breadcrumb navigation for user confidence */}
            {state.step !== 'welcome' && state.step !== 'confirmation' && (
                <div className="bg-gray-50 px-4 py-2 border-b">
                    <div className="max-w-2xl mx-auto flex items-center gap-2 text-sm text-gray-600">
                        <button
                            type="button"
                            onClick={() => resetToStep('welcome')}
                            className="hover:text-[#BF9C73] transition-colors"
                        >
                            Start
                        </button>
                        {state.selectedPayer && (
                            <>
                                <span>→</span>
                                <button
                                    type="button"
                                    onClick={() => resetToStep('payer-search')}
                                    className="hover:text-[#BF9C73] transition-colors"
                                >
                                    {state.selectedPayer.name}
                                </button>
                            </>
                        )}
                        {state.selectedTimeSlot && (
                            <>
                                <span>→</span>
                                <button
                                    type="button"
                                    onClick={() => resetToStep('calendar')}
                                    className="hover:text-[#BF9C73] transition-colors"
                                >
                                    Appointment Selected
                                </button>
                            </>
                        )}
                        <span className="text-[#BF9C73] font-medium ml-auto">
                            You can change any of these selections anytime
                        </span>
                    </div>
                </div>
            )}
            
            {renderCurrentView()}
        </div>
    )
}