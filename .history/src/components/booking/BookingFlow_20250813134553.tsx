'use client'

import { InsuranceInfo, Payer, ROIContact, TimeSlot } from '@/types/database'
import { useCallback, useMemo, useState } from 'react'

import BookingProgress, { BookingStep } from './BookingProgress'
import CalendarView from './views/CalendarView'
import ConfirmationView from './views/ConfirmationView'
import InsuranceFutureView from './views/InsuranceFutureView'
import InsuranceInfoView from './views/InsuranceInfoView'
import InsuranceNotAcceptedView from './views/InsuranceNotAcceptedView'
import PayerSearchView from './views/PayerSearchView'
import ROIView from './views/ROIView'
import WaitlistConfirmationView from './views/WaitlistConfirmationView'
import WelcomeView, { BookingScenario } from './views/WelcomeView'

type FlowStep = BookingStep

type FlowState = {
    step: FlowStep
    bookingScenario: BookingScenario
    selectedPayer?: Payer
    acceptanceStatus?: 'not-accepted' | 'future' | 'active'
    selectedTimeSlot?: TimeSlot
    insuranceInfo?: InsuranceInfo
    roiContacts: ROIContact[]
    appointmentId?: string
    caseManagerInfo?: {
        name: string
        email: string
        phone?: string
        organization?: string
    }
}

