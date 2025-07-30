// src/components/booking/views/ConfirmationView.tsx
'use client'

import { Payer, TimeSlot, PatientInfo } from '@/types/database'

interface ConfirmationViewProps {
    appointment: {
        payer?: Payer
        timeSlot?: TimeSlot
        patientInfo?: PatientInfo
        appointmentId?: string
    }
    onStartOver: () => void
}

export default function ConfirmationView({ appointment, onStartOver }: ConfirmationViewProps) {
    const { payer, timeSlot, appointmentId } = appointment

    return (
        <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-normal text-slate-800 mb-8">
                    Thank you for booking with Moonlit
                </h2>

                <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
                    <h3 className="text-lg font-medium text-slate-800 mb-4">
                        Your appointment is confirmed!
                    </h3>

                    {timeSlot && (
                        <div className="space-y-2 text-slate-700">
                            <p>
                                <strong>Date & Time:</strong> {new Date(timeSlot.start_time).toLocaleDateString()}
                                at {new Date(timeSlot.start_time).toLocaleTimeString()}
                            </p>
                            <p>
                                <strong>Duration:</strong> 60 minutes
                            </p>
                            <p>
                                <strong>Type:</strong> Video appointment
                            </p>
                            {payer && (
                                <p>
                                    <strong>Insurance:</strong> {payer.name}
                                </p>
                            )}
                            {appointmentId && (
                                <p>
                                    <strong>Confirmation #:</strong> {appointmentId}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div className="space-y-4 text-slate-600">
                    <p>
                        You'll receive a confirmation email with appointment details and
                        instructions for joining your video session.
                    </p>
                    <p>
                        If you need to reschedule or have questions, please contact our office
                        at least 24 hours before your appointment.
                    </p>
                </div>

                <div className="mt-8">
                    <button
                        onClick={onStartOver}
                        className="btn-secondary"
                    >
                        Book Another Appointment
                    </button>
                </div>
            </div>
        </div>
    )
}