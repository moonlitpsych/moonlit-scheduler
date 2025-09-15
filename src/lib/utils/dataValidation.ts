// src/lib/utils/dataValidation.ts
// Runtime data validation utilities to prevent field mapping errors

export interface ValidationResult {
    isValid: boolean
    errors: string[]
    warnings: string[]
    normalizedData?: any
}

// Field mapping schemas for critical API responses
export const API_SCHEMAS = {
    AVAILABLE_SLOT: {
        // Primary field names (what CalendarView expects)
        primary: {
            provider_id: 'string',
            provider_name: 'string', 
            available: 'boolean',
            duration_minutes: 'number',
            start_time: 'string',
            end_time: 'string',
            service_instance_id: 'string'
        },
        // Alternative field names (what API might return)
        alternatives: {
            provider_id: ['providerId', 'provider_id', 'id'],
            provider_name: ['providerName', 'provider_name', 'name', 'full_name'],
            available: ['isAvailable', 'available', 'is_available'],
            duration_minutes: ['duration', 'duration_minutes', 'durationMinutes'],
            start_time: ['start_time', 'startTime', 'time'], 
            end_time: ['end_time', 'endTime'],
            service_instance_id: ['service_instance_id', 'serviceInstanceId']
        },
        // Required fields that must exist in some form
        required: ['provider_id', 'provider_name', 'available']
    },
    PROVIDER_DATA: {
        primary: {
            id: 'string',
            first_name: 'string',
            last_name: 'string',
            is_bookable: 'boolean',
            languages_spoken: 'array'
        },
        alternatives: {
            id: ['id', 'provider_id', 'providerId'],
            first_name: ['first_name', 'firstName', 'fname'],
            last_name: ['last_name', 'lastName', 'lname'],
            is_bookable: ['is_bookable', 'isBookable', 'bookable'],
            languages_spoken: ['languages_spoken', 'languages', 'languagesSpoken']
        },
        required: ['id', 'first_name', 'last_name', 'is_bookable']
    }
} as const

export type SchemaType = keyof typeof API_SCHEMAS

/**
 * Validates and normalizes API response data to prevent field mapping errors
 */
export function validateAndNormalizeData<T extends SchemaType>(
    data: any[], 
    schemaType: T,
    context: string = 'API Response'
): ValidationResult {
    const schema = API_SCHEMAS[schemaType]
    const errors: string[] = []
    const warnings: string[] = []
    const normalizedData: any[] = []

    if (!Array.isArray(data)) {
        return {
            isValid: false,
            errors: [`${context}: Expected array, got ${typeof data}`],
            warnings: []
        }
    }

    data.forEach((item, index) => {
        const normalizedItem: any = {}
        const itemErrors: string[] = []
        const itemWarnings: string[] = []

        // Validate and normalize each required field
        Object.entries(schema.primary).forEach(([primaryField, expectedType]) => {
            const alternatives = schema.alternatives[primaryField as keyof typeof schema.alternatives] || [primaryField]
            let foundValue: any = undefined
            let foundField: string | undefined = undefined

            // Try to find the field using alternative names
            for (const altField of alternatives) {
                if (item.hasOwnProperty(altField)) {
                    foundValue = item[altField]
                    foundField = altField
                    break
                }
            }

            if (foundValue !== undefined) {
                // Validate type
                const actualType = Array.isArray(foundValue) ? 'array' : typeof foundValue
                if (actualType !== expectedType) {
                    itemWarnings.push(`Item ${index}: Field '${primaryField}' expected ${expectedType}, got ${actualType}`)
                }

                // Store with primary field name
                normalizedItem[primaryField] = foundValue

                // Warn if using alternative field name
                if (foundField !== primaryField) {
                    itemWarnings.push(`Item ${index}: Using alternative field '${foundField}' for '${primaryField}'`)
                }
            } else if (schema.required.includes(primaryField)) {
                itemErrors.push(`Item ${index}: Missing required field '${primaryField}' (tried: ${alternatives.join(', ')})`)
            }
        })

        // Copy any additional fields from original item
        Object.keys(item).forEach(key => {
            if (!normalizedItem.hasOwnProperty(key)) {
                normalizedItem[key] = item[key]
            }
        })

        errors.push(...itemErrors)
        warnings.push(...itemWarnings)
        normalizedData.push(normalizedItem)
    })

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        normalizedData: errors.length === 0 ? normalizedData : undefined
    }
}

/**
 * Smart field mapper that handles common API response variations
 */
