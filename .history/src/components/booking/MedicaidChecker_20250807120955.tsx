// src/components/booking/MedicaidChecker.tsx
'use client'

import { AlertCircle, Check, Loader2, X } from 'lucide-react';
import { useState } from 'react';

interface MedicaidCheckerProps {
    onVerificationComplete: (result: any) => void;
    patientInfo?: {
        firstName?: string;
        lastName?: string;
        dob?: string;
    };
}

export default function MedicaidChecker({
    onVerificationComplete,
    patientInfo
}: MedicaidCheckerProps) {
    const [formData, setFormData] = useState({
        first: patientInfo?.firstName || '',
        last: patientInfo?.lastName || '',
        dob: patientInfo?.dob || '',
        ssn: '',
        medicaidId: ''
    });

    const [checking, setChecking] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');

    const handleCheck = async () => {
        // Validation
        if (!formData.first || !formData.last || !formData.dob) {
            setError('Please fill in all required fields');
            return;
        }

        if (!formData.ssn && !formData.medicaidId) {
            setError('Please provide either SSN (last 4 digits) or Medicaid ID');
            return;
        }

        setChecking(true);
        setError('');
        setResult(null);

        try {
            const response = await fetch('/api/medicaid/check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Verification failed');
            }

            const data = await response.json();
            setResult(data);

            // Pass result back to parent component
            onVerificationComplete(data);

        } catch (err: any) {
            setError(err.message || 'Unable to verify eligibility. Please try again.');
            console.error('Eligibility check error:', err);
        } finally {
            setChecking(false);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Medicaid Eligibility Verification</h2>
                <p className="text-gray-600 mt-2">
                    We need to verify your Utah Medicaid plan to ensure we accept your coverage.
                </p>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            First Name *
                        </label>
                        <input
                            type="text"
                            value={formData.first}
                            onChange={(e) => setFormData({ ...formData, first: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Last Name *
                        </label>
                        <input
                            type="text"
                            value={formData.last}
                            onChange={(e) => setFormData({ ...formData, last: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date of Birth *
                    </label>
                    <input
                        type="date"
                        value={formData.dob}
                        onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        SSN (last 4 digits)
                    </label>
                    <input
                        type="text"
                        value={formData.ssn}
                        onChange={(e) => {
                            // Only allow digits and max 4 characters
                            const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                            setFormData({ ...formData, ssn: value });
                        }}
                        placeholder="1234"
                        maxLength={4}
                        pattern="[0-9]*"
                        inputMode="numeric"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Either SSN or Medicaid ID is required
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Utah Medicaid ID
                    </label>
                    <input
                        type="text"
                        value={formData.medicaidId}
                        onChange={(e) => {
                            // Only allow digits and max 10 characters
                            const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setFormData({ ...formData, medicaidId: value });
                        }}
                        placeholder="1234567890"
                        maxLength={10}
                        pattern="[0-9]*"
                        inputMode="numeric"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>

                <button
                    onClick={handleCheck}
                    disabled={checking || !formData.first || !formData.last || !formData.dob || (!formData.ssn && !formData.medicaidId)}
                    className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold 
                     hover:bg-blue-700 transition-colors disabled:opacity-50 
                     disabled:cursor-not-allowed flex items-center justify-center"
                >
                    {checking ? (
                        <>
                            <Loader2 className="animate-spin mr-2 h-5 w-5" />
                            Checking with UHIN...
                        </>
                    ) : (
                        '🔍 Verify Medicaid Eligibility'
                    )}
                </button>
            </div>

            {/* Error Display */}
            {error && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start">
                        <X className="h-6 w-6 text-red-600 mt-1 mr-3" />
                        <div>
                            <h3 className="font-semibold text-red-800">Verification Error</h3>
                            <p className="mt-1 text-red-700">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Results Display */}
            {result && !error && (
                <div className={`mt-6 p-4 rounded-lg ${result.isAccepted
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-yellow-50 border border-yellow-200'
                    }`}>
                    <div className="flex items-start">
                        {result.isAccepted ? (
                            <Check className="h-6 w-6 text-green-600 mt-1 mr-3" />
                        ) : (
                            <AlertCircle className="h-6 w-6 text-yellow-600 mt-1 mr-3" />
                        )}
                        <div className="flex-1">
                            <h3 className={`font-semibold text-lg ${result.isAccepted ? 'text-green-800' : 'text-yellow-800'
                                }`}>
                                {result.isAccepted ? 'Coverage Accepted!' : 'Coverage Not Currently Accepted'}
                            </h3>

                            {result.currentPlan && (
                                <p className="mt-2 text-gray-700">
                                    <strong>Your Plan:</strong> {result.currentPlan}
                                </p>
                            )}

                            <p className={`mt-2 ${result.isAccepted ? 'text-green-700' : 'text-yellow-700'
                                }`}>
                                {result.message}
                            </p>

                            {!result.isAccepted && (
                                <div className="mt-4 p-3 bg-white rounded border border-gray-200">
                                    <p className="text-sm text-gray-600">
                                        <strong>What you can do:</strong>
                                    </p>
                                    <ul className="mt-2 text-sm text-gray-600 space-y-1">
                                        <li>• Pay out of pocket for this visit</li>
                                        <li>• Check if you can switch to an accepted plan</li>
                                        <li>• We'll notify you when we accept {result.currentPlan}</li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Simulation Mode Notice */}
            {result?.simulationMode && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start">
                        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                        <div className="text-sm text-blue-800">
                            <p className="font-semibold">Test Mode</p>
                            <p className="mt-1">
                                This is a simulated response for testing. Real-time verification will be
                                active once UHIN credentials are configured.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}