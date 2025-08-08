import { format } from 'date-fns';
import { createClient } from '../../supabase/client';

export interface TimeBlock {
  start_time: string;
  end_time: string;
  id?: string;
}

export interface DaySchedule {
  day_of_week: number;
  is_available: boolean;
  time_blocks: TimeBlock[];
}

export interface WeeklySchedule {
  [key: number]: DaySchedule;
}

export interface ScheduleException {
  id?: string;
  provider_id: string;
  exception_date: string;
  exception_type: 'unavailable' | 'custom_hours';
  start_time?: string;
  end_time?: string;
  reason?: string;
  created_at?: string;
}

export interface BookingSettings {
  id?: string;
  provider_id: string;
  max_daily_appointments: number;
  booking_buffer_minutes: number;
  advance_booking_days: number;
  minimum_notice_hours: number;
  telehealth_enabled: boolean;
  in_person_enabled: boolean;
  emergency_slots_per_day: number;
  emergency_slot_duration_minutes: number;
  self_booking_enabled: boolean;
  third_party_booking_enabled: boolean;
  case_manager_booking_enabled: boolean;
  accepts_new_patients: boolean;
  new_patient_appointment_types: string[];
  cancellation_notice_hours: number;
  allow_patient_cancellation: boolean;
  auto_confirm_appointments: boolean;
  require_insurance_verification: boolean;
}

class ProviderAvailabilityService {
  private supabase = createClient();

  // ========== WEEKLY SCHEDULE METHODS ==========
  
  async getWeeklySchedule(providerId: string): Promise<WeeklySchedule> {
    try {
      // Get the provider's schedule
      const { data: scheduleData, error: scheduleError } = await this.supabase
        .from('provider_schedules')
        .select('*')
        .eq('provider_id', providerId)
        .single();

      if (scheduleError && scheduleError.code !== 'PGRST116') {
        throw scheduleError;
      }

      // If no schedule exists, return default
      if (!scheduleData) {
        return this.getDefaultWeeklySchedule();
      }

      // Get all availability blocks for this schedule
      const { data: blocks, error: blocksError } = await this.supabase
        .from('availability_blocks')
        .select('*')
        .eq('schedule_id', scheduleData.id)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (blocksError) {
        throw blocksError;
      }

      // Transform to WeeklySchedule format
      const weeklySchedule: WeeklySchedule = {};
      
      for (let day = 0; day < 7; day++) {
        const dayBlocks = blocks?.filter(b => b.day_of_week === day) || [];
        weeklySchedule[day] = {
          day_of_week: day,
          is_available: dayBlocks.length > 0,
          time_blocks: dayBlocks.map(block => ({
            id: block.id,
            start_time: block.start_time,
            end_time: block.end_time
          }))
        };
      }

      return weeklySchedule;
    } catch (error) {
      console.error('Error fetching weekly schedule:', error);
      return this.getDefaultWeeklySchedule();
    }
  }

  async saveWeeklySchedule(providerId: string, schedule: WeeklySchedule): Promise<void> {
    try {
      // Start a transaction-like operation
      // First, check if a schedule exists
      const { data: existingSchedule } = await this.supabase
        .from('provider_schedules')
        .select('id')
        .eq('provider_id', providerId)
        .single();

      let scheduleId: string;

      if (existingSchedule) {
        scheduleId = existingSchedule.id;
        
        // Delete existing blocks
        await this.supabase
          .from('availability_blocks')
          .delete()
          .eq('schedule_id', scheduleId);
      } else {
        // Create new schedule
        const { data: newSchedule, error: createError } = await this.supabase
          .from('provider_schedules')
          .insert({
            provider_id: providerId,
            schedule_name: 'Default Schedule',
            is_default: true,
            timezone: 'America/Denver'
          })
          .select()
          .single();

        if (createError) throw createError;
        scheduleId = newSchedule.id;
      }

      // Insert new blocks
      const blocks = [];
      for (const [dayStr, daySchedule] of Object.entries(schedule)) {
        if (daySchedule.is_available && daySchedule.time_blocks.length > 0) {
          for (const block of daySchedule.time_blocks) {
            blocks.push({
              schedule_id: scheduleId,
              day_of_week: parseInt(dayStr),
              start_time: block.start_time,
              end_time: block.end_time
            });
          }
        }
      }

      if (blocks.length > 0) {
        const { error: insertError } = await this.supabase
          .from('availability_blocks')
          .insert(blocks);

        if (insertError) throw insertError;
      }

    } catch (error) {
      console.error('Error saving weekly schedule:', error);
      throw error;
    }
  }

  // ========== EXCEPTION METHODS ==========

  async getExceptions(
    providerId: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<ScheduleException[]> {
    try {
      let query = this.supabase
        .from('availability_exceptions')
        .select('*')
        .eq('provider_id', providerId)
        .order('exception_date', { ascending: false });

      if (startDate) {
        query = query.gte('exception_date', format(startDate, 'yyyy-MM-dd'));
      }
      
      if (endDate) {
        query = query.lte('exception_date', format(endDate, 'yyyy-MM-dd'));
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching exceptions:', error);
      return [];
    }
  }

  async addException(exception: ScheduleException): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('availability_exceptions')
        .insert(exception);

      if (error) throw error;
    } catch (error) {
      console.error('Error adding exception:', error);
      throw error;
    }
  }