export function mapApiSlotToTimeSlot(apiSlot: any): any {
    const validation = validateAndNormalizeData([apiSlot], 'AVAILABLE_SLOT', 'API Slot')
    
    if (!validation.isValid) {
        console.warn('⚠️ API Slot validation failed:', validation.errors)
        // Fall back to best-effort mapping
        return mapApiSlotFallback(apiSlot)
    }

    if (validation.warnings.length > 0) {
        console.warn('⚠️ API Slot mapping warnings:', validation.warnings)
    }

    const normalizedSlot = validation.normalizedData![0]
    
    try {
        // Convert to TimeSlot format expected by CalendarView
        let startDateTime: string
        
        // Handle different datetime formats
        if (normalizedSlot.start_time && normalizedSlot.start_time.includes('T')) {
            // Already a full ISO datetime
            startDateTime = normalizedSlot.start_time
        } else if (apiSlot.date && apiSlot.time) {
            // Construct from separate date and time
            const timeWithSeconds = apiSlot.time.includes(':') ? 
                (apiSlot.time.split(':').length === 2 ? `${apiSlot.time}:00` : apiSlot.time) : 
                `${apiSlot.time}:00:00`
            startDateTime = `${apiSlot.date}T${timeWithSeconds}`
        } else if (normalizedSlot.start_time) {
            // Try to parse just time and use today's date
            const today = new Date().toISOString().split('T')[0]
            const timeWithSeconds = normalizedSlot.start_time.includes(':') ? 
                (normalizedSlot.start_time.split(':').length === 2 ? `${normalizedSlot.start_time}:00` : normalizedSlot.start_time) : 
                `${normalizedSlot.start_time}:00:00`
            startDateTime = `${today}T${timeWithSeconds}`
        } else {
            console.error('🚨 Cannot construct datetime from slot:', apiSlot)
            return mapApiSlotFallback(apiSlot)
        }
        
        const duration = normalizedSlot.duration_minutes || apiSlot.duration || 60
        
        // Validate the date string before using it
        const startDate = new Date(startDateTime)
        if (isNaN(startDate.getTime())) {
            console.error('🚨 Invalid startDateTime after construction:', startDateTime, 'from slot:', apiSlot)
            return mapApiSlotFallback(apiSlot)
        }
        
        const endTime = normalizedSlot.end_time || (() => {
            const endDate = new Date(startDate.getTime() + duration * 60 * 1000)
            if (isNaN(endDate.getTime())) {
                console.error('🚨 Invalid endDate calculation for:', startDateTime, duration)
                return new Date(startDate.getTime() + 60 * 60 * 1000).toISOString() // Default to 1 hour
            }
            return endDate.toISOString()
        })()

        return {
            start_time: startDateTime,
            end_time: endTime,
            provider_id: normalizedSlot.provider_id,
            available: normalizedSlot.available,
            duration_minutes: duration,
            provider_name: normalizedSlot.provider_name,
            service_instance_id: normalizedSlot.service_instance_id || 'default-service-instance',
            // Preserve original format for compatibility
            date: apiSlot.date,
            time: apiSlot.time,
            providerId: normalizedSlot.provider_id
        }
    } catch (error) {
        console.error('🚨 Error in mapApiSlotToTimeSlot:', error, 'slot:', apiSlot)
        return mapApiSlotFallback(apiSlot)
    }
}

/**
 * Fallback mapping when validation fails
 */
