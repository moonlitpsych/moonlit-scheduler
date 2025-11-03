/**
 * useEligibilityChecker Hook
 *
 * Custom hook for performing Office Ally eligibility checks
 * Handles API calls, loading states, and error handling
 */

import { useState } from 'react';
import type { BillabilityResult } from '@/lib/services/billabilityService';

/**
 * Patient data for eligibility check
 */
export interface EligibilityPatientData {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender?: 'M' | 'F' | 'U' | 'X';
  memberNumber?: string;
  medicaidId?: string;
  groupNumber?: string;
  ssn?: string;
}

/**
 * Eligibility check request
 */
export interface EligibilityCheckRequest extends EligibilityPatientData {
  officeAllyPayerId: string;
  providerNpi?: string;
}

/**
 * Eligibility check result
 */
export interface EligibilityResult {
  isEligible: boolean;
  coverageStatus: string;
  eligibilityCode: string;
  payer: string;
  payerName?: string | null;  // Primary payer name from X12 271 response
  managedCareOrg?: string | null;  // MCO name if patient is in managed care
  planType?: string | null;
  effectiveDate?: string;
  terminationDate?: string;
  copayInfo?: any;
  deductibleInfo?: any;
  financialSummary?: any;
  moonlitBillability?: BillabilityResult; // Moonlit contract billability (separate from patient eligibility)
  warnings?: string[];
  rawResponse?: string;
}

/**
 * API response structure
 */
interface EligibilityCheckResponse {
  success: boolean;
  data?: {
    eligibility: EligibilityResult;
    responseTimeMs: number;
    timestamp: string;
  };
  error?: string;
  details?: string;
}

/**
 * Hook return type
 */
interface UseEligibilityCheckerReturn {
  checkEligibility: (request: EligibilityCheckRequest) => Promise<EligibilityResult | null>;
  isLoading: boolean;
  error: string | null;
  result: EligibilityResult | null;
  responseTime: number | null;
  clearResult: () => void;
}

export function useEligibilityChecker(): UseEligibilityCheckerReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);

  const checkEligibility = async (request: EligibilityCheckRequest): Promise<EligibilityResult | null> => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setResponseTime(null);

    try {
      console.log('🔍 Checking eligibility...', request);

      const response = await fetch('/api/admin/eligibility/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const data: EligibilityCheckResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Eligibility check failed');
      }

      if (data.success && data.data) {
        const eligibilityResult = data.data.eligibility;
        setResult(eligibilityResult);
        setResponseTime(data.data.responseTimeMs);
        console.log('✅ Eligibility check successful', eligibilityResult);
        return eligibilityResult;
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to check eligibility';
      setError(errorMessage);
      console.error('❌ Eligibility check error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const clearResult = () => {
    setResult(null);
    setError(null);
    setResponseTime(null);
  };

  return {
    checkEligibility,
    isLoading,
    error,
    result,
    responseTime,
    clearResult,
  };
}
