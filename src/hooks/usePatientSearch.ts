/**
 * usePatientSearch Hook
 *
 * Custom hook for searching patients in the system
 * Provides debounced search with loading states
 */

import { useState, useCallback, useEffect } from 'react';

/**
 * Patient search result
 */
export interface PatientSearchResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  date_of_birth: string | null;
  phone: string | null;
  gender: string | null;
}

/**
 * API response structure
 */
interface PatientSearchResponse {
  success: boolean;
  data?: {
    patients: PatientSearchResult[];
    totalCount: number;
    query: string;
  };
  error?: string;
}

/**
 * Hook return type
 */
interface UsePatientSearchReturn {
  searchPatients: (query: string) => Promise<void>;
  patients: PatientSearchResult[];
  isLoading: boolean;
  error: string | null;
  clearResults: () => void;
}

export function usePatientSearch(): UsePatientSearchReturn {
  const [patients, setPatients] = useState<PatientSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [abortController]);

  const searchPatients = useCallback(async (query: string) => {
    // Cancel previous request
    if (abortController) {
      abortController.abort();
    }

    // Clear results if query is too short
    if (!query || query.trim().length < 2) {
      setPatients([]);
      setError(null);
      return;
    }

    const newAbortController = new AbortController();
    setAbortController(newAbortController);
    setIsLoading(true);
    setError(null);

    try {
      console.log('🔍 Searching for patients:', query);

      const response = await fetch(
        `/api/admin/eligibility/patients/search?q=${encodeURIComponent(query.trim())}`,
        {
          signal: newAbortController.signal,
        }
      );

      const data: PatientSearchResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Patient search failed');
      }

      if (data.success && data.data) {
        setPatients(data.data.patients);
        console.log(`✅ Found ${data.data.patients.length} patients`);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err: any) {
      // Ignore abort errors
      if (err.name === 'AbortError') {
        return;
      }

      const errorMessage = err.message || 'Failed to search patients';
      setError(errorMessage);
      console.error('❌ Patient search error:', err);
      setPatients([]);
    } finally {
      setIsLoading(false);
    }
  }, [abortController]);

  const clearResults = useCallback(() => {
    setPatients([]);
    setError(null);
    if (abortController) {
      abortController.abort();
    }
  }, [abortController]);

  return {
    searchPatients,
    patients,
    isLoading,
    error,
    clearResults,
  };
}