  async updateException(id: string, updates: Partial<ScheduleException>): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('availability_exceptions')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating exception:', error);
      throw error;
    }
  }

  async deleteException(id: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('availability_exceptions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting exception:', error);
      throw error;
    }
  }

  // ========== BOOKING SETTINGS METHODS ==========

  async getBookingSettings(providerId: string): Promise<BookingSettings> {
    try {
      const { data, error } = await this.supabase
        .from('provider_booking_settings')
        .select('*')
        .eq('provider_id', providerId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      // Return existing settings or defaults
      return data || this.getDefaultBookingSettings(providerId);
    } catch (error) {
      console.error('Error fetching booking settings:', error);
      return this.getDefaultBookingSettings(providerId);
    }
  }

  async saveBookingSettings(providerId: string, settings: BookingSettings): Promise<void> {
    try {
      // Check if settings exist
      const { data: existing } = await this.supabase
        .from('provider_booking_settings')
        .select('id')
        .eq('provider_id', providerId)
        .single();

      if (existing) {
        // Update existing settings
        const { error } = await this.supabase
          .from('provider_booking_settings')
          .update({
            ...settings,
            updated_at: new Date().toISOString()
          })
          .eq('provider_id', providerId);

        if (error) throw error;
      } else {
        // Insert new settings
        const { error } = await this.supabase
          .from('provider_booking_settings')
          .insert({
            ...settings,
            provider_id: providerId
          });

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error saving booking settings:', error);
      throw error;
    }
  }

  // ========== AVAILABILITY CHECK METHODS ==========

  async getAvailableSlots(
    providerId: string,
    date: Date,
    duration: number = 30
  ): Promise<string[]> {
    try {
      const dayOfWeek = date.getDay();
      const dateStr = format(date, 'yyyy-MM-dd');

      // Check for exceptions first
      const { data: exception } = await this.supabase
        .from('availability_exceptions')
        .select('*')
        .eq('provider_id', providerId)
        .eq('exception_date', dateStr)
        .single();

      if (exception) {
        if (exception.exception_type === 'unavailable') {
          return []; // Provider is unavailable
        }
        // Handle custom hours
        if (exception.start_time && exception.end_time) {
          return this.generateTimeSlots(
            exception.start_time,
            exception.end_time,
            duration
          );
        }
      }

      // Get regular schedule
      const weeklySchedule = await this.getWeeklySchedule(providerId);
      const daySchedule = weeklySchedule[dayOfWeek];

      if (!daySchedule || !daySchedule.is_available) {
        return [];
      }

      // Generate slots from all time blocks
      const allSlots: string[] = [];
      for (const block of daySchedule.time_blocks) {
        const slots = this.generateTimeSlots(
          block.start_time,
          block.end_time,
          duration
        );
        allSlots.push(...slots);
      }

      // TODO: Filter out already booked slots
      // This would require checking the appointments table

      return allSlots;
    } catch (error) {
      console.error('Error getting available slots:', error);
      return [];
    }
  }

  // ========== HELPER METHODS ==========

  private generateTimeSlots(
    startTime: string,
    endTime: string,
    duration: number
  ): string[] {
    const slots: string[] = [];
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    let currentHour = startHour;
    let currentMin = startMin;
    
    while (
      currentHour < endHour ||
      (currentHour === endHour && currentMin < endMin)
    ) {
      slots.push(
        `${currentHour.toString().padStart(2, '0')}:${currentMin
          .toString()
          .padStart(2, '0')}`
      );
      
      currentMin += duration;
      if (currentMin >= 60) {
        currentHour += Math.floor(currentMin / 60);
        currentMin = currentMin % 60;
      }
    }
    
    return slots;
  }

  private getDefaultWeeklySchedule(): WeeklySchedule {
    const schedule: WeeklySchedule = {};
    
    // Monday-Friday 9-5 by default
    for (let day = 1; day <= 5; day++) {
      schedule[day] = {
        day_of_week: day,
        is_available: true,
        time_blocks: [
          { start_time: '09:00', end_time: '12:00' },
          { start_time: '13:00', end_time: '17:00' }
        ]
      };
    }
    
    // Weekend unavailable by default
    schedule[0] = { day_of_week: 0, is_available: false, time_blocks: [] };
    schedule[6] = { day_of_week: 6, is_available: false, time_blocks: [] };
    
    return schedule;
  }

  private getDefaultBookingSettings(providerId: string): BookingSettings {
    return {
      provider_id: providerId,
      max_daily_appointments: 20,
      booking_buffer_minutes: 15,
      advance_booking_days: 90,
      minimum_notice_hours: 24,
      telehealth_enabled: true,
      in_person_enabled: true,
      emergency_slots_per_day: 2,
      emergency_slot_duration_minutes: 30,
      self_booking_enabled: true,
      third_party_booking_enabled: true,
      case_manager_booking_enabled: true,
      accepts_new_patients: true,
      new_patient_appointment_types: ['initial_consultation'],
      cancellation_notice_hours: 24,
      allow_patient_cancellation: true,
      auto_confirm_appointments: false,
      require_insurance_verification: true
    };
  }

  // ========== TEMPLATE METHODS (FOR SUB-PROJECT 4) ==========

  async saveScheduleTemplate(
    providerId: string,
    templateName: string,
    schedule: WeeklySchedule
  ): Promise<string> {
    // Placeholder for Sub-Project 4
    console.log('Schedule templates coming in Sub-Project 4');
    return 'template-id';
  }

  async applyScheduleTemplate(
    providerId: string,
    templateId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<void> {
    // Placeholder for Sub-Project 4
    console.log('Schedule templates coming in Sub-Project 4');
  }

  async copyScheduleToProviders(
    sourceProviderId: string,
    targetProviderIds: string[],
    options?: { includeExceptions: boolean }
  ): Promise<void> {
    // Placeholder for Sub-Project 4
    console.log('Bulk operations coming in Sub-Project 4');
  }
}

export const providerAvailabilityService = new ProviderAvailabilityService();