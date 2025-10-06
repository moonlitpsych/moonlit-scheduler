export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_type: string | null
          athena_appointment_id: string | null
          booking_source: string | null
          cancellation_reason: string | null
          created_at: string | null
          end_time: string
          id: string
          insurance_info: Json
          notes: string | null
          patient_info: Json
          payer_id: string | null
          provider_id: string
          rendering_provider_id: string | null
          roi_contacts: Json | null
          service_instance_id: string
          start_time: string
          status: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          appointment_type?: string | null
          athena_appointment_id?: string | null
          booking_source?: string | null
          cancellation_reason?: string | null
          created_at?: string | null
          end_time: string
          id?: string
          insurance_info: Json
          notes?: string | null
          patient_info: Json
          payer_id?: string | null
          provider_id: string
          rendering_provider_id?: string | null
          roi_contacts?: Json | null
          service_instance_id: string
          start_time: string
          status?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          appointment_type?: string | null
          athena_appointment_id?: string | null
          booking_source?: string | null
          cancellation_reason?: string | null
          created_at?: string | null
          end_time?: string
          id?: string
          insurance_info?: Json
          notes?: string | null
          patient_info?: Json
          payer_id?: string | null
          provider_id?: string
          rendering_provider_id?: string | null
          roi_contacts?: Json | null
          service_instance_id?: string
          start_time?: string
          status?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_rendering_provider_id_fkey"
            columns: ["rendering_provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_rendering_provider_id_fkey"
            columns: ["rendering_provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_instance_id_fkey"
            columns: ["service_instance_id"]
            isOneToOne: false
            referencedRelation: "service_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_leads: {
        Row: {
          assigned_to_provider_id: string | null
          created_at: string | null
          email: string
          follow_up_date: string | null
          id: string
          insurance_effective_date: string | null
          phone: string | null
          preferred_name: string | null
          reason: string | null
          requested_payer_id: string | null
          requested_service_id: string | null
          staff_notes: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to_provider_id?: string | null
          created_at?: string | null
          email: string
          follow_up_date?: string | null
          id?: string
          insurance_effective_date?: string | null
          phone?: string | null
          preferred_name?: string | null
          reason?: string | null
          requested_payer_id?: string | null
          requested_service_id?: string | null
          staff_notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to_provider_id?: string | null
          created_at?: string | null
          email?: string
          follow_up_date?: string | null
          id?: string
          insurance_effective_date?: string | null
          phone?: string | null
          preferred_name?: string | null
          reason?: string | null
          requested_payer_id?: string | null
          requested_service_id?: string | null
          staff_notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_leads_assigned_to_provider_id_fkey"
            columns: ["assigned_to_provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_leads_assigned_to_provider_id_fkey"
            columns: ["assigned_to_provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_leads_requested_payer_id_fkey"
            columns: ["requested_payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_leads_requested_service_id_fkey"
            columns: ["requested_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_week: {
        Row: {
          iso_week: number | null
          iso_year: number | null
          week_end: string | null
          week_start: string
        }
        Insert: {
          iso_week?: number | null
          iso_year?: number | null
          week_end?: string | null
          week_start: string
        }
        Update: {
          iso_week?: number | null
          iso_year?: number | null
          week_end?: string | null
          week_start?: string
        }
        Relationships: []
      }
      cpt_codes: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_combo_code: boolean | null
          pos: string | null
          price: number | null
          units: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_combo_code?: boolean | null
          pos?: string | null
          price?: number | null
          units?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_combo_code?: boolean | null
          pos?: string | null
          price?: number | null
          units?: number | null
        }
        Relationships: []
      }
      eligibility_cache: {
        Row: {
          cache_expires_at: string
          created_at: string | null
          effective_date: string | null
          eligible_provider_ids: string[] | null
          id: string
          member_id: string | null
          payer_name: string
          requires_supervision: boolean | null
        }
        Insert: {
          cache_expires_at: string
          created_at?: string | null
          effective_date?: string | null
          eligible_provider_ids?: string[] | null
          id?: string
          member_id?: string | null
          payer_name: string
          requires_supervision?: boolean | null
        }
        Update: {
          cache_expires_at?: string
          created_at?: string | null
          effective_date?: string | null
          eligible_provider_ids?: string[] | null
          id?: string
          member_id?: string | null
          payer_name?: string
          requires_supervision?: boolean | null
        }
        Relationships: []
      }
      housing_status: {
        Row: {
          code: string
          description: string
        }
        Insert: {
          code: string
          description: string
        }
        Update: {
          code?: string
          description?: string
        }
        Relationships: []
      }
      payer_reimbursement_rates: {
        Row: {
          created_at: string | null
          effective_date: string | null
          id: string
          notes: string | null
          payer_id: string
          pos_location_code: string | null
          rate: number
          service_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          effective_date?: string | null
          id?: string
          notes?: string | null
          payer_id: string
          pos_location_code?: string | null
          rate: number
          service_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          effective_date?: string | null
          id?: string
          notes?: string | null
          payer_id?: string
          pos_location_code?: string | null
          rate?: number
          service_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payer_reimbursement_rates_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payer_reimbursement_rates_pos_location_code_fkey"
            columns: ["pos_location_code"]
            isOneToOne: false
            referencedRelation: "pos_location"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "payer_reimbursement_rates_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      payers: {
        Row: {
          created_at: string | null
          status_code: string | null
          effective_date: string | null
          id: string
          name: string | null
          notes: string | null
          payer_type: string | null
          projected_effective_date: string | null
          requires_attending: boolean | null
          requires_individual_contract: boolean
          state: string | null
        }
        Insert: {
          created_at?: string | null
          status_code?: string | null
          effective_date?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          payer_type?: string | null
          projected_effective_date?: string | null
          requires_attending?: boolean | null
          requires_individual_contract?: boolean
          state?: string | null
        }
        Update: {
          created_at?: string | null
          status_code?: string | null
          effective_date?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          payer_type?: string | null
          projected_effective_date?: string | null
          requires_attending?: boolean | null
          requires_individual_contract?: boolean
          state?: string | null
        }
        Relationships: []
      }
      pos_location: {
        Row: {
          code: string
          long_name: string
        }
        Insert: {
          code: string
          long_name: string
        }
        Update: {
          code?: string
          long_name?: string
        }
        Relationships: []
      }
      provider_availability: {
        Row: {
          created_at: string | null
          day_of_week: number
          effective_date: string | null
          end_time: string
          expiration_date: string | null
          id: string
          is_recurring: boolean | null
          provider_id: string
          start_time: string
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          effective_date?: string | null
          end_time: string
          expiration_date?: string | null
          id?: string
          is_recurring?: boolean | null
          provider_id: string
          start_time: string
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          effective_date?: string | null
          end_time?: string
          expiration_date?: string | null
          id?: string
          is_recurring?: boolean | null
          provider_id?: string
          start_time?: string
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_availability_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_availability_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_availability_cache: {
        Row: {
          available_slots: Json
          created_at: string | null
          date: string
          id: string
          last_synced_athena: string | null
          provider_id: string
          service_instance_id: string
        }
        Insert: {
          available_slots: Json
          created_at?: string | null
          date: string
          id?: string
          last_synced_athena?: string | null
          provider_id: string
          service_instance_id: string
        }
        Update: {
          available_slots?: Json
          created_at?: string | null
          date?: string
          id?: string
          last_synced_athena?: string | null
          provider_id?: string
          service_instance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_availability_cache_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_availability_cache_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_availability_cache_service_instance_id_fkey"
            columns: ["service_instance_id"]
            isOneToOne: false
            referencedRelation: "service_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_availability_exceptions: {
        Row: {
          created_at: string | null
          end_time: string | null
          exception_date: string
          exception_type: string
          id: string
          provider_id: string
          reason: string | null
          start_time: string | null
        }
        Insert: {
          created_at?: string | null
          end_time?: string | null
          exception_date: string
          exception_type: string
          id?: string
          provider_id: string
          reason?: string | null
          start_time?: string | null
        }
        Update: {
          created_at?: string | null
          end_time?: string | null
          exception_date?: string
          exception_type?: string
          id?: string
          provider_id?: string
          reason?: string | null
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_availability_exceptions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_availability_exceptions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_intakeq_settings: {
        Row: {
          provider_id: string
          practitioner_id: string | null
          service_id: string
          location_id: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          provider_id: string
          practitioner_id?: string | null
          service_id: string
          location_id: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          provider_id?: string
          practitioner_id?: string | null
          service_id?: string
          location_id?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_intakeq_settings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "providers"
            referencedColumns: ["id"]
          }
        ]
      }
      provider_licenses: {
        Row: {
          created_date: string | null
          expiration_date: string | null
          id: string
          issuing_state: string | null
          license_image_url: string | null
          license_number: string | null
          license_type: string | null
          provider_id: string | null
          start_date: string | null
        }
        Insert: {
          created_date?: string | null
          expiration_date?: string | null
          id?: string
          issuing_state?: string | null
          license_image_url?: string | null
          license_number?: string | null
          license_type?: string | null
          provider_id?: string | null
          start_date?: string | null
        }
        Update: {
          created_date?: string | null
          expiration_date?: string | null
          id?: string
          issuing_state?: string | null
          license_image_url?: string | null
          license_number?: string | null
          license_type?: string | null
          provider_id?: string | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_licenses_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_licenses_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_payer_networks: {
        Row: {
          created_at: string | null
          effective_date: string
          expiration_date: string | null
          id: string
          notes: string | null
          payer_id: string
          provider_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          effective_date: string
          expiration_date?: string | null
          id?: string
          notes?: string | null
          payer_id: string
          provider_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          effective_date?: string
          expiration_date?: string | null
          id?: string
          notes?: string | null
          payer_id?: string
          provider_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_payer_networks_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_payer_networks_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_payer_networks_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_references: {
        Row: {
          city: string | null
          created_at: string | null
          email: string | null
          fax: string | null
          id: string
          mobile: string | null
          phone: string | null
          provider_id: string | null
          ref_name: string
          ref_title: string | null
          state: string | null
          street: string | null
          updated_at: string | null
          zip: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          email?: string | null
          fax?: string | null
          id?: string
          mobile?: string | null
          phone?: string | null
          provider_id?: string | null
          ref_name: string
          ref_title?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          email?: string | null
          fax?: string | null
          id?: string
          mobile?: string | null
          phone?: string | null
          provider_id?: string | null
          ref_name?: string
          ref_title?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_references_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_references_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_services: {
        Row: {
          default_duration_min: number | null
          provider_id: string
          service_id: string
        }
        Insert: {
          default_duration_min?: number | null
          provider_id: string
          service_id: string
        }
        Update: {
          default_duration_min?: number | null
          provider_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          accepts_new_patients: boolean | null
          address: string | null
          athena_provider_id: string | null
          auth_user_id: string | null
          availability: boolean | null
          bank_account_number: string | null
          bank_routing_number: string | null
          booking_buffer_minutes: number | null
          calendar_source_id: string | null
          caqh_provider_id: string | null
          created_date: string | null
          date_of_birth: string | null
          email: string | null
          email_custom: string | null
          fax_number: string | null
          first_name: string | null
          id: string
          is_active: boolean | null
          languages_spoken: string[] | null
          last_login_at: string | null
          last_name: string | null
          list_on_provider_page: boolean | null
          location_of_birth: string | null
          malpractice_insurance_expiration: string | null
          malpractice_insurance_id: string | null
          max_daily_appointments: number | null
          med_school_grad_year: number | null
          med_school_org: string | null
          modified_date: string | null
          npi: string | null
          personal_booking_url: string | null
          phone_number: string | null
          profile_completed: boolean | null
          profile_image_url: string | null
          provider_sex: string | null
          residency_org: string | null
          role: string | null
          role_id: string | null
          telehealth_enabled: boolean | null
          title: string | null
          user_id: string | null
          utah_id: string | null
          what_i_look_for_in_a_patient: string | null
        }
        Insert: {
          accepts_new_patients?: boolean | null
          address?: string | null
          athena_provider_id?: string | null
          auth_user_id?: string | null
          availability?: boolean | null
          bank_account_number?: string | null
          bank_routing_number?: string | null
          booking_buffer_minutes?: number | null
          calendar_source_id?: string | null
          caqh_provider_id?: string | null
          created_date?: string | null
          date_of_birth?: string | null
          email?: string | null
          email_custom?: string | null
          fax_number?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          languages_spoken?: string[] | null
          last_login_at?: string | null
          last_name?: string | null
          list_on_provider_page?: boolean | null
          location_of_birth?: string | null
          malpractice_insurance_expiration?: string | null
          malpractice_insurance_id?: string | null
          max_daily_appointments?: number | null
          med_school_grad_year?: number | null
          med_school_org?: string | null
          modified_date?: string | null
          npi?: string | null
          personal_booking_url?: string | null
          phone_number?: string | null
          profile_completed?: boolean | null
          profile_image_url?: string | null
          provider_sex?: string | null
          residency_org?: string | null
          role?: string | null
          role_id?: string | null
          telehealth_enabled?: boolean | null
          title?: string | null
          user_id?: string | null
          utah_id?: string | null
          what_i_look_for_in_a_patient?: string | null
        }
        Update: {
          accepts_new_patients?: boolean | null
          address?: string | null
          athena_provider_id?: string | null
          auth_user_id?: string | null
          availability?: boolean | null
          bank_account_number?: string | null
          bank_routing_number?: string | null
          booking_buffer_minutes?: number | null
          calendar_source_id?: string | null
          caqh_provider_id?: string | null
          created_date?: string | null
          date_of_birth?: string | null
          email?: string | null
          email_custom?: string | null
          fax_number?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          languages_spoken?: string[] | null
          last_login_at?: string | null
          last_name?: string | null
          list_on_provider_page?: boolean | null
          location_of_birth?: string | null
          malpractice_insurance_expiration?: string | null
          malpractice_insurance_id?: string | null
          max_daily_appointments?: number | null
          med_school_grad_year?: number | null
          med_school_org?: string | null
          modified_date?: string | null
          npi?: string | null
          personal_booking_url?: string | null
          phone_number?: string | null
          profile_completed?: boolean | null
          profile_image_url?: string | null
          provider_sex?: string | null
          residency_org?: string | null
          role?: string | null
          role_id?: string | null
          telehealth_enabled?: boolean | null
          title?: string | null
          user_id?: string | null
          utah_id?: string | null
          what_i_look_for_in_a_patient?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "providers_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_partners: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      reimbursement_rates: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          payer_id: string | null
          rate_end_date: string | null
          rate_source: string | null
          rate_start_date: string | null
          reimbursement_amount: number | null
          service_instance_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          payer_id?: string | null
          rate_end_date?: string | null
          rate_source?: string | null
          rate_start_date?: string | null
          reimbursement_amount?: number | null
          service_instance_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          payer_id?: string | null
          rate_end_date?: string | null
          rate_source?: string | null
          rate_start_date?: string | null
          reimbursement_amount?: number | null
          service_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reimbursement_rates_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_rates_service_instance_id_fkey"
            columns: ["service_instance_id"]
            isOneToOne: false
            referencedRelation: "service_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          permissions: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          permissions?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          permissions?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      scheduler_audit_logs: {
        Row: {
          action: string
          appointment_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          ip_address: unknown | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_identifier: string | null
        }
        Insert: {
          action: string
          appointment_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_identifier?: string | null
        }
        Update: {
          action?: string
          appointment_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_identifier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduler_audit_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduler_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      service_cpt_codes: {
        Row: {
          cpt_code_id: string | null
          created_at: string | null
          id: string
          price: number | null
          service_id: string | null
        }
        Insert: {
          cpt_code_id?: string | null
          created_at?: string | null
          id?: string
          price?: number | null
          service_id?: string | null
        }
        Update: {
          cpt_code_id?: string | null
          created_at?: string | null
          id?: string
          price?: number | null
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_cpt_codes_cpt_code_id_fkey"
            columns: ["cpt_code_id"]
            isOneToOne: false
            referencedRelation: "cpt_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_cpt_codes_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_instances: {
        Row: {
          created_at: string | null
          effective_date: string | null
          housing_status: string | null
          id: string
          location: string | null
          payer_id: string | null
          pos_code: string | null
          pos_code_override: string | null
          service_id: string | null
        }
        Insert: {
          created_at?: string | null
          effective_date?: string | null
          housing_status?: string | null
          id?: string
          location?: string | null
          payer_id?: string | null
          pos_code?: string | null
          pos_code_override?: string | null
          service_id?: string | null
        }
        Update: {
          created_at?: string | null
          effective_date?: string | null
          housing_status?: string | null
          id?: string
          location?: string | null
          payer_id?: string | null
          pos_code?: string | null
          pos_code_override?: string | null
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_si_housing"
            columns: ["housing_status"]
            isOneToOne: false
            referencedRelation: "housing_status"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fk_si_location"
            columns: ["location"]
            isOneToOne: false
            referencedRelation: "pos_location"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "service_instances_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_instances_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string | null
          default_pos: string | null
          description: string | null
          effective_date: string | null
          id: string
          location: string | null
          name: string
          pos: string | null
          price: number | null
        }
        Insert: {
          created_at?: string | null
          default_pos?: string | null
          description?: string | null
          effective_date?: string | null
          id?: string
          location?: string | null
          name: string
          pos?: string | null
          price?: number | null
        }
        Update: {
          created_at?: string | null
          default_pos?: string | null
          description?: string | null
          effective_date?: string | null
          id?: string
          location?: string | null
          name?: string
          pos?: string | null
          price?: number | null
        }
        Relationships: []
      }
      stage_payer_rates: {
        Row: {
          amount: number | null
          cpt_code: string | null
          location: string | null
          payer_id: string | null
          provider_type: string | null
        }
        Insert: {
          amount?: number | null
          cpt_code?: string | null
          location?: string | null
          payer_id?: string | null
          provider_type?: string | null
        }
        Update: {
          amount?: number | null
          cpt_code?: string | null
          location?: string | null
          payer_id?: string | null
          provider_type?: string | null
        }
        Relationships: []
      }
      stage_service_cpt_codes: {
        Row: {
          cpt_code_id: string | null
          created_at: string | null
          service_id: string | null
        }
        Insert: {
          cpt_code_id?: string | null
          created_at?: string | null
          service_id?: string | null
        }
        Update: {
          cpt_code_id?: string | null
          created_at?: string | null
          service_id?: string | null
        }
        Relationships: []
      }
      tmp_provider_payer_csv: {
        Row: {
          creation_date: string | null
          effective_date: string | null
          modified_date: string | null
          payer_name: string | null
          provider_name: string | null
          state: string | null
        }
        Insert: {
          creation_date?: string | null
          effective_date?: string | null
          modified_date?: string | null
          payer_name?: string | null
          provider_name?: string | null
          state?: string | null
        }
        Update: {
          creation_date?: string | null
          effective_date?: string | null
          modified_date?: string | null
          payer_name?: string | null
          provider_name?: string | null
          state?: string | null
        }
        Relationships: []
      }
      weekly_referral_projection: {
        Row: {
          partner_id: string | null
          payer_id: string | null
          pk: string | null
          projected_referrals: number
          week_start: string | null
        }
        Insert: {
          partner_id?: string | null
          payer_id?: string | null
          pk?: string | null
          projected_referrals: number
          week_start?: string | null
        }
        Update: {
          partner_id?: string | null
          payer_id?: string | null
          pk?: string | null
          projected_referrals?: number
          week_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_referral_projection_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "referral_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_referral_projection_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_referral_projection_week_start_fkey"
            columns: ["week_start"]
            isOneToOne: false
            referencedRelation: "calendar_week"
            referencedColumns: ["week_start"]
          },
        ]
      }
    }
    Views: {
      provider_payer_networks_readable: {
        Row: {
          effective_date: string | null
          expiration_date: string | null
          id: string | null
          notes: string | null
          payer_name: string | null
          provider_name: string | null
          provider_role: string | null
          state: string | null
          status: string | null
        }
        Relationships: []
      }
      provider_profiles: {
        Row: {
          accepts_new_patients: boolean | null
          address: string | null
          athena_provider_id: string | null
          auth_created_at: string | null
          auth_email: string | null
          auth_user_id: string | null
          availability: boolean | null
          bank_account_number: string | null
          bank_routing_number: string | null
          booking_buffer_minutes: number | null
          calendar_source_id: string | null
          caqh_provider_id: string | null
          created_date: string | null
          date_of_birth: string | null
          email: string | null
          email_custom: string | null
          fax_number: string | null
          first_name: string | null
          id: string | null
          is_active: boolean | null
          languages_spoken: string[] | null
          last_login_at: string | null
          last_name: string | null
          last_sign_in_at: string | null
          list_on_provider_page: boolean | null
          location_of_birth: string | null
          malpractice_insurance_expiration: string | null
          malpractice_insurance_id: string | null
          max_daily_appointments: number | null
          med_school_grad_year: number | null
          med_school_org: string | null
          modified_date: string | null
          npi: string | null
          personal_booking_url: string | null
          phone_number: string | null
          profile_completed: boolean | null
          profile_image_url: string | null
          provider_sex: string | null
          residency_org: string | null
          role: string | null
          role_description: string | null
          role_id: string | null
          role_name: string | null
          role_permissions: Json | null
          telehealth_enabled: boolean | null
          title: string | null
          user_id: string | null
          utah_id: string | null
          what_i_look_for_in_a_patient: string | null
        }
        Relationships: [
          {
            foreignKeyName: "providers_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_reimbursement_summary: {
        Row: {
          effective_date: string | null
          payer: string | null
          pos_description: string | null
          rate: number | null
          service: string | null
          service_location: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_eligible_providers: {
        Args: {
          payer_name_input: string
          service_id_input: string
          effective_date_input?: string
        }
        Returns: {
          provider_id: string
          provider_name: string
          requires_supervision: boolean
          supervising_provider_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

// Export common table row types for convenience
export type Provider = Database['public']['Tables']['providers']['Row']
export type Payer = Database['public']['Tables']['payers']['Row']
export type Appointment = Database['public']['Tables']['appointments']['Row']

export const Constants = {
  public: {
    Enums: {},
  },
} as const

// Custom types for the booking system
export interface TimeSlot {
    start_time: string
    end_time: string  
    provider_id: string
    available: boolean
    provider_name?: string
    duration_minutes?: number
    service_instance_id?: string // Required for appointment creation
    // Additional properties from AvailableSlot
    date?: string
    time?: string
    providerId?: string
}

export interface PatientInfo {
    firstName: string
    lastName: string
    phone: string
    email?: string
    dateOfBirth: string
    dob?: string
}

export interface InsuranceInfo extends PatientInfo {
    memberId?: string
    groupNumber?: string
}

export interface ROIContact {
    name: string
    email: string
    phone?: string
    relationship: string
}


// New view for optimized provider-payer bookability
export interface BookableProviderPayer {
    provider_id: string
    payer_id: string
    via: 'direct' | 'supervised'
    attending_provider_id: string | null
    supervision_level: 'sign_off_only' | 'first_visit_in_person' | 'co_visit_required' | null
    requires_co_visit: boolean
    effective: string // daterange
    bookable_from_date: string
    // Provider details (joined)
    first_name?: string
    last_name?: string
    title?: string
    role?: string
    provider_type?: string
    is_active?: boolean
    is_bookable?: boolean
    languages_spoken?: string[] | string
    profile_image_url?: string
    about?: string
}

