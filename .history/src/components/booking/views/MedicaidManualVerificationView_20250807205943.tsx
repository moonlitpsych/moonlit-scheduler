// src/components/booking/views/MedicaidManualVerificationView.tsx
'use client'

import { medicaidOverrideService } from '@/lib/services/MedicaidOverrideService'
import { supabase } from '@/lib/supabase'
import { AlertCircle, CheckCircle, Clock, Copy, FileText, Key, Phone, Shield } from 'lucide-react'
import { useEffect, useState } from 'react'

interface MedicaidManualVerificationViewProps {
    patientInfo?: {
        firstName?: string
        lastName?: string
        dob?: string
        email?: string
        phone?: string
        medicaidId?: string
    }
    payerInfo?: {
        id: string
        name: string
        planType?: string
    }
    onVerificationComplete: (result: any) => void
    onBack: () => void
}

export default function MedicaidManualVerificationView({
    patientInfo,
    payerInfo,
    onVerificationComplete,
    onBack
}: MedicaidManualVerificationViewProps) {
    const [isStaff, setIsStaff] = useState(false)
    const [loading, setLoading] = useState(false)
    const [currentUser, setCurrentUser] = useState<any>(null)

    // Case creation state
    const [caseNumber, setCaseNumber] = useState<string>('')
    const [caseCreated, setCaseCreated] = useState(false)

    // Access code entry state
    const [showAccessCodeEntry, setShowAccessCodeEntry] = useState(false)
    const [accessCode, setAccessCode] = useState('')
    const [verificationError, setVerificationError] = useState('')

    // Staff override state
    const [showStaffPanel, setShowStaffPanel] = useState(false)
    const [pendingCases, setPendingCases] = useState<any[]>([])
    const [selectedCase, setSelectedCase] = useState<any>(null)
    const [approvalNotes, setApprovalNotes] = useState('')

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
                const staffEmails = [
                    'hello@trymoonlit.com',
                    'miriam@trymoonlit.com',
                    'dr.sweeney@trymoonlit.com'
                ]
                const isStaffUser = staffEmails.includes(user.email?.toLowerCase() || '')
                setIsStaff(isStaffUser)

                if (isStaffUser) {
                    loadPendingCases()
                }
            }
        } catch (error) {
            console.error('Error checking staff status:', error)
        }
    }

    const loadPendingCases = async () => {
        const cases = await medicaidOverrideService.getPendingCases()
        setPendingCases(cases)
    }

    // Create a new case when patient selects Medicaid
    const createVerificationCase = async () => {
        if (caseCreated || !payerInfo) return // Prevent duplicate creation

        setLoading(true)
        try {
            const result = await medicaidOverrideService.createCase(
                {
                    first_name: patientInfo?.firstName || '',
                    last_name: patientInfo?.lastName || '',
                    dob: patientInfo?.dob || '',
                    email: patientInfo?.email || '',
                    phone: patientInfo?.phone || '',
                    medicaid_id: patientInfo?.medicaidId
                },
                {
                    payer_id: payerInfo.id,
                    payer_name: payerInfo.name,
                    plan_type: payerInfo.planType || 'Unknown'
                }
            )

            if (result) {
                setCaseNumber(result.caseNumber)
                setCaseCreated(true)
            }
        } catch (error) {
            console.error('Error creating case:', error)
        } finally {
            setLoading(false)
        }
    }

    // Verify access code entered by patient
    const handleAccessCodeVerification = async () => {
        setLoading(true)
        setVerificationError('')

        try {
            const verifiedCase = await medicaidOverrideService.verifyAccessCode(accessCode)

            if (verifiedCase) {
                // Success! Continue to provider selection
                onVerificationComplete({
                    manualOverride: true,
                    accessCode: accessCode,
                    caseNumber: verifiedCase.case_number,
                    medicaidPlan: verifiedCase.payer_info.plan_type,
                    approvedBy: verifiedCase.approved_by
                })
            } else {
                setVerificationError('Invalid or expired access code. Please check and try again.')
            }
        } catch (error) {
            setVerificationError('Error verifying access code. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    // Staff approves a case
    const handleStaffApproval = async (caseToApprove: any) => {
        setLoading(true)

        try {
            const result = await medicaidOverrideService.approveCase(
                caseToApprove.case_number,
                currentUser?.email || 'staff@trymoonlit.com',
                approvalNotes
            )

            if (result) {
                alert(`Case approved! Access code: ${result.accessCode}\n\nShare this with the patient.`)
                await loadPendingCases()
                setSelectedCase(null)
                setApprovalNotes('')
            }
        } catch (error) {
            alert('Error approving case. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    // Copy text to clipboard
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
            .then(() => alert('Copied to clipboard!'))
            .catch(() => alert('Failed to copy'))
    }

    // Initialize case creation
    useEffect(() => {
        if (!caseCreated && patientInfo && payerInfo) {
            createVerificationCase()
        }
    }, [patientInfo, payerInfo])

    return (
        <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-6">
                {/* Header */}
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">
                        Utah Medicaid Verification Required
                    </h2>
                    <p className="text-gray-600">
                        We need to verify your Medicaid coverage before scheduling.
                    </p>
                </div>

                {/* Main Content - Different views based on state */}
                {!showAccessCodeEntry ? (
                    <>
                        {/* Case Number Display */}
                        {caseNumber && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                                <div className="flex items-start">
                                    <FileText className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
                                    <div className="flex-1">
                                        <p className="font-semibold text-gray-800 mb-2">
                                            Your Case Number:
                                        </p>
                                        <div className="flex items-center bg-white rounded px-3 py-2 border border-blue-300">
                                            <span className="text-xl font-mono font-bold text-blue-600 flex-1">
                                                {caseNumber}
                                            </span>
                                            <button
                                                onClick={() => copyToClipboard(caseNumber)}
                                                className="ml-2 p-1 hover:bg-blue-100 rounded"
                                                title="Copy case number"
                                            >
                                                <Copy className="h-4 w-4 text-blue-600" />
                                            </button>
                                        </div>
                                        <p className="text-sm text-gray-600 mt-2">
                                            Save this number - you'll need it when calling
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Two Options */}
                        <div className="grid md:grid-cols-2 gap-4 mb-6">
                            {/* Option 1: Call Office */}
                            <div className="border-2 border-gray-200 rounded-lg p-4">
                                <div className="flex items-center mb-3">
                                    <Phone className="h-5 w-5 text-blue-600 mr-2" />
                                    <h3 className="font-semibold text-gray-800">Option 1: Call Us</h3>
                                </div>
                                <p className="text-sm text-gray-600 mb-3">
                                    Call our office with your case number for immediate assistance
                                </p>
                                <div className="bg-gray-50 rounded p-3">
                                    <p className="text-2xl font-bold text-blue-600">(801) 555-0100</p>
                                    <p className="text-xs text-gray-600 mt-1">Mon-Fri, 9am-5pm MST</p>
                                </div>
                            </div>

                            {/* Option 2: Have Access Code */}
                            <div className="border-2 border-green-200 rounded-lg p-4">
                                <div className="flex items-center mb-3">
                                    <Key className="h-5 w-5 text-green-600 mr-2" />
                                    <h3 className="font-semibold text-gray-800">Option 2: Have a Code?</h3>
                                </div>
                                <p className="text-sm text-gray-600 mb-3">
                                    If you've already been approved, enter your access code
                                </p>
                                <button
                                    onClick={() => setShowAccessCodeEntry(true)}
                                    className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    Enter Access Code
                                </button>
                            </div>
                        </div>

                        {/* What Happens Next */}
                        <div className="bg-gray-50 rounded-lg p-4 mb-6">
                            <h3 className="font-semibold text-gray-800 mb-3">What happens next?</h3>
                            <div className="space-y-2">
                                <div className="flex items-start">
                                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                                    <span className="text-sm text-gray-600">
                                        Our staff will verify your Medicaid coverage
                                    </span>
                                </div>
                                <div className="flex items-start">
                                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                                    <span className="text-sm text-gray-600">
                                        You'll receive an access code via text or email
                                    </span>
                                </div>
                                <div className="flex items-start">
                                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                                    <span className="text-sm text-gray-600">
                                        Return here to continue booking with your code
                                    </span>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    /* Access Code Entry View */
                    <div className="py-4">
                        <div className="mb-6">
                            <div className="flex items-center mb-4">
                                <Key className="h-6 w-6 text-green-600 mr-2" />
                                <h3 className="text-xl font-semibold text-gray-800">
                                    Enter Your Access Code
                                </h3>
                            </div>
                            <p className="text-gray-600 mb-4">
                                Enter the 8-character code you received from our office
                            </p>

                            <input
                                type="text"
                                value={accessCode}
                                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                                placeholder="XXXX-XXXX"
                                maxLength={9}
                                className="w-full text-center text-2xl font-mono font-bold px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                            />

                            {verificationError && (
                                <div className="mt-3 flex items-center text-red-600">
                                    <AlertCircle className="h-4 w-4 mr-1" />
                                    <span className="text-sm">{verificationError}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowAccessCodeEntry(false)}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleAccessCodeVerification}
                                disabled={loading || accessCode.length < 8}
                                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {loading ? 'Verifying...' : 'Verify & Continue'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Staff Override Panel (only visible to authenticated staff) */}
                {isStaff && !showAccessCodeEntry && (
                    <div className="border-t pt-6 mt-6">
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center">
                                    <Shield className="h-5 w-5 text-purple-600 mr-2" />
                                    <h3 className="font-semibold text-purple-800">
                                        Staff Control Panel
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setShowStaffPanel(!showStaffPanel)}
                                    className="text-purple-600 text-sm hover:text-purple-800"
                                >
                                    {showStaffPanel ? 'Hide' : 'Show'} Panel
                                </button>
                            </div>

                            {showStaffPanel && (
                                <div className="mt-4 space-y-4">
                                    {/* Pending Cases */}
                                    <div>
                                        <h4 className="font-medium text-gray-800 mb-2">
                                            Pending Cases ({pendingCases.length})
                                        </h4>
                                        {pendingCases.length > 0 ? (
                                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                                {pendingCases.map((case_) => (
                                                    <div
                                                        key={case_.id}
                                                        className="bg-white p-3 rounded border border-purple-100"
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <p className="font-mono text-sm font-bold">
                                                                    {case_.case_number}
                                                                </p>
                                                                <p className="text-sm text-gray-600">
                                                                    {case_.patient_info?.first_name} {case_.patient_info?.last_name}
                                                                </p>
                                                                <p className="text-xs text-gray-500">
                                                                    <Clock className="inline h-3 w-3 mr-1" />
                                                                    {new Date(case_.created_at).toLocaleString()}
                                                                </p>
                                                            </div>
                                                            <button
                                                                onClick={() => setSelectedCase(case_)}
                                                                className="text-sm bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700"
                                                            >
                                                                Review
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-600 italic">No pending cases</p>
                                        )}
                                    </div>

                                    {/* Case Approval Form */}
                                    {selectedCase && (
                                        <div className="bg-white p-4 rounded border-2 border-purple-300">
                                            <h4 className="font-medium text-gray-800 mb-3">
                                                Approve Case: {selectedCase.case_number}
                                            </h4>
                                            <div className="space-y-2 mb-3">
                                                <p className="text-sm">
                                                    <strong>Patient:</strong> {selectedCase.patient_info?.first_name} {selectedCase.patient_info?.last_name}
                                                </p>
                                                <p className="text-sm">
                                                    <strong>Plan:</strong> {selectedCase.payer_info?.plan_type}
                                                </p>
                                                <p className="text-sm">
                                                    <strong>Medicaid ID:</strong> {selectedCase.patient_info?.medicaid_id || 'Not provided'}
                                                </p>
                                            </div>

                                            <textarea
                                                value={approvalNotes}
                                                onChange={(e) => setApprovalNotes(e.target.value)}
                                                placeholder="Add notes (optional)"
                                                className="w-full p-2 border rounded text-sm mb-3"
                                                rows={2}
                                            />

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setSelectedCase(null)}
                                                    className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => handleStaffApproval(selectedCase)}
                                                    disabled={loading}
                                                    className="flex-1 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                                                >
                                                    {loading ? 'Processing...' : 'Approve & Generate Code'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Back Button */}
                <div className="mt-6">
                    <button
                        onClick={onBack}
                        className="text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        ← Back to insurance selection
                    </button>
                </div>
            </div>
        </div>
    )
}