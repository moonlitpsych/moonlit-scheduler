// src/types/database.ts
export interface Database {
    public: {
        Tables: {
            providers: {
                Row: {
                    id: string
                    first_name: string | null
                    last_name: string | null
                    title: string | null
                    profile_image_url: string | null
                    languages_spoken: string[] | null
                    telehealth_enabled: boolean | null
                    accepts_new_patients: boolean | null
                    booking_buffer_minutes: number | null
                    max_daily_appointments: number | null
                    athena_provider_id: string | null
                    calendar_source_id: string | null
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    first_name?: string | null
                    last_name?: string | null
                    title?: string | null
                    profile_image_url?: string | null
                    languages_spoken?: string[] | null
                    telehealth_enabled?: boolean | null
                    accepts_new_patients?: boolean | null
                    booking_buffer_minutes?: number | null
                    max_daily_appointments?: number | null
                    athena_provider_id?: string | null
                    calendar_source_id?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    first_name?: string | null
                    last_name?: string | null
                    title?: string | null
                    profile_image_url?: string | null
                    languages_spoken?: string[] | null
                    telehealth_enabled?: boolean | null
                    accepts_new_patients?: boolean | null
                    booking_buffer_minutes?: number | null
                    max_daily_appointments?: number | null
                    athena_provider_id?: string | null
                    calendar_source_id?: string | null
                    created_at?: string | null
                }
            }
            payers: {
                Row: {
                    id: string
                    name: string | null
                    payer_type: string | null
                    state: string | null
                    effective_date: string | null
                    requires_attending: boolean | null
                    credentialing_status: string | null
                    notes: string | null
                    projected_effective_date: string | null
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    name?: string | null
                    payer_type?: string | null
                    state?: string | null
                    effective_date?: string | null
                    requires_attending?: boolean | null
                    credentialing_status?: string | null
                    notes?: string | null
                    projected_effective_date?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    name?: string | null
                    payer_type?: string | null
                    state?: string | null
                    effective_date?: string | null
                    requires_attending?: boolean | null
                    credentialing_status?: string | null
                    notes?: string | null
                    projected_effective_date?: string | null
                    created_at?: string | null
                }
            }
            appointments: {
                Row: {
                    id: string
                    provider_id: string
                    rendering_provider_id: string | null
                    service_instance_id: string
                    payer_id: string | null
                    start_time: string
                    end_time: string
                    timezone: string | null
                    patient_info: any
                    insurance_info: any
                    roi_contacts: any | null
                    appointment_type: string | null
                    status: string | null
                    athena_appointment_id: string | null
                    booking_source: string | null
                    notes: string | null
                    cancellation_reason: string | null
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    provider_id: string
                    rendering_provider_id?: string | null
                    service_instance_id: string
                    payer_id?: string | null
                    start_time: string
                    end_time: string
                    timezone?: string | null
                    patient_info: any
                    insurance_info: any
                    roi_contacts?: any | null
                    appointment_type?: string | null
                    status?: string | null
                    athena_appointment_id?: string | null
                    booking_source?: string | null
                    notes?: string | null
                    cancellation_reason?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    provider_id?: string
                    rendering_provider_id?: string | null
                    service_instance_id?: string
                    payer_id?: string | null
                    start_time?: string
                    end_time?: string
                    timezone?: string | null
                    patient_info?: any
                    insurance_info?: any
                    roi_contacts?: any | null
                    appointment_type?: string | null
                    status?: string | null
                    athena_appointment_id?: string | null
                    booking_source?: string | null
                    notes?: string | null
                    cancellation_reason?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
            }
            booking_leads: {
                Row: {
                    id: string
                    email: string
                    phone: string | null
                    preferred_name: string | null
                    requested_service_id: string | null
                    requested_payer_id: string | null
                    insurance_effective_date: string | null
                    reason: string | null
                    status: string | null
                    assigned_to_provider_id: string | null
                    staff_notes: string | null
                    follow_up_date: string | null
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    email: string
                    phone?: string | null
                    preferred_name?: string | null
                    requested_service_id?: string | null
                    requested_payer_id?: string | null
                    insurance_effective_date?: string | null
                    reason?: string | null
                    status?: string | null
                    assigned_to_provider_id?: string | null
                    staff_notes?: string | null
                    follow_up_date?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    email?: string
                    phone?: string | null
                    preferred_name?: string | null
                    requested_service_id?: string | null
                    requested_payer_id?: string | null
                    insurance_effective_date?: string | null
                    reason?: string | null
                    status?: string | null
                    assigned_to_provider_id?: string | null
                    staff_notes?: string | null
                    follow_up_date?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
            }
            services: {
                Row: {
                    id: string
                    name: string | null
                    description: string | null
                    default_duration_minutes: number | null
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    name?: string | null
                    description?: string | null
                    default_duration_minutes?: number | null
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    name?: string | null
                    description?: string | null
                    default_duration_minutes?: number | null
                    created_at?: string | null
                }
            }
            service_instances: {
                Row: {
                    id: string
                    service_id: string | null
                    location: string | null
                    payer_id: string | null
                    pos_location_code: string | null
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    service_id?: string | null
                    location?: string | null
                    payer_id?: string | null
                    pos_location_code?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    service_id?: string | null
                    location?: string | null
                    payer_id?: string | null
                    pos_location_code?: string | null
                    created_at?: string | null
                }
            }
            provider_availability_cache: {
                Row: {
                    id: string
                    provider_id: string
                    service_instance_id: string
                    date: string
                    available_slots: any
                    last_synced_athena: string | null
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    provider_id: string
                    service_instance_id: string
                    date: string
                    available_slots: any
                    last_synced_athena?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    provider_id?: string
                    service_instance_id?: string
                    date?: string
                    available_slots?: any
                    last_synced_athena?: string | null
                    created_at?: string | null
                }
            }
        }
    }
}

// Application-specific types
export interface Provider {
    id: string
    first_name: string
    last_name: string
    title?: string
    profile_image_url?: string
    languages_spoken: string[]
    telehealth_enabled: boolean
    accepts_new_patients: boolean
    booking_buffer_minutes: number
    max_daily_appointments: number
}

export interface Payer {
    id: string
    name: string
    payer_type?: string
    state?: string
    effective_date?: Date
    requires_attending: boolean
    credentialing_status?: string
    projected_effective_date?: Date
}

export interface BookingLead {
    email: string
    phone?: string
    preferred_name?: string
    requested_payer_id?: string
    insurance_effective_date?: Date
    reason?: string
}

export interface PatientInfo {
    first_name: string
    last_name: string
    date_of_birth: string
    email: string
    phone?: string
    preferred_name?: string
}

export interface InsuranceInfo {
    payer_id: string
    member_id: string
    group_number?: string
    effective_date?: string
}

export interface ROIContact {
    name: string
    email: string
    relationship: string
    organization?: string
}

export interface TimeSlot {
    start_time: string
    end_time: string
    provider_id: string
    available: boolean
}