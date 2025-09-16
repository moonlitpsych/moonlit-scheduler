// Test to verify phantom availability slots are eliminated for Dr. Sweeney
import { NextRequest } from 'next/server'
import { POST } from '../route'

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
    supabase: {
        from: jest.fn()
    }
}))

const mockSupabase = require('@/lib/supabase').supabase

describe('Merged Availability API - Phantom Slots Fix', () => {
    beforeEach(() => {
        jest.clearAllMocks()

        // Setup default mock chain
        mockSupabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({ data: [], error: null })
                        }),
                        in: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({ data: [], error: null })
                        })
                    }),
                    in: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({ data: [], error: null })
                        })
                    })
                })
            })
        })
    })

    test('Dr. Sweeney should have 0 slots on 2025-09-15 (unavailable exception)', async () => {
        const drSweeneyId = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'

        // Mock provider-payer networks (Dr. Sweeney accepts this payer)
        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'provider_payer_networks') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => ({
                                eq: () => Promise.resolve({
                                    data: [{
                                        provider_id: drSweeneyId,
                                        providers: {
                                            id: drSweeneyId,
                                            first_name: 'C. Rufus',
                                            last_name: 'Sweeney',
                                            is_active: true
                                        }
                                    }],
                                    error: null
                                })
                            })
                        })
                    })
                }
            }

            if (table === 'provider_availability') {
                return {
                    select: () => ({
                        in: () => ({
                            eq: () => ({
                                eq: () => Promise.resolve({
                                    data: [{
                                        provider_id: drSweeneyId,
                                        day_of_week: 0, // Sunday
                                        start_time: '17:00:00',
                                        end_time: '19:00:00',
                                        is_recurring: true
                                    }],
                                    error: null
                                })
                            })
                        })
                    })
                }
            }

            if (table === 'availability_exceptions') {
                return {
                    select: () => ({
                        in: () => ({
                            eq: () => Promise.resolve({
                                data: [{
                                    provider_id: drSweeneyId,
                                    exception_date: '2025-09-15',
                                    exception_type: 'unavailable',
                                    start_time: null,
                                    end_time: null
                                }],
                                error: null
                            })
                        })
                    })
                }
            }

            return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }
        })

        const request = new NextRequest('http://localhost:3000/api/merged-availability', {
            method: 'POST',
            body: JSON.stringify({
                payer_id: 'test-payer-id',
                date: '2025-09-15'
            })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.availableSlots).toHaveLength(0)
        expect(data.data.exceptionsCount).toBe(1)
    })

    test('Dr. Sweeney should have 2 slots on 2025-09-16 (valid availability)', async () => {
        const drSweeneyId = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'

        // Mock provider-payer networks
        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'provider_payer_networks') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => ({
                                eq: () => Promise.resolve({
                                    data: [{
                                        provider_id: drSweeneyId,
                                        providers: {
                                            id: drSweeneyId,
                                            first_name: 'C. Rufus',
                                            last_name: 'Sweeney',
                                            is_active: true
                                        }
                                    }],
                                    error: null
                                })
                            })
                        })
                    })
                }
            }

            if (table === 'provider_availability') {
                return {
                    select: () => ({
                        in: () => ({
                            eq: () => ({
                                eq: () => Promise.resolve({
                                    data: [{
                                        provider_id: drSweeneyId,
                                        day_of_week: 1, // Monday
                                        start_time: '17:00:00',
                                        end_time: '19:00:00',
                                        is_recurring: true
                                    }],
                                    error: null
                                })
                            })
                        })
                    })
                }
            }

            if (table === 'availability_exceptions') {
                return {
                    select: () => ({
                        in: () => ({
                            eq: () => Promise.resolve({
                                data: [], // No exceptions for 2025-09-16
                                error: null
                            })
                        })
                    })
                }
            }

            return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }
        })

        const request = new NextRequest('http://localhost:3000/api/merged-availability', {
            method: 'POST',
            body: JSON.stringify({
                payer_id: 'test-payer-id',
                date: '2025-09-16'
            })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.availableSlots).toHaveLength(2) // 17:00-18:00 and 18:00-19:00
        expect(data.data.exceptionsCount).toBe(0)

        // Verify slot details
        const slots = data.data.availableSlots
        expect(slots[0].provider_id).toBe(drSweeneyId)
        expect(slots[1].provider_id).toBe(drSweeneyId)
    })

    test('Provider with custom_hours exception should use exception times', async () => {
        const drSweeneyId = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'

        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'provider_payer_networks') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => ({
                                eq: () => Promise.resolve({
                                    data: [{
                                        provider_id: drSweeneyId,
                                        providers: {
                                            id: drSweeneyId,
                                            first_name: 'C. Rufus',
                                            last_name: 'Sweeney',
                                            is_active: true
                                        }
                                    }],
                                    error: null
                                })
                            })
                        })
                    })
                }
            }

            if (table === 'provider_availability') {
                return {
                    select: () => ({
                        in: () => ({
                            eq: () => ({
                                eq: () => Promise.resolve({
                                    data: [{
                                        provider_id: drSweeneyId,
                                        day_of_week: 2, // Tuesday
                                        start_time: '09:00:00',
                                        end_time: '17:00:00',
                                        is_recurring: true
                                    }],
                                    error: null
                                })
                            })
                        })
                    })
                }
            }

            if (table === 'availability_exceptions') {
                return {
                    select: () => ({
                        in: () => ({
                            eq: () => Promise.resolve({
                                data: [{
                                    provider_id: drSweeneyId,
                                    exception_date: '2025-09-17',
                                    exception_type: 'custom_hours',
                                    start_time: '14:00:00',
                                    end_time: '16:00:00'
                                }],
                                error: null
                            })
                        })
                    })
                }
            }

            return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }
        })

        const request = new NextRequest('http://localhost:3000/api/merged-availability', {
            method: 'POST',
            body: JSON.stringify({
                payer_id: 'test-payer-id',
                date: '2025-09-17'
            })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.availableSlots).toHaveLength(2) // 14:00-15:00 and 15:00-16:00 (custom hours)
        expect(data.data.exceptionsCount).toBe(1)
    })
})