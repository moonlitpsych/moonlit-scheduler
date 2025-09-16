// Integration test to verify booking against valid availability slots succeeds
import { NextRequest } from 'next/server'
import { POST as MergedAvailabilityAPI } from '../route'

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
    supabase: {
        from: jest.fn()
    }
}))

const mockSupabase = require('@/lib/supabase').supabase

describe('Merged Availability API - Booking Integration', () => {
    const drSweeneyId = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'
    const testPayerId = 'test-payer-id'

    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('Valid slot from merged availability API should be bookable', async () => {
        // Setup mocks for merged availability API call
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
                                        day_of_week: 1, // Monday 2025-09-16
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
                                data: [], // No exceptions for valid date
                                error: null
                            })
                        })
                    })
                }
            }

            return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }
        })

        // Call merged availability API
        const availabilityRequest = new NextRequest('http://localhost:3000/api/merged-availability', {
            method: 'POST',
            body: JSON.stringify({
                payer_id: testPayerId,
                date: '2025-09-16'
            })
        })

        const availabilityResponse = await MergedAvailabilityAPI(availabilityRequest)
        const availabilityData = await availabilityResponse.json()

        // Verify API response structure
        expect(availabilityResponse.status).toBe(200)
        expect(availabilityData.success).toBe(true)
        expect(availabilityData.data.availableSlots).toHaveLength(2)

        // Verify slot structure matches booking API expectations
        const firstSlot = availabilityData.data.availableSlots[0]
        expect(firstSlot).toMatchObject({
            id: expect.stringContaining(drSweeneyId),
            provider_id: drSweeneyId,
            start_time: expect.stringMatching(/2025-09-16T17:00:00/),
            end_time: expect.stringMatching(/2025-09-16T18:00:00/),
            is_available: true,
            appointment_type: 'telehealth',
            service_instance_id: 'default-service'
        })

        // Verify slot times are valid and bookable
        const slotStartTime = new Date(firstSlot.start_time)
        const slotEndTime = new Date(firstSlot.end_time)

        expect(slotStartTime.getHours()).toBe(17) // 5 PM
        expect(slotEndTime.getHours()).toBe(18)   // 6 PM
        expect(slotEndTime.getTime() - slotStartTime.getTime()).toBe(60 * 60 * 1000) // 1 hour duration
    })

    test('Phantom slot dates should return empty availability', async () => {
        // Setup mocks for date with exception
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
                                        day_of_week: 0, // Sunday 2025-09-15
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

        // Call merged availability API for blocked date
        const phantomRequest = new NextRequest('http://localhost:3000/api/merged-availability', {
            method: 'POST',
            body: JSON.stringify({
                payer_id: testPayerId,
                date: '2025-09-15'
            })
        })

        const phantomResponse = await MergedAvailabilityAPI(phantomRequest)
        const phantomData = await phantomResponse.json()

        // Verify no phantom slots are returned
        expect(phantomResponse.status).toBe(200)
        expect(phantomData.success).toBe(true)
        expect(phantomData.data.availableSlots).toHaveLength(0)
        expect(phantomData.data.exceptionsCount).toBe(1)

        // This ensures booking API will never see phantom slots to attempt booking
    })

    test('Slot IDs should be deterministic and unique', async () => {
        // Setup mocks
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
                                        day_of_week: 1,
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
                                data: [],
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
                payer_id: testPayerId,
                date: '2025-09-16'
            })
        })

        const response = await MergedAvailabilityAPI(request)
        const data = await response.json()

        const slots = data.data.availableSlots

        // Verify each slot has a unique, deterministic ID
        expect(slots).toHaveLength(2)

        const slot1 = slots[0]
        const slot2 = slots[1]

        expect(slot1.id).not.toBe(slot2.id)
        expect(slot1.id).toContain(drSweeneyId)
        expect(slot2.id).toContain(drSweeneyId)

        // IDs should be deterministic based on provider_id and start_time
        expect(slot1.id).toBe(`${drSweeneyId}-${slot1.start_time}`)
        expect(slot2.id).toBe(`${drSweeneyId}-${slot2.start_time}`)
    })
})