export default function BookingFlow() {
    const [state, setState] = useState<FlowState>({
        step: 'welcome',
        bookingScenario: 'self',
        roiContacts: [],
    })

    // ---- Handlers

    const goTo = (step: FlowStep) => setState((s) => ({ ...s, step }))

    const handleWelcomeSelection = (scenario: BookingScenario) => {
        setState((s) => ({ ...s, bookingScenario: scenario, step: 'payer-search' }))
    }

    const handlePayerSelected = (payer: Payer, acceptanceStatus: 'not-accepted' | 'future' | 'active') => {
        if (acceptanceStatus === 'not-accepted') {
            setState((s) => ({ ...s, selectedPayer: payer, acceptanceStatus, step: 'insurance-not-accepted' }))
            return
        }
        if (acceptanceStatus === 'future') {
            setState((s) => ({ ...s, selectedPayer: payer, acceptanceStatus, step: 'insurance-future' }))
            return
        }
        setState((s) => ({ ...s, selectedPayer: payer, acceptanceStatus, step: 'calendar' }))
    }

    const handleBackToPayers = () => goTo('payer-search')

    const handleCashPayFromNotice = () => {
        const cash: any = {
            id: 'cash-pay',
            name: 'Cash Pay',
            display_name: 'Cash / Self-Pay',
            effective_date: new Date().toISOString(),
            requires_individual_contract: false,
        }
        setState((s) => ({ ...s, selectedPayer: cash, acceptanceStatus: 'active', step: 'calendar' }))
    }

    const handleTimeSlotSelected = (slot: TimeSlot) => {
        setState((s) => ({ ...s, selectedTimeSlot: slot, step: 'insurance-info' }))
    }

    const handleInsuranceInfoSubmit = (info: any) => {
        setState((s) => ({ ...s, insuranceInfo: info, step: 'roi' }))
    }

    const handleROIComplete = async (contacts: ROIContact[], maybeCaseManager?: FlowState['caseManagerInfo']) => {
        setState((s) => ({ ...s, roiContacts: contacts, caseManagerInfo: maybeCaseManager }))
        await createAppointment(contacts)
    }

    const createAppointment = useCallback(
        async (roiContacts: ROIContact[]) => {
            try {
                if (!state.selectedTimeSlot || !state.selectedPayer || !state.insuranceInfo) {
                    // If something’s missing, allow user to still see confirmation screen gracefully
                    setState((s) => ({ ...s, step: 'confirmation' }))
                    return
                }

                const res = await fetch('/api/patient-booking/create-appointment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        provider_id: (state.selectedTimeSlot as any).provider_id,
                        service_instance_id: (state.selectedTimeSlot as any).service_instance_id,
                        payer_id: (state.selectedPayer as any).id,
                        start_time: (state.selectedTimeSlot as any).start_time, // ISO
                        timezone: 'America/Denver',
                        patient_info: {
                            first_name: (state.insuranceInfo as any).firstName,
                            last_name: (state.insuranceInfo as any).lastName,
                            date_of_birth: (state.insuranceInfo as any).dateOfBirth,
                            phone: (state.insuranceInfo as any).phone,
                            email: (state.insuranceInfo as any).email,
                        },
                        insurance_info: {
                            payer_name: (state.selectedPayer as any).name,
                            member_id: (state.insuranceInfo as any).memberId,
                            group_number: (state.insuranceInfo as any).groupNumber,
                        },
                        roi_contacts: roiContacts,
                    }),
                })

                if (!res.ok) {
                    // Non-blocking: still show confirmation but without ID
                    console.error('Appointment create failed:', await res.text())
                    setState((s) => ({ ...s, step: 'confirmation' }))
                    return
                }

                const json = await res.json()
                setState((s) => ({ ...s, appointmentId: json?.appointment_id, step: 'confirmation' }))
            } catch (err) {
                console.error(err)
                setState((s) => ({ ...s, step: 'confirmation' }))
            }
        },
        [state.selectedPayer, state.selectedTimeSlot, state.insuranceInfo]
    )

    const handleRestart = () =>
        setState({
            step: 'welcome',
            bookingScenario: 'self',
            roiContacts: [],
        })

    // ---- Render

    const content = useMemo(() => {
        switch (state.step) {
            case 'welcome':
                return <WelcomeView onSelection={handleWelcomeSelection} />

            case 'payer-search':
                return (
                    <PayerSearchView
                        bookingScenario={state.bookingScenario}
                        onPayerSelected={handlePayerSelected}
                    />
                )

            case 'insurance-not-accepted':
                return (
                    <InsuranceNotAcceptedView
                        selectedPayer={state.selectedPayer as Payer}
                        onBackToPayers={handleBackToPayers}
                        onCashPay={handleCashPayFromNotice}
                    />
                )

            case 'insurance-future':
                return (
                    <InsuranceFutureView
                        selectedPayer={state.selectedPayer as Payer}
                        onBackToPayers={handleBackToPayers}
                        onCashPay={handleCashPayFromNotice}
                    />
                )

            case 'calendar':
                return (
                    <CalendarView
                        selectedPayer={state.selectedPayer}
                        onTimeSlotSelected={handleTimeSlotSelected}
                        onBackToInsurance={handleBackToPayers}
                    />
                )

            case 'insurance-info':
                return (
                    <InsuranceInfoView
                        selectedPayer={state.selectedPayer as Payer}
                        selectedTimeSlot={state.selectedTimeSlot as TimeSlot}
                        bookingScenario={state.bookingScenario}
                        onSubmit={handleInsuranceInfoSubmit}
                        onBack={() => goTo('calendar')}
                    />
                )

            case 'roi':
                return (
                    <ROIView
                        bookingScenario={state.bookingScenario}
                        onBack={() => goTo('insurance-info')}
                        onComplete={(contacts, cm) => handleROIComplete(contacts, cm)}
                    />
                )

            case 'waitlist-confirmation':
                return <WaitlistConfirmationView />

            case 'confirmation':
            default:
                return (
                    <ConfirmationView
                        appointmentId={state.appointmentId}
                        patientInfo={state.insuranceInfo as any}
                        selectedTimeSlot={state.selectedTimeSlot as any}
                        bookingScenario={state.bookingScenario}
                        caseManagerInfo={state.caseManagerInfo}
                        onRestart={handleRestart}
                    />
                )
        }
    }, [state.step, state.bookingScenario, state.selectedPayer, state.selectedTimeSlot, state.insuranceInfo, state.appointmentId, state.caseManagerInfo])

    return (
        <div className="min-h-screen">
            {/* Progress bar appears across steps (hidden on welcome for less clutter) */}
            {state.step !== 'welcome' && (
                <div className="max-w-5xl mx-auto px-4 pt-6">
                    <BookingProgress current={state.step} />
                </div>
            )}
            {content}
        </div>
    )
}
