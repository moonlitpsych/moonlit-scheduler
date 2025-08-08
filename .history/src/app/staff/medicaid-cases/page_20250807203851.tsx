// src/app/staff/medicaid-cases/page.tsx
'use client'

import { medicaidOverrideService } from '@/lib/services/MedicaidOverrideService'
import { supabase } from '@/lib/supabase'
import { Check, CheckCircle, Clock, Copy, Phone, RefreshCw, Search, Shield, User, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function StaffMedicaidDashboard() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [isAuthorized, setIsAuthorized] = useState(false)
    const [currentUser, setCurrentUser] = useState<any>(null)

    // Cases state
    const [pendingCases, setPendingCases] = useState<any[]>([])
    const [approvedCases, setApprovedCases] = useState<any[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCase, setSelectedCase] = useState<any>(null)

    // Approval form state
    const [approvalNotes, setApprovalNotes] = useState('')
    const [generatedCode, setGeneratedCode] = useState('')
    const [showCodeModal, setShowCodeModal] = useState(false)

    // Tab state
    const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending')

    // Check authentication and authorization
    useEffect(() => {
        checkAuthorization()
    }, [])

    const checkAuthorization = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                router.push('/staff-login')
                return
            }

            const staffEmails = [
                'hello@trymoonlit.com',
                'miriam@trymoonlit.com',
                'dr.sweeney@trymoonlit.com'
            ]

            if (!staffEmails.includes(user.email?.toLowerCase() || '')) {
                alert('Unauthorized access')
                router.push('/')
                return
            }

            setCurrentUser(user)
            setIsAuthorized(true)
            await loadCases()
        } catch (error) {
            console.error('Authorization error:', error)
            router.push('/staff-login')
        } finally {
            setLoading(false)
        }
    }

    const loadCases = async () => {
        try {
            // Load pending cases
            const pending = await medicaidOverrideService.getPendingCases()
            setPendingCases(pending)

            // Load approved cases from the last 7 days
            const { data: approved } = await supabase
                .from('eligibility_log')
                .select('*')
                .eq('status', 'approved')
                .gte('approved_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
                .order('approved_at', { ascending: false })

            if (approved) {
                setApprovedCases(approved)
            }
        } catch (error) {
            console.error('Error loading cases:', error)
        }
    }

    const handleApproveCase = async () => {
        if (!selectedCase) return

        setLoading(true)
        try {
            const result = await medicaidOverrideService.approveCase(
                selectedCase.case_number,
                currentUser?.email || 'staff@trymoonlit.com',
                approvalNotes
            )

            if (result) {
                setGeneratedCode(result.accessCode)
                setShowCodeModal(true)
                await loadCases()
                setSelectedCase(null)
                setApprovalNotes('')
            } else {
                alert('Error approving case. Please try again.')
            }
        } catch (error) {
            alert('Error approving case')
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleDenyCase = async () => {
        if (!selectedCase || !confirm('Are you sure you want to deny this case?')) return

        setLoading(true)
        try {
            await supabase
                .from('eligibility_log')
                .update({
                    status: 'denied',
                    override_reason: approvalNotes || 'Does not meet eligibility requirements',
                    approved_by: currentUser?.email,
                    approved_at: new Date().toISOString()
                })
                .eq('case_number', selectedCase.case_number)

            await loadCases()
            setSelectedCase(null)
            setApprovalNotes('')
            alert('Case denied')
        } catch (error) {
            alert('Error denying case')
        } finally {
            setLoading(false)
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
            .then(() => alert('Copied to clipboard!'))
            .catch(() => alert('Failed to copy'))
    }

    const formatTimeAgo = (date: string) => {
        const diff = Date.now() - new Date(date).getTime()
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const days = Math.floor(hours / 24)

        if (days > 0) return `${days}d ago`
        if (hours > 0) return `${hours}h ago`
        return 'Just now'
    }

    // Filter cases based on search
    const filteredPendingCases = pendingCases.filter(c =>
        c.case_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.patient_info?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.patient_info?.last_name?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const filteredApprovedCases = approvedCases.filter(c =>
        c.case_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.patient_data?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.patient_data?.last_name?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Loading cases...</p>
                </div>
            </div>
        )
    }

    if (!isAuthorized) {
        return null
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <div className="flex items-center">
                            <Shield className="h-6 w-6 text-purple-600 mr-3" />
                            <h1 className="text-2xl font-bold text-gray-800">
                                Medicaid Verification Dashboard
                            </h1>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-600">
                                <User className="inline h-4 w-4 mr-1" />
                                {currentUser?.email}
                            </span>
                            <button
                                onClick={loadCases}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Refresh"
                            >
                                <RefreshCw className="h-5 w-5 text-gray-600" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <Clock className="h-10 w-10 text-yellow-500 mr-4" />
                            <div>
                                <p className="text-sm text-gray-600">Pending Cases</p>
                                <p className="text-2xl font-bold text-gray-800">{pendingCases.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <CheckCircle className="h-10 w-10 text-green-500 mr-4" />
                            <div>
                                <p className="text-sm text-gray-600">Approved (7 days)</p>
                                <p className="text-2xl font-bold text-gray-800">{approvedCases.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <Phone className="h-10 w-10 text-blue-500 mr-4" />
                            <div>
                                <p className="text-sm text-gray-600">Support Line</p>
                                <p className="text-xl font-bold text-gray-800">(801) 555-0100</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="bg-white rounded-lg shadow mb-6 p-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by case number or patient name..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                        />
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-lg shadow">
                    <div className="border-b">
                        <div className="flex">
                            <button
                                onClick={() => setActiveTab('pending')}
                                className={`px-6 py-3 font-medium transition-colors ${activeTab === 'pending'
                                        ? 'text-blue-600 border-b-2 border-blue-600'
                                        : 'text-gray-600 hover:text-gray-800'
                                    }`}
                            >
                                Pending ({filteredPendingCases.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('approved')}
                                className={`px-6 py-3 font-medium transition-colors ${activeTab === 'approved'
                                        ? 'text-blue-600 border-b-2 border-blue-600'
                                        : 'text-gray-600 hover:text-gray-800'
                                    }`}
                            >
                                Approved ({filteredApprovedCases.length})
                            </button>
                        </div>
                    </div>

                    {/* Cases List */}
                    <div className="p-6">
                        {activeTab === 'pending' ? (
                            filteredPendingCases.length > 0 ? (
                                <div className="space-y-4">
                                    {filteredPendingCases.map((case_) => (
                                        <div
                                            key={case_.id}
                                            className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <span className="font-mono font-bold text-lg">
                                                            {case_.case_number}
                                                        </span>
                                                        <span className="text-sm text-gray-500">
                                                            {formatTimeAgo(case_.created_at)}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                                                        <div>
                                                            <span className="text-gray-600">Patient: </span>
                                                            <span className="font-medium">
                                                                {case_.patient_info?.first_name} {case_.patient_info?.last_name}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-600">Plan: </span>
                                                            <span className="font-medium">
                                                                {case_.payer_info?.plan_type || 'Unknown'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-600">Medicaid ID: </span>
                                                            <span className="font-medium">
                                                                {case_.patient_info?.medicaid_id || 'Not provided'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setSelectedCase(case_)}
                                                    className="ml-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                                                >
                                                    Review
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                                    <p>No pending cases</p>
                                </div>
                            )
                        ) : (
                            filteredApprovedCases.length > 0 ? (
                                <div className="space-y-4">
                                    {filteredApprovedCases.map((case_) => (
                                        <div
                                            key={case_.id}
                                            className="border rounded-lg p-4 bg-green-50 border-green-200"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <span className="font-mono font-bold text-lg">
                                                            {case_.case_number}
                                                        </span>
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                            <Check className="h-3 w-3 mr-1" />
                                                            Approved
                                                        </span>
                                                        <span className="text-sm text-gray-500">
                                                            {formatTimeAgo(case_.approved_at)}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                                                        <div>
                                                            <span className="text-gray-600">Patient: </span>
                                                            <span className="font-medium">
                                                                {case_.patient_data?.first_name} {case_.patient_data?.last_name}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-600">Access Code: </span>
                                                            <span className="font-mono font-bold text-green-600">
                                                                {case_.access_code}
                                                            </span>
                                                            <button
                                                                onClick={() => copyToClipboard(case_.access_code)}
                                                                className="ml-2 text-gray-400 hover:text-gray-600"
                                                            >
                                                                <Copy className="h-3 w-3 inline" />
                                                            </button>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-600">Approved by: </span>
                                                            <span className="font-medium">
                                                                {case_.approved_by}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                                    <p>No approved cases in the last 7 days</p>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>

            {/* Case Review Modal */}
            {selectedCase && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-6">
                                <h2 className="text-2xl font-bold text-gray-800">
                                    Review Case: {selectedCase.case_number}
                                </h2>
                                <button
                                    onClick={() => setSelectedCase(null)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            {/* Case Details */}
                            <div className="space-y-4 mb-6">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h3 className="font-semibold text-gray-800 mb-3">Patient Information</h3>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <span className="text-gray-600">Name: </span>
                                            <span className="font-medium">
                                                {selectedCase.patient_info?.first_name} {selectedCase.patient_info?.last_name}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">DOB: </span>
                                            <span className="font-medium">
                                                {selectedCase.patient_info?.dob || 'Not provided'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Email: </span>
                                            <span className="font-medium">
                                                {selectedCase.patient_info?.email}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Phone: </span>
                                            <span className="font-medium">
                                                {selectedCase.patient_info?.phone}
                                            </span>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="text-gray-600">Medicaid ID: </span>
                                            <span className="font-medium">
                                                {selectedCase.patient_info?.medicaid_id || 'Not provided'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h3 className="font-semibold text-gray-800 mb-3">Insurance Information</h3>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <span className="text-gray-600">Payer: </span>
                                            <span className="font-medium">
                                                {selectedCase.payer_info?.payer_name}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Plan Type: </span>
                                            <span className="font-medium">
                                                {selectedCase.payer_info?.plan_type || 'Unknown'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Approval Form */}
                            <div className="border-t pt-6">
                                <h3 className="font-semibold text-gray-800 mb-3">Verification Decision</h3>
                                <textarea
                                    value={approvalNotes}
                                    onChange={(e) => setApprovalNotes(e.target.value)}
                                    placeholder="Add notes about your decision..."
                                    className="w-full p-3 border border-gray-300 rounded-lg mb-4"
                                    rows={3}
                                />

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setSelectedCase(null)}
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleDenyCase}
                                        disabled={loading}
                                        className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                                    >
                                        {loading ? 'Processing...' : 'Deny'}
                                    </button>
                                    <button
                                        onClick={handleApproveCase}
                                        disabled={loading}
                                        className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                                    >
                                        {loading ? 'Processing...' : 'Approve'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Access Code Modal */}
            {showCodeModal && generatedCode && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-md w-full p-6">
                        <div className="text-center">
                            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-gray-800 mb-2">
                                Case Approved Successfully!
                            </h3>
                            <p className="text-gray-600 mb-6">
                                Share this access code with the patient
                            </p>

                            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-6">
                                <p className="text-sm text-gray-600 mb-2">Access Code:</p>
                                <p className="text-3xl font-mono font-bold text-green-600">
                                    {generatedCode}
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => copyToClipboard(generatedCode)}
                                    className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center"
                                >
                                    <Copy className="h-4 w-4 mr-2" />
                                    Copy Code
                                </button>
                                <button
                                    onClick={() => {
                                        setShowCodeModal(false)
                                        setGeneratedCode('')
                                    }}
                                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}