function mapApiSlotFallback(apiSlot: any): any {
    console.warn('🚨 Using fallback API slot mapping for:', apiSlot)
    
    try {
        // Handle completely empty slot objects or objects with minimal data
        if (!apiSlot || Object.keys(apiSlot).length === 0) {
            console.error('🚨 Empty slot object received - should have been filtered upstream')
            // Return null or throw error to indicate this should not be processed
            throw new Error('Empty slot object passed to fallback mapping - check filtering logic')
        }
        
        // Handle objects that only have invalid/minimal data
        if (Object.keys(apiSlot).length <= 2 && 
            !apiSlot.provider_id && !apiSlot.providerId && !apiSlot.id &&
            !apiSlot.date && !apiSlot.start_time) {
            console.error('🚨 Slot object with insufficient data:', apiSlot)
            throw new Error('Slot object missing critical fields - should have been filtered upstream')
        }
        
        let startDateTime: string
        if (apiSlot.start_time && apiSlot.start_time.includes('T')) {
            startDateTime = apiSlot.start_time
        } else if (apiSlot.date && apiSlot.time) {
            const timeWithSeconds = apiSlot.time.includes(':') ? 
                (apiSlot.time.split(':').length === 2 ? `${apiSlot.time}:00` : apiSlot.time) : 
                `${apiSlot.time}:00:00`
            startDateTime = `${apiSlot.date}T${timeWithSeconds}`
        } else {
            // Last resort - use current time
            startDateTime = new Date().toISOString()
        }
        
        const duration = apiSlot.duration_minutes || apiSlot.duration || 60
        
        // Validate the date string
        const startDate = new Date(startDateTime)
        if (isNaN(startDate.getTime())) {
            console.error('🚨 Invalid date in fallback mapping:', startDateTime, 'slot:', apiSlot)
            // Try to create a valid date string
            const today = new Date()
            const fallbackDateTime = `${today.toISOString().split('T')[0]}T12:00:00`
            const fallbackStartDate = new Date(fallbackDateTime)
            
            return {
                start_time: fallbackDateTime,
                end_time: new Date(fallbackStartDate.getTime() + duration * 60 * 1000).toISOString(),
                provider_id: apiSlot.providerId || apiSlot.provider_id || apiSlot.id || 'unknown',
                available: apiSlot.isAvailable !== undefined ? apiSlot.isAvailable : apiSlot.available !== false,
                duration_minutes: duration,
                provider_name: apiSlot.providerName || apiSlot.provider_name || 
                              `${apiSlot.provider?.first_name || ''} ${apiSlot.provider?.last_name || ''}`.trim() ||
                              'Unknown Provider',
                service_instance_id: apiSlot.service_instance_id || apiSlot.serviceInstanceId || 'unknown',
                date: apiSlot.date,
                time: apiSlot.time,
                providerId: apiSlot.providerId || apiSlot.provider_id || apiSlot.id || 'unknown'
            }
        }

        const endTime = new Date(startDate.getTime() + duration * 60 * 1000)
        if (isNaN(endTime.getTime())) {
            console.error('🚨 Invalid end time calculation in fallback')
            // Use a default 1-hour duration
            const fallbackEndTime = new Date(startDate.getTime() + 60 * 60 * 1000)
            return {
                start_time: startDateTime,
                end_time: fallbackEndTime.toISOString(),
                provider_id: apiSlot.providerId || apiSlot.provider_id || apiSlot.id || 'unknown',
                available: apiSlot.isAvailable !== undefined ? apiSlot.isAvailable : apiSlot.available !== false,
                duration_minutes: 60,
                provider_name: apiSlot.providerName || apiSlot.provider_name || 
                              `${apiSlot.provider?.first_name || ''} ${apiSlot.provider?.last_name || ''}`.trim() ||
                              'Unknown Provider',
                service_instance_id: apiSlot.service_instance_id || apiSlot.serviceInstanceId || 'unknown',
                date: apiSlot.date,
                time: apiSlot.time,
                providerId: apiSlot.providerId || apiSlot.provider_id || apiSlot.id || 'unknown'
            }
        }

        return {
            start_time: startDateTime,
            end_time: endTime.toISOString(),
            provider_id: apiSlot.providerId || apiSlot.provider_id || apiSlot.id || 'unknown',
            available: apiSlot.isAvailable !== undefined ? apiSlot.isAvailable : apiSlot.available !== false,
            duration_minutes: duration,
            provider_name: apiSlot.providerName || apiSlot.provider_name || 
                          `${apiSlot.provider?.first_name || ''} ${apiSlot.provider?.last_name || ''}`.trim() ||
                          'Unknown Provider',
            service_instance_id: apiSlot.service_instance_id || apiSlot.serviceInstanceId || 'unknown',
            date: apiSlot.date,
            time: apiSlot.time,
            providerId: apiSlot.providerId || apiSlot.provider_id || apiSlot.id || 'unknown'
        }
    } catch (error) {
        console.error('🚨 Complete fallback failure:', error, 'slot:', apiSlot)
        // Return a minimal valid slot as last resort
        const now = new Date()
        return {
            start_time: now.toISOString(),
            end_time: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
            provider_id: 'unknown',
            available: true,
            duration_minutes: 60,
            provider_name: 'Unknown Provider',
            service_instance_id: 'unknown',
            date: now.toISOString().split('T')[0],
            time: now.toTimeString().slice(0, 5),
            providerId: 'unknown'
        }
    }
}

/**
 * Validates API response structure before processing
 */
export function validateApiResponse(response: any, expectedStructure: {
    success?: boolean
    data?: any
    [key: string]: any
}): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Check basic structure
    if (typeof response !== 'object' || response === null) {
        errors.push('Response must be an object')
        return { isValid: false, errors, warnings }
    }

    // Check success field
    if (expectedStructure.hasOwnProperty('success')) {
        if (!response.hasOwnProperty('success')) {
            errors.push('Response missing "success" field')
        } else if (typeof response.success !== 'boolean') {
            errors.push('"success" field must be boolean')
        }
    }

    // Check data field for successful responses
    if (response.success && expectedStructure.hasOwnProperty('data')) {
        if (!response.hasOwnProperty('data')) {
            errors.push('Successful response missing "data" field')
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    }
}

/**
 * Development-only validation wrapper
 */
export function devValidateApiData<T extends SchemaType>(
    data: any[],
    schemaType: T,
    context: string
): any[] {
    if (process.env.NODE_ENV !== 'development') {
        return data // Skip validation in production for performance
    }

    const validation = validateAndNormalizeData(data, schemaType, context)
    
    if (!validation.isValid) {
        console.error(`🚨 ${context} validation failed:`, validation.errors)
        console.table(data.slice(0, 3)) // Show first 3 items for debugging
    }
    
    if (validation.warnings.length > 0) {
        console.warn(`⚠️ ${context} validation warnings:`, validation.warnings)
    }

    return validation.normalizedData || data
}