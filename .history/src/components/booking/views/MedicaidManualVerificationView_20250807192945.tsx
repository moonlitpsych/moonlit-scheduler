// src/components/booking/views/MedicaidManualVerificationView.tsx
'use client'

import { createClient } from '@supabase/supabase-js'
import { AlertCircle, CheckCircle, Phone, Shield, User } from 'lucide-react'
import { useEffect, useState } from 'react'

// Initialize Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface MedicaidManualVerificationViewProps {
    patientInfo?: {
        firstName?: string
        lastName?: string
        dob?: string
        email?: string
        phone?: string
    }
    onVerificationComplete: (result: any) => void
    onBack: () => void
}

export default function MedicaidManualVerificationView({
    patientInfo,
    onVerificationComplete,
    onBack
}: MedicaidManualVerificationViewProps) {
    const [isStaff, setIsStaff] = useState(false)
    const [loading, setLoading] = useState(true)
    const [overrideReason, setOverrideReason] = useState('')
    const [selectedPlan, setSelectedPlan] = useState('')
    const [showOverrideForm, setShowOverrideForm] = useState(false)
    const [currentUser, setCurrentUser] = useState<any>(null)

    // Accepted Medicaid plans
    const acceptedPlans = [
        { value: 'FFS', label: 'Fee-for-Service (FFS)' },
        { value: 'UUHP', label: 'University of Utah Health Plans (UUHP)' },
        { value: 'OPTUM', label: 'Optum' },
        { value: 'MOLINA', label: 'Molina Healthcare' }
    ]

    // Check if current user is staff
    useEffect(() => {
        checkStaffStatus()
    }, [])

    const checkStaffStatus = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()

            if (user) {
                setCurrentUser(user)
                // Check if user email is staff (Miriam or Dr. Rufus Sweeney)
                const staffEmails = [
                    'hello@trymoonlit.com',
                    'miriam@trymoonlit.com',
                    'rufus@trymoonlit.com',
                    'dr.sweeney@trymoonlit.com'
                ]

                if (staffEmails.includes(user.email?.toLowerCase() || '')) {
                    setIsStaff(true)
                }
            }
        } catch (error) {
            console.error('Error checking staff status:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleStaffOverride = async () => {
        if (!selectedPlan || !overrideReason) {
            alert('Please select a plan and provide a reason for override')
            return
        }

        try {
            // Log the manual verification
            const { error } = await supabase.from('eligibility_log').insert({
                patient_first_name: patientInfo?.firstName,
                patient_last_name: patientInfo?.lastName,
                patient_dob: patientInfo?.dob,
                result: {
                    manualOverride: true,
                    overrideBy: currentUser?.email,
                    overrideReason: overrideReason,
                    selectedPlan: selectedPlan
                },
                is_enrolled: true,
                current_plan: selectedPlan,
                is_plan_accepted: true,
                performed_at: new Date().toISOString(),
                manual_override: true,
                override_by: currentUser?.email,
                override_reason: overrideReason
            })

            if (error) {
                console.error('Error logging override:', error)
            }

            // Create verification result
            const verificationResult = {
                enrolled: true,
                verified: true,
                manualOverride: true,
                currentPlan: acceptedPlans.find(p => p.value === selectedPlan)?.label,
                isAccepted: true,
                message: 'Manually verified by staff - patient has accepted Medicaid plan',
                overrideBy: currentUser?.email,
                overrideAt: new Date().toISOString()
            }

            // Pass result back to parent
            onVerificationComplete(verificationResult)

        } catch (error) {
            console.error('Error processing override:', error)
            alert('Error processing override. Please try again.')
        }
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-6">
                {/* Header */}
                <div className="flex items-center mb-6">
                    <div className="bg-yellow-100 p-3 rounded-full">
                        <AlertCircle className="h-8 w-8 text-yellow-600" />
                    </div>
                    <div className="ml-4">
                        <h2 className="text-2xl font-bold text-gray-800">
                            Medicaid Verification Required
                        </h2>
                        <p className="text-gray-600">Manual verification needed to proceed</p>
                    </div>
                </div>

                {/* Patient Information Display */}
                {patientInfo && (
                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                        <h3 className="font-semibold text-gray-700 mb-2 flex items-center">
                            <User className="h-5 w-5 mr-2" />
                            Patient Information
                        </h3>
                        <div className="space-y-1 text-sm text-gray-600">
                            <p>Name: {patientInfo.firstName} {patientInfo.lastName}</p>
                            <p>Date of Birth: {patientInfo.dob}</p>
                            {patientInfo.phone && <p>Phone: {patientInfo.phone}</p>}
                            {patientInfo.email && <p>Email: {patientInfo.email}</p>}
                        </div>
                    </div>
                )}

                {/* Main Message for Patients */}
                <div className="border-l-4 border-blue-500 bg-blue-50 p-4 mb-6">
                    <div className="flex">
                        <div className="ml-3">
                            <h3 className="text-lg font-semibold text-blue-800 mb-2">
                                Manual Verification Required
                            </h3>
                            <p className="text-blue-700 mb-3">
                                Utah Medicaid requires manual verification to ensure we accept your specific plan.
                            </p>
                            <div className="bg-white rounded-lg p-4 border border-blue-200">
                                <p className="font-semibold text-gray-800 mb-2">
                                    Please call our office to complete your booking:
                                </p>
                                <div className="flex items-center text-2xl font-bold text-blue-600">
                                    <Phone className="h-6 w-6 mr-2" />
                                    (801) 555-0100
                                </div>
                                <p className="text-sm text-gray-600 mt-2">
                                    Hours: Monday-Friday, 9am-5pm MST
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* What to Expect */}
                <div className="mb-6">
                    <h3 className="font-semibold text-gray-800 mb-3">What to Expect:</h3>
                    <ul className="space-y-2">
                        <li className="flex items-start">
                            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                            <span className="text-gray-600">
                                Our staff will verify your Medicaid plan in our system
                            </span>
                        </li>
                        <li className="flex items-start">
                            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                            <span className="text-gray-600">
                                We'll confirm if we accept your specific plan (FFS, UUHP, Optum, or Molina)
                            </span>
                        </li>
                        <li className="flex items-start">
                            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                            <span className="text-gray-600">
                                If approved, we'll help you schedule your appointment immediately
                            </span>
                        </li>
                    </ul>
                </div>

                {/* Staff Override Section (only visible to authenticated staff) */}
                {isStaff && (
                    <div className="border-t pt-6 mt-6">
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <div className="flex items-center mb-3">
                                <Shield className="h-5 w-5 text-purple-600 mr-2" />
                                <h3 className="font-semibold text-purple-800">
                                    Staff Override Controls
                                </h3>
                            </div>

                            {!showOverrideForm ? (
                                <button
                                    onClick={() => setShowOverrideForm(true)}
                                    className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg 
                                             hover:bg-purple-700 transition-colors font-semibold"
                                >
                                    Manual Override & Allow Booking
                                </button>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Verified Medicaid Plan
                                        </label>
                                        <select
                                            value={selectedPlan}
                                            onChange={(e) => setSelectedPlan(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg 
                                                     focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        >
                                            <option value="">Select verified plan...</option>
                                            {acceptedPlans.map(plan => (
                                                <option key={plan.value} value={plan.value}>
                                                    {plan.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Verification Notes
                                        </label>
                                        <textarea
                                            value={overrideReason}
                                            onChange={(e) => setOverrideReason(e.target.value)}
                                            placeholder="e.g., Verified in PRISM - Active FFS coverage"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg 
                                                     focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            rows={3}
                                        />
                                    </div>

                                    <div className="flex space-x-3">
                                        <button
                                            onClick={handleStaffOverride}
                                            className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg 
                                                     hover:bg-green-700 transition-colors font-semibold"
                                        >
                                            Approve & Continue
                                        </button>
                                        <button
                                            onClick={() => setShowOverrideForm(false)}
                                            className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg 
                                                     hover:bg-gray-400 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>

                                    <p className="text-xs text-gray-500 mt-2">
                                        Logged as: {currentUser?.email}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Alternative Options */}
                <div className="mt-6 pt-6 border-t">
                    <p className="text-gray-600 mb-4">Other options:</p>
                    <div className="space-y-3">
                        <button
                            onClick={onBack}
                            className="w-full text-blue-600 hover:text-blue-700 font-semibold 
                                     transition-colors"
                        >
                            ← Choose different insurance
                        </button>
                        <button
                            onClick={() => {
                                // Handle self-pay option
                                onVerificationComplete({
                                    selfPay: true,
                                    message: 'Patient chose self-pay option'
                                })
                            }}
                            className="w-full text-gray-600 hover:text-gray-700 transition-colors"
                        >
                            Continue with self-pay option
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}