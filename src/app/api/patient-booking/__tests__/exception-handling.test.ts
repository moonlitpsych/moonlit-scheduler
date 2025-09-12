/**
 * Test for provider schedule exception handling
 * 
 * This test verifies that when a provider has an all-day exception,
 * no slots are returned for that date in the patient-facing API.
 */

import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals'

// Mock Supabase
const mockSupabaseAdmin = {
    from: jest.fn(() => mockSupabaseAdmin),
    select: jest.fn(() => mockSupabaseAdmin),
    eq: jest.fn(() => mockSupabaseAdmin),
    in: jest.fn(() => mockSupabaseAdmin),
    gte: jest.fn(() => mockSupabaseAdmin),
    data: null as any,
    error: null as any
}

jest.mock('@/lib/supabase', () => ({
    supabaseAdmin: mockSupabaseAdmin
}))

jest.mock('@/lib/services/intakeQService', () => ({
    intakeQService: {
        getAppointmentsForDate: jest.fn().mockResolvedValue([])
    }
}))

jest.mock('@/lib/services/coVisitService', () => ({
    coVisitService: {
        getCoVisitAvailability: jest.fn().mockResolvedValue([])
    }
}))

describe('Provider Schedule Exception Handling', () => {
    const PROVIDER_ID = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694' // Dr. Sweeney
    const PAYER_ID = 'test-payer-id'
    const EXCEPTION_DATE = '2025-09-13'
    
    beforeAll(() => {
        // Reset all mocks
        jest.clearAllMocks()
    })

    afterAll(() => {
        jest.restoreAllMocks()
    })

    it('should return no slots when provider has an all-day exception', async () => {
        // Setup mock data
        const mockProviderPayer = [{
            provider_id: PROVIDER_ID,
            payer_id: PAYER_ID,
            network_status: 'in_network',
            billing_provider_id: null,
            effective_date: '2025-01-01',
            first_name: 'Rufus',
            last_name: 'Sweeney',
            title: 'MD',
            role: 'physician',
            provider_type: 'physician',
            is_active: true,
            is_bookable: true
        }]

        const mockAvailability = [{
            provider_id: PROVIDER_ID,
            day_of_week: 6, // Saturday
            start_time: '09:00:00',
            end_time: '17:00:00',
            is_recurring: true
        }]

        const mockException = [{
            id: 'exception-1',
            provider_id: PROVIDER_ID,
            exception_date: EXCEPTION_DATE,
            exception_type: 'unavailable',
            start_time: null, // All day
            end_time: null,   // All day
            reason: 'Not available all day on Saturday, September 13, 2025'
        }]

        // Mock the database calls
        mockSupabaseAdmin.from.mockImplementation((table: string) => {
            if (table === 'v_bookable_provider_payer') {
                return {
                    ...mockSupabaseAdmin,
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockResolvedValue({
                        data: mockProviderPayer,
                        error: null
                    })
                }
            }
            if (table === 'provider_availability') {
                return {
                    ...mockSupabaseAdmin,
                    select: jest.fn().mockReturnThis(),
                    in: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockResolvedValue({
                        data: mockAvailability,
                        error: null
                    })
                }
            }
            if (table === 'availability_exceptions') {
                return {
                    ...mockSupabaseAdmin,
                    select: jest.fn().mockReturnThis(),
                    in: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockResolvedValue({
                        data: mockException,
                        error: null
                    })
                }
            }
            if (table === 'providers') {
                return {
                    ...mockSupabaseAdmin,
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({
                        data: { intakeq_practitioner_id: 'test-practitioner' },
                        error: null
                    })
                }
            }
            return mockSupabaseAdmin
        })

        // Import the route handler
        const { POST } = await import('../merged-availability/route')
        
        // Create mock request
        const mockRequest = {
            json: jest.fn().mockResolvedValue({
                payer_id: PAYER_ID,
                date: EXCEPTION_DATE,
                appointmentDuration: 60
            })
        } as any

        // Call the API
        const response = await POST(mockRequest)
        const result = await response.json()

        // Verify the response
        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(result.data.totalSlots).toBe(0) // No slots due to exception
        expect(result.data.availableSlots).toEqual([]) // Empty array
        
        // Verify debug information
        expect(result.data.debug).toBeDefined()
        expect(result.data.debug.exceptions_found).toBe(1)
        expect(result.data.debug.base_availability_records).toBe(1)
        expect(result.data.debug.filtered_availability_records).toBe(0) // Filtered out by exception
        expect(result.data.debug.final_slots).toBe(0)
        
        console.log('✅ Test passed: All-day exception correctly blocks all slots')
    })

    it('should return slots on days without exceptions', async () => {
        // Setup mock data for a different date (no exception)
        const NORMAL_DATE = '2025-09-20' // Another Saturday
        
        const mockProviderPayer = [{
            provider_id: PROVIDER_ID,
            payer_id: PAYER_ID,
            network_status: 'in_network',
            billing_provider_id: null,
            effective_date: '2025-01-01',
            first_name: 'Rufus',
            last_name: 'Sweeney',
            title: 'MD',
            role: 'physician',
            provider_type: 'physician',
            is_active: true,
            is_bookable: true
        }]

        const mockAvailability = [{
            provider_id: PROVIDER_ID,
            day_of_week: 6, // Saturday
            start_time: '09:00:00',
            end_time: '17:00:00',
            is_recurring: true
        }]

        // Mock the database calls
        mockSupabaseAdmin.from.mockImplementation((table: string) => {
            if (table === 'v_bookable_provider_payer') {
                return {
                    ...mockSupabaseAdmin,
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockResolvedValue({
                        data: mockProviderPayer,
                        error: null
                    })
                }
            }
            if (table === 'provider_availability') {
                return {
                    ...mockSupabaseAdmin,
                    select: jest.fn().mockReturnThis(),
                    in: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockResolvedValue({
                        data: mockAvailability,
                        error: null
                    })
                }
            }
            if (table === 'availability_exceptions') {
                return {
                    ...mockSupabaseAdmin,
                    select: jest.fn().mockReturnThis(),
                    in: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockResolvedValue({
                        data: [], // No exceptions for this date
                        error: null
                    })
                }
            }
            if (table === 'providers') {
                return {
                    ...mockSupabaseAdmin,
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({
                        data: { intakeq_practitioner_id: 'test-practitioner' },
                        error: null
                    })
                }
            }
            return mockSupabaseAdmin
        })

        // Import the route handler
        const { POST } = await import('../merged-availability/route')
        
        // Create mock request
        const mockRequest = {
            json: jest.fn().mockResolvedValue({
                payer_id: PAYER_ID,
                date: NORMAL_DATE,
                appointmentDuration: 60
            })
        } as any

        // Call the API
        const response = await POST(mockRequest)
        const result = await response.json()

        // Verify the response
        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(result.data.totalSlots).toBeGreaterThan(0) // Should have slots
        expect(result.data.availableSlots.length).toBeGreaterThan(0) // Should have slots
        
        // Verify debug information
        expect(result.data.debug).toBeDefined()
        expect(result.data.debug.exceptions_found).toBe(0) // No exceptions
        expect(result.data.debug.base_availability_records).toBe(1)
        expect(result.data.debug.filtered_availability_records).toBe(1) // Not filtered
        
        console.log('✅ Test passed: Slots are available on days without exceptions')
    })
})