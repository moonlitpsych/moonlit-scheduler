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
        setChecking(true);
        setError('');
        setResult(null);

        try {
            const response = await fetch('/api/medicaid/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            setResult(data);

            // Pass result back to parent component
            onVerificationComplete(data);

        } catch (err) {
            setError('Unable to verify eligibility. Please try again.');
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
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-moonlit-coral"
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
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-moonlit-coral"
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
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-moonlit-coral"
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
                        onChange={(e) => setFormData({ ...formData, ssn: e.target.value })}
                        placeholder="1234"
                        maxLength={4}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-moonlit-coral"
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
                        onChange={(e) => setFormData({ ...formData, medicaidId: e.target.value })}
                        placeholder="1234567890"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-moonlit-coral"
                    />
                </div>

                <button
                    onClick={handleCheck}
                    disabled={checking || (!formData.ssn && !formData.medicaidId)}
                    className="w-full bg-moonlit-coral text-white py-3 px-6 rounded-lg font-semibold 
                     hover:bg-moonlit-coral-hover transition-colors disabled:opacity-50 
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

            {/* Results Display */}
            {result && (
                <div className={`mt-6 p-4 rounded-lg ${result.isAccepted
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200'
                    }`}>
                    <div className="flex items-start">
                        {result.isAccepted ? (
                            <Check className="h-6 w-6 text-green-600 mt-1 mr-3" />
                        ) : (
                            <X className="h-6 w-6 text-red-600 mt-1 mr-3" />
                        )}
                        <div className="flex-1">
                            <h3 className={`font-semibold text-lg ${result.isAccepted ? 'text-green-800' : 'text-red-800'
                                }`}>
                                {result.isAccepted ? 'Coverage Accepted!' : 'Coverage Not Accepted'}
                            </h3>

                            {result.currentPlan && (
                                <p className="mt-2 text-gray-700">
                                    <strong>Your Plan:</strong> {result.currentPlan}
                                </p>
                            )}

                            <p className={`mt-2 ${result.isAccepted ? 'text-green-700' : 'text-red-700'
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

            {error && (
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start">
                        <AlertCircle className="h-6 w-6 text-yellow-600 mt-1 mr-3" />
                        <div>
                            <h3 className="font-semibold text-yellow-800">Verification Error</h3>
                            <p className="mt-1 text-yellow-700">{error}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}