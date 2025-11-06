/**
 * Zod validation schemas for booking requests
 * Ensures all input data is properly formatted and safe before processing
 */

import { z } from 'zod'

// Email validation regex
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

// Phone validation regex (US format with optional country code)
const phoneRegex = /^(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/

// UUID validation
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Patient schema for booking requests
 */
const patientSchema = z.object({
    firstName: z.string()
        .min(1, 'First name is required')
        .max(100, 'First name too long')
        .regex(/^[a-zA-Z\s'-]+$/, 'Invalid characters in first name'),

    lastName: z.string()
        .min(1, 'Last name is required')
        .max(100, 'Last name too long')
        .regex(/^[a-zA-Z\s'-]+$/, 'Invalid characters in last name'),

    email: z.string()
        .min(1, 'Email is required')
        .max(255, 'Email too long')
        .regex(emailRegex, 'Invalid email format')
        .toLowerCase()
        .trim(),

    phone: z.string()
        .min(10, 'Phone number must be at least 10 digits')
        .max(20, 'Phone number too long')
        .regex(phoneRegex, 'Invalid phone format. Use format: (555) 555-5555')
        .transform(val => {
            // Normalize phone to just digits
            return val.replace(/\D/g, '')
        }),

    dateOfBirth: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
        .refine((date) => {
            const d = new Date(date)
            return d instanceof Date && !isNaN(d.getTime())
        }, 'Invalid date')
        .refine((date) => {
            const d = new Date(date)
            const now = new Date()
            return d < now
        }, 'Date of birth must be in the past')
        .refine((date) => {
            const d = new Date(date)
            const minAge = new Date()
            minAge.setFullYear(minAge.getFullYear() - 120)
            return d > minAge
        }, 'Invalid date of birth')
})

/**
 * Main booking request schema
 */
export const bookingRequestSchema = z.object({
    // Provider and service
    providerId: z.string()
        .uuid('Invalid provider ID format')
        .min(1, 'Provider ID is required'),

    serviceInstanceId: z.string()
        .uuid('Invalid service instance ID format')
        .min(1, 'Service instance ID is required'),

    // Timing
    startTime: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'Start time must be in ISO format')
        .refine((date) => {
            const d = new Date(date)
            return d instanceof Date && !isNaN(d.getTime())
        }, 'Invalid start time')
        .refine((date) => {
            const d = new Date(date)
            const now = new Date()
            // Allow bookings up to 15 minutes in the past (clock sync issues)
            const minTime = new Date(now.getTime() - 15 * 60 * 1000)
            return d >= minTime
        }, 'Cannot book appointments in the past'),

    endTime: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'End time must be in ISO format')
        .refine((date) => {
            const d = new Date(date)
            return d instanceof Date && !isNaN(d.getTime())
        }, 'Invalid end time'),

    durationMinutes: z.number()
        .int('Duration must be an integer')
        .min(15, 'Appointment must be at least 15 minutes')
        .max(240, 'Appointment cannot exceed 4 hours'),

    // Insurance
    payerId: z.string()
        .uuid('Invalid payer ID format')
        .optional()
        .nullable(),

    memberId: z.string()
        .max(50, 'Member ID too long')
        .regex(/^[a-zA-Z0-9-]+$/, 'Invalid characters in member ID')
        .optional()
        .nullable(),

    groupNumber: z.string()
        .max(50, 'Group number too long')
        .regex(/^[a-zA-Z0-9-]+$/, 'Invalid characters in group number')
        .optional()
        .nullable(),

    planName: z.string()
        .max(100, 'Plan name too long')
        .optional()
        .nullable(),

    // Location
    locationType: z.enum(['telehealth', 'in-office'])
        .optional()
        .default('telehealth'),

    // Notes
    notes: z.string()
        .max(1000, 'Notes too long')
        .optional()
        .nullable(),

    // Patient data
    patient: patientSchema,

    // Tracking
    referralPartnerCode: z.string()
        .max(50, 'Referral code too long')
        .regex(/^[a-zA-Z0-9-_]+$/, 'Invalid characters in referral code')
        .optional()
        .nullable(),

    // Idempotency
    idempotencyKey: z.string()
        .min(1, 'Idempotency key required')
        .max(255, 'Idempotency key too long')
        .optional()
})
    .refine((data) => {
        // End time must be after start time
        const start = new Date(data.startTime)
        const end = new Date(data.endTime)
        return end > start
    }, {
        message: 'End time must be after start time',
        path: ['endTime']
    })
    .refine((data) => {
        // Duration should match time difference
        const start = new Date(data.startTime)
        const end = new Date(data.endTime)
        const calculatedMinutes = Math.round((end.getTime() - start.getTime()) / 60000)
        // Allow 5 minute tolerance
        return Math.abs(calculatedMinutes - data.durationMinutes) <= 5
    }, {
        message: 'Duration does not match start/end times',
        path: ['durationMinutes']
    })

/**
 * Type for validated booking request
 */
export type ValidatedBookingRequest = z.infer<typeof bookingRequestSchema>

/**
 * Validate a booking request and return formatted errors
 */
export function validateBookingRequest(data: unknown): {
    success: boolean
    data?: ValidatedBookingRequest
    errors?: Record<string, string>
} {
    try {
        const validated = bookingRequestSchema.parse(data)
        return { success: true, data: validated }
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors: Record<string, string> = {}
            // Add null check for error.errors array
            if (error.errors && Array.isArray(error.errors)) {
                error.errors.forEach(err => {
                    // Also check if err.path exists before calling join()
                    const path = (err.path && Array.isArray(err.path)) ? err.path.join('.') : 'unknown'
                    errors[path] = err.message || 'Validation error'
                })
            } else {
                errors.general = 'Validation failed with unknown error structure'
            }
            return { success: false, errors }
        }
        return {
            success: false,
            errors: { general: 'Invalid request format' }
        }
    }
}

/**
 * Sanitize patient data for logging (remove PII)
 */
export function sanitizePatientForLogging(patient: any) {
    return {
        firstName: patient?.firstName ? patient.firstName[0] + '***' : undefined,
        lastName: patient?.lastName ? patient.lastName[0] + '***' : undefined,
        email: patient?.email ? patient.email.replace(/^(.{2}).*(@.*)$/, '$1***$2') : undefined,
        phone: patient?.phone ? '***-***-' + patient.phone.slice(-4) : undefined,
        dateOfBirth: patient?.dateOfBirth ? '****-**-**' : undefined
    }
}