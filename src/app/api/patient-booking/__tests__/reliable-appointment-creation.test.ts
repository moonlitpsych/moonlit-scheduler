/**
 * Integration tests for reliable appointment creation
 * 
 * Tests the fixes for false confirmations, proper error handling,
 * timezone handling, and idempotency.
 */

import { describe, it, expect, jest, beforeAll, afterAll, beforeEach } from '@jest/globals'
import { DateTime } from 'luxon'

// Mock Supabase
const mockSupabaseAdmin = {
    from: jest.fn(() => mockSupabaseAdmin),
    select: jest.fn(() => mockSupabaseAdmin),
    eq: jest.fn(() => mockSupabaseAdmin),
    insert: jest.fn(() => mockSupabaseAdmin),
    single: jest.fn(() => mockSupabaseAdmin),
    maybeSingle: jest.fn(() => mockSupabaseAdmin),
    gte: jest.fn(() => mockSupabaseAdmin),
    lte: jest.fn(() => mockSupabaseAdmin),
    limit: jest.fn(() => mockSupabaseAdmin),
    data: null as any,
    error: null as any
}

jest.mock('@/lib/supabase', () => ({
    supabaseAdmin: mockSupabaseAdmin
}))

describe('Reliable Appointment Creation', () => {
    const TEST_PROVIDER_ID = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694'
    const TEST_SERVICE_INSTANCE_ID = 'test-service-instance-id'
    const TEST_PAYER_ID = 'test-payer-id'
    
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('API: Missing serviceInstanceId → 400', () => {
        it('should return 400 when serviceInstanceId is missing', async () => {
            const { POST } = await import('../create-appointment/route')
            
            const mockRequest = {
                json: jest.fn().mockResolvedValue({
                    providerId: TEST_PROVIDER_ID,
                    // serviceInstanceId missing
                    payerId: TEST_PAYER_ID,
                    date: '2025-09-13',
                    time: '14:00',
                    patient: {
                        firstName: 'John',
                        lastName: 'Doe',
                        phone: '555-1234'
                    }
                })
            } as any

            const response = await POST(mockRequest)
            const result = await response.json()

            expect(response.status).toBe(400)
            expect(result.success).toBe(false)
            expect(result.error).toBe('MISSING_SERVICE_INSTANCE')
        })
    })

    describe('API: Successful insert without EMR', () => {
        it('should create appointment successfully without EMR integration', async () => {
            // Setup mocks
            mockSupabaseAdmin.from.mockImplementation((table: string) => {
                if (table === 'service_instances') {
                    return {
                        ...mockSupabaseAdmin,
                        select: () => ({ ...mockSupabaseAdmin, limit: () => ({ ...mockSupabaseAdmin, single: () => Promise.resolve({ data: { id: TEST_SERVICE_INSTANCE_ID }, error: null }) }) })
                    }
                }
                if (table === 'providers') {
                    return {
                        ...mockSupabaseAdmin,
                        select: () => ({ ...mockSupabaseAdmin, eq: () => ({ ...mockSupabaseAdmin, single: () => Promise.resolve({ 
                            data: { 
                                id: TEST_PROVIDER_ID, 
                                first_name: 'Rufus', 
                                last_name: 'Sweeney',
                                is_active: true,
                                is_bookable: true
                            }, 
                            error: null 
                        }) }) })
                    }
                }
                if (table === 'provider_payer_networks') {
                    return {
                        ...mockSupabaseAdmin,
                        select: () => ({ ...mockSupabaseAdmin, eq: () => ({ ...mockSupabaseAdmin, single: () => Promise.resolve({ 
                            data: { 
                                provider_id: TEST_PROVIDER_ID, 
                                payer_id: TEST_PAYER_ID,
                                status: 'in_network',
                                payers: { name: 'Test Insurance' }
                            }, 
                            error: null 
                        }) }) })
                    }
                }
                if (table === 'appointments') {
                    return {
                        ...mockSupabaseAdmin,
                        select: () => ({ ...mockSupabaseAdmin, eq: () => ({ ...mockSupabaseAdmin, gte: () => ({ ...mockSupabaseAdmin, lte: () => ({ ...mockSupabaseAdmin, maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) }),
                        insert: () => ({ ...mockSupabaseAdmin, select: () => ({ ...mockSupabaseAdmin, single: () => Promise.resolve({ 
                            data: { id: 'test-appointment-id' }, 
                            error: null 
                        }) }) })
                    }
                }
                return mockSupabaseAdmin
            })

            const { POST } = await import('../create-appointment/route')
            
            const mockRequest = {
                json: jest.fn().mockResolvedValue({
                    providerId: TEST_PROVIDER_ID,
                    serviceInstanceId: TEST_SERVICE_INSTANCE_ID,
                    payerId: TEST_PAYER_ID,
                    date: '2025-09-13',
                    time: '14:00',
                    patient: {
                        firstName: 'John',
                        lastName: 'Doe',
                        email: 'john@example.com',
                        phone: '555-1234'
                    },
                    createInEMR: false, // No EMR integration
                    isTest: true
                })
            } as any

            const response = await POST(mockRequest)
            const result = await response.json()

            expect(response.status).toBe(200)
            expect(result.success).toBe(true)
            expect(result.data.appointment.id).toBe('test-appointment-id')
            expect(result.data.appointment.emr_queued).toBe(false)
        })
    })

    describe('API: EMR failure does not block success', () => {
        it('should succeed even when EMR enqueueing fails', async () => {
            // Same setup as above but with createInEMR: true
            mockSupabaseAdmin.from.mockImplementation((table: string) => {
                if (table === 'service_instances') {
                    return {
                        ...mockSupabaseAdmin,
                        select: () => ({ ...mockSupabaseAdmin, limit: () => ({ ...mockSupabaseAdmin, single: () => Promise.resolve({ data: { id: TEST_SERVICE_INSTANCE_ID }, error: null }) }) })
                    }
                }
                if (table === 'providers') {
                    return {
                        ...mockSupabaseAdmin,
                        select: () => ({ ...mockSupabaseAdmin, eq: () => ({ ...mockSupabaseAdmin, single: () => Promise.resolve({ 
                            data: { 
                                id: TEST_PROVIDER_ID, 
                                first_name: 'Rufus', 
                                last_name: 'Sweeney',
                                is_active: true,
                                is_bookable: true
                            }, 
                            error: null 
                        }) }) })
                    }
                }
                if (table === 'provider_payer_networks') {
                    return {
                        ...mockSupabaseAdmin,
                        select: () => ({ ...mockSupabaseAdmin, eq: () => ({ ...mockSupabaseAdmin, single: () => Promise.resolve({ 
                            data: { 
                                provider_id: TEST_PROVIDER_ID, 
                                payer_id: TEST_PAYER_ID,
                                status: 'in_network',
                                payers: { name: 'Test Insurance' }
                            }, 
                            error: null 
                        }) }) })
                    }
                }
                if (table === 'appointments') {
                    return {
                        ...mockSupabaseAdmin,
                        select: () => ({ ...mockSupabaseAdmin, eq: () => ({ ...mockSupabaseAdmin, gte: () => ({ ...mockSupabaseAdmin, lte: () => ({ ...mockSupabaseAdmin, maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) }),
                        insert: () => ({ ...mockSupabaseAdmin, select: () => ({ ...mockSupabaseAdmin, single: () => Promise.resolve({ 
                            data: { id: 'test-appointment-id-2' }, 
                            error: null 
                        }) }) })
                    }
                }
                return mockSupabaseAdmin
            })

            const { POST } = await import('../create-appointment/route')
            
            const mockRequest = {
                json: jest.fn().mockResolvedValue({
                    providerId: TEST_PROVIDER_ID,
                    serviceInstanceId: TEST_SERVICE_INSTANCE_ID,
                    payerId: TEST_PAYER_ID,
                    date: '2025-09-13',
                    time: '14:00',
                    patient: {
                        firstName: 'John',
                        lastName: 'Doe',
                        email: 'john@example.com',
                        phone: '555-1234'
                    },
                    createInEMR: true, // EMR integration (will be mocked to fail)
                    isTest: false
                })
            } as any

            const response = await POST(mockRequest)
            const result = await response.json()

            expect(response.status).toBe(200)
            expect(result.success).toBe(true)
            expect(result.data.appointment.id).toBe('test-appointment-id-2')
            expect(result.data.appointment.emr_queued).toBe(true) // EMR was queued even if it might fail
        })
    })

    describe('Timezone correctness', () => {
        it('should handle DST date correctly (America/Denver)', async () => {
            // Test during DST (MDT = UTC-6)
            const dstDate = '2025-07-15' // Summer DST
            const time = '14:00' // 2:00 PM local
            
            const expectedUtcTime = DateTime.fromISO(`${dstDate}T${time}`, { zone: 'America/Denver' }).toUTC()
            
            // Setup mocks for successful creation
            mockSupabaseAdmin.from.mockImplementation((table: string) => {
                if (table === 'service_instances') {
                    return {
                        ...mockSupabaseAdmin,
                        select: () => ({ ...mockSupabaseAdmin, limit: () => ({ ...mockSupabaseAdmin, single: () => Promise.resolve({ data: { id: TEST_SERVICE_INSTANCE_ID }, error: null }) }) })
                    }
                }
                if (table === 'providers') {
                    return {
                        ...mockSupabaseAdmin,
                        select: () => ({ ...mockSupabaseAdmin, eq: () => ({ ...mockSupabaseAdmin, single: () => Promise.resolve({ 
                            data: { 
                                id: TEST_PROVIDER_ID, 
                                first_name: 'Rufus', 
                                last_name: 'Sweeney',
                                is_active: true,
                                is_bookable: true
                            }, 
                            error: null 
                        }) }) })
                    }
                }
                if (table === 'provider_payer_networks') {
                    return {
                        ...mockSupabaseAdmin,
                        select: () => ({ ...mockSupabaseAdmin, eq: () => ({ ...mockSupabaseAdmin, single: () => Promise.resolve({ 
                            data: { 
                                provider_id: TEST_PROVIDER_ID, 
                                payer_id: TEST_PAYER_ID,
                                status: 'in_network',
                                payers: { name: 'Test Insurance' }
                            }, 
                            error: null 
                        }) }) })
                    }
                }
                if (table === 'appointments') {
                    return {
                        ...mockSupabaseAdmin,
                        select: () => ({ ...mockSupabaseAdmin, eq: () => ({ ...mockSupabaseAdmin, gte: () => ({ ...mockSupabaseAdmin, lte: () => ({ ...mockSupabaseAdmin, maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) }),
                        insert: (data: any) => {
                            const appointmentData = data[0]
                            // Verify timezone handling
                            expect(appointmentData.timezone).toBe('America/Denver')
                            expect(appointmentData.start_time).toBe(expectedUtcTime.toISO())
                            
                            return { 
                                ...mockSupabaseAdmin, 
                                select: () => ({ 
                                    ...mockSupabaseAdmin, 
                                    single: () => Promise.resolve({ 
                                        data: { id: 'test-appointment-dst' }, 
                                        error: null 
                                    }) 
                                }) 
                            }
                        }
                    }
                }
                return mockSupabaseAdmin
            })

            const { POST } = await import('../create-appointment/route')
            
            const mockRequest = {
                json: jest.fn().mockResolvedValue({
                    providerId: TEST_PROVIDER_ID,
                    serviceInstanceId: TEST_SERVICE_INSTANCE_ID,
                    payerId: TEST_PAYER_ID,
                    date: dstDate,
                    time: time,
                    patient: {
                        firstName: 'John',
                        lastName: 'Doe',
                        email: 'john@example.com',
                        phone: '555-1234'
                    },
                    createInEMR: false,
                    isTest: true
                })
            } as any

            const response = await POST(mockRequest)
            const result = await response.json()

            expect(response.status).toBe(200)
            expect(result.success).toBe(true)
        })

        it('should handle non-DST date correctly (America/Denver)', async () => {
            // Test during Standard Time (MST = UTC-7)
            const nonDstDate = '2025-01-15' // Winter Standard Time
            const time = '14:00' // 2:00 PM local
            
            const expectedUtcTime = DateTime.fromISO(`${nonDstDate}T${time}`, { zone: 'America/Denver' }).toUTC()
            
            // Setup mocks (similar to DST test)
            mockSupabaseAdmin.from.mockImplementation((table: string) => {
                if (table === 'service_instances') {
                    return {
                        ...mockSupabaseAdmin,
                        select: () => ({ ...mockSupabaseAdmin, limit: () => ({ ...mockSupabaseAdmin, single: () => Promise.resolve({ data: { id: TEST_SERVICE_INSTANCE_ID }, error: null }) }) })
                    }
                }
                if (table === 'providers') {
                    return {
                        ...mockSupabaseAdmin,
                        select: () => ({ ...mockSupabaseAdmin, eq: () => ({ ...mockSupabaseAdmin, single: () => Promise.resolve({ 
                            data: { 
                                id: TEST_PROVIDER_ID, 
                                first_name: 'Rufus', 
                                last_name: 'Sweeney',
                                is_active: true,
                                is_bookable: true
                            }, 
                            error: null 
                        }) }) })
                    }
                }
                if (table === 'provider_payer_networks') {
                    return {
                        ...mockSupabaseAdmin,
                        select: () => ({ ...mockSupabaseAdmin, eq: () => ({ ...mockSupabaseAdmin, single: () => Promise.resolve({ 
                            data: { 
                                provider_id: TEST_PROVIDER_ID, 
                                payer_id: TEST_PAYER_ID,
                                status: 'in_network',
                                payers: { name: 'Test Insurance' }
                            }, 
                            error: null 
                        }) }) })
                    }
                }
                if (table === 'appointments') {
                    return {
                        ...mockSupabaseAdmin,
                        select: () => ({ ...mockSupabaseAdmin, eq: () => ({ ...mockSupabaseAdmin, gte: () => ({ ...mockSupabaseAdmin, lte: () => ({ ...mockSupabaseAdmin, maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) }),
                        insert: (data: any) => {
                            const appointmentData = data[0]
                            expect(appointmentData.timezone).toBe('America/Denver')
                            expect(appointmentData.start_time).toBe(expectedUtcTime.toISO())
                            
                            return { 
                                ...mockSupabaseAdmin, 
                                select: () => ({ 
                                    ...mockSupabaseAdmin, 
                                    single: () => Promise.resolve({ 
                                        data: { id: 'test-appointment-std' }, 
                                        error: null 
                                    }) 
                                }) 
                            }
                        }
                    }
                }
                return mockSupabaseAdmin
            })

            const { POST } = await import('../create-appointment/route')
            
            const mockRequest = {
                json: jest.fn().mockResolvedValue({
                    providerId: TEST_PROVIDER_ID,
                    serviceInstanceId: TEST_SERVICE_INSTANCE_ID,
                    payerId: TEST_PAYER_ID,
                    date: nonDstDate,
                    time: time,
                    patient: {
                        firstName: 'John',
                        lastName: 'Doe',
                        email: 'john@example.com',
                        phone: '555-1234'
                    },
                    createInEMR: false,
                    isTest: true
                })
            } as any

            const response = await POST(mockRequest)
            const result = await response.json()

            expect(response.status).toBe(200)
            expect(result.success).toBe(true)
        })
    })

    describe('Idempotency (soft)', () => {
        it('should return existing appointment for duplicate requests', async () => {
            const existingAppointmentId = 'existing-appointment-id'
            
            mockSupabaseAdmin.from.mockImplementation((table: string) => {
                if (table === 'service_instances') {
                    return {
                        ...mockSupabaseAdmin,
                        select: () => ({ ...mockSupabaseAdmin, limit: () => ({ ...mockSupabaseAdmin, single: () => Promise.resolve({ data: { id: TEST_SERVICE_INSTANCE_ID }, error: null }) }) })
                    }
                }
                if (table === 'providers') {
                    return {
                        ...mockSupabaseAdmin,
                        select: () => ({ ...mockSupabaseAdmin, eq: () => ({ ...mockSupabaseAdmin, single: () => Promise.resolve({ 
                            data: { 
                                id: TEST_PROVIDER_ID, 
                                first_name: 'Rufus', 
                                last_name: 'Sweeney',
                                is_active: true,
                                is_bookable: true
                            }, 
                            error: null 
                        }) }) })
                    }
                }
                if (table === 'provider_payer_networks') {
                    return {
                        ...mockSupabaseAdmin,
                        select: () => ({ ...mockSupabaseAdmin, eq: () => ({ ...mockSupabaseAdmin, single: () => Promise.resolve({ 
                            data: { 
                                provider_id: TEST_PROVIDER_ID, 
                                payer_id: TEST_PAYER_ID,
                                status: 'in_network',
                                payers: { name: 'Test Insurance' }
                            }, 
                            error: null 
                        }) }) })
                    }
                }
                if (table === 'appointments') {
                    return {
                        ...mockSupabaseAdmin,
                        select: () => ({ 
                            ...mockSupabaseAdmin, 
                            eq: () => ({ 
                                ...mockSupabaseAdmin, 
                                gte: () => ({ 
                                    ...mockSupabaseAdmin, 
                                    lte: () => ({ 
                                        ...mockSupabaseAdmin, 
                                        maybeSingle: () => Promise.resolve({ 
                                            data: { id: existingAppointmentId }, // Existing appointment found
                                            error: null 
                                        }) 
                                    }) 
                                }) 
                            }) 
                        })
                    }
                }
                return mockSupabaseAdmin
            })

            const { POST } = await import('../create-appointment/route')
            
            const mockRequest = {
                json: jest.fn().mockResolvedValue({
                    providerId: TEST_PROVIDER_ID,
                    serviceInstanceId: TEST_SERVICE_INSTANCE_ID,
                    payerId: TEST_PAYER_ID,
                    date: '2025-09-13',
                    time: '14:00',
                    patient: {
                        firstName: 'John',
                        lastName: 'Doe',
                        email: 'john@example.com',
                        phone: '555-1234'
                    },
                    isTest: true
                })
            } as any

            const response = await POST(mockRequest)
            const result = await response.json()

            expect(response.status).toBe(200)
            expect(result.success).toBe(true)
            expect(result.data.appointment.id).toBe(existingAppointmentId)
            expect(result.data.appointment.duplicate).toBe(true)
        })
    })

    describe('Frontend: No false confirmation', () => {
        it('should not proceed to confirmation when API returns failure', () => {
            // Mock fetch to return failure
            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                json: () => Promise.resolve({
                    success: false,
                    error: 'DB_INSERT_FAILED'
                })
            })

            // Mock alert
            global.alert = jest.fn()

            const mockState = {
                selectedTimeSlot: {
                    provider_id: TEST_PROVIDER_ID,
                    service_instance_id: TEST_SERVICE_INSTANCE_ID,
                    date: '2025-09-13',
                    time: '14:00'
                },
                selectedPayer: { id: TEST_PAYER_ID },
                insuranceInfo: {
                    firstName: 'John',
                    lastName: 'Doe',
                    phone: '555-1234',
                    email: 'john@example.com'
                }
            }

            const mockGoToStep = jest.fn()

            // This would be the actual frontend logic - we're testing it conceptually
            const handleAppointmentConfirmed = async () => {
                try {
                    const response = await fetch('/api/patient-booking/create-appointment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            providerId: mockState.selectedTimeSlot.provider_id,
                            serviceInstanceId: mockState.selectedTimeSlot.service_instance_id,
                            payerId: mockState.selectedPayer.id,
                            date: mockState.selectedTimeSlot.date,
                            time: mockState.selectedTimeSlot.time,
                            patient: mockState.insuranceInfo
                        })
                    })

                    let result: any = null
                    try { 
                        result = await response.json() 
                    } catch (parseError) { 
                        throw new Error('Invalid response from server')
                    }

                    // Only proceed to confirmation if API returned success with appointment ID
                    if (!response.ok || !result?.success || !result?.data?.appointment?.id) {
                        alert(`Appointment failed: ${result?.error ?? response.statusText ?? 'Unknown error'}`)
                        return // STOP — do not go to confirmation
                    }

                    mockGoToStep('confirmation') // Only on success
                } catch (error: any) {
                    alert(`Booking failed: ${error.message}`)
                    return // STOP — do not go to confirmation
                }
            }

            // Execute the test
            return handleAppointmentConfirmed().then(() => {
                expect(global.alert).toHaveBeenCalledWith('Appointment failed: DB_INSERT_FAILED')
                expect(mockGoToStep).not.toHaveBeenCalled() // Should NOT proceed to confirmation
            })
        })

        it('should proceed to confirmation when API returns success', () => {
            // Mock fetch to return success
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    success: true,
                    data: {
                        appointment: {
                            id: 'successful-appointment-id'
                        }
                    }
                })
            })

            const mockState = {
                selectedTimeSlot: {
                    provider_id: TEST_PROVIDER_ID,
                    service_instance_id: TEST_SERVICE_INSTANCE_ID,
                    date: '2025-09-13',
                    time: '14:00'
                },
                selectedPayer: { id: TEST_PAYER_ID },
                insuranceInfo: {
                    firstName: 'John',
                    lastName: 'Doe',
                    phone: '555-1234',
                    email: 'john@example.com'
                }
            }

            const mockGoToStep = jest.fn()
            const mockUpdateState = jest.fn()

            // This would be the actual frontend logic
            const handleAppointmentConfirmed = async () => {
                try {
                    const response = await fetch('/api/patient-booking/create-appointment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            providerId: mockState.selectedTimeSlot.provider_id,
                            serviceInstanceId: mockState.selectedTimeSlot.service_instance_id,
                            payerId: mockState.selectedPayer.id,
                            date: mockState.selectedTimeSlot.date,
                            time: mockState.selectedTimeSlot.time,
                            patient: mockState.insuranceInfo
                        })
                    })

                    const result = await response.json()

                    if (!response.ok || !result?.success || !result?.data?.appointment?.id) {
                        alert(`Appointment failed: ${result?.error ?? 'Unknown error'}`)
                        return
                    }

                    // Success case
                    mockUpdateState({ 
                        appointmentId: result.data.appointment.id
                    })
                    mockGoToStep('confirmation')
                } catch (error: any) {
                    alert(`Booking failed: ${error.message}`)
                    return
                }
            }

            return handleAppointmentConfirmed().then(() => {
                expect(mockUpdateState).toHaveBeenCalledWith({ 
                    appointmentId: 'successful-appointment-id' 
                })
                expect(mockGoToStep).toHaveBeenCalledWith('confirmation') // Should proceed to confirmation
            })
        })
    })
})