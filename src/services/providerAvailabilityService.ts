// src/services/providerAvailabilityService.ts
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';

// Create Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

export interface AvailabilityException {
  id?: string;
  provider_id: string;
  exception_date: string;
  exception_type: 'unavailable' | 'custom_hours';
  start_time?: string;
  end_time?: string;
  reason?: string;
  created_at?: string;
  updated_at?: string;
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

  // ========== WEEKLY SCHEDULE METHODS ==========
  
  async getWeeklySchedule(providerId: string): Promise<WeeklySchedule> {
    try {
      // Get the provider's schedule
      const { data: scheduleData, error: scheduleError } = await supabase
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
      const { data: blocks, error: blocksError } = await supabase
        .from('availability_blocks')
        .select('*')
        .eq('schedule_id', scheduleData.id)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (blocksError) {
        throw blocksError;
      }

      // Build the weekly schedule object
      const weeklySchedule: WeeklySchedule = {};
      
      // Initialize all days as unavailable
      for (let day = 0; day <= 6; day++) {
        weeklySchedule[day] = {
          day_of_week: day,
          is_available: false,
          time_blocks: []
        };
      }

      // Group blocks by day
      if (blocks) {
        blocks.forEach(block => {
          const daySchedule = weeklySchedule[block.day_of_week];
          if (!daySchedule.is_available) {
            daySchedule.is_available = true;
          }
          daySchedule.time_blocks.push({
            id: block.id,
            start_time: block.start_time,
            end_time: block.end_time
          });
        });
      }

      return weeklySchedule;
    } catch (error) {
      console.error('Error getting weekly schedule:', error);
      throw error;
    }
  }

  async saveWeeklySchedule(providerId: string, schedule: WeeklySchedule): Promise<void> {
    try {
      // First, get or create the provider schedule record
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('provider_schedules')
        .select('id')
        .eq('provider_id', providerId)
        .single();

      if (scheduleError && scheduleError.code === 'PGRST116') {
        // Schedule doesn't exist, create it
        const { data: newSchedule, error: createError } = await supabase
          .from('provider_schedules')
          .insert({ provider_id: providerId })
          .select('id')
          .single();

        if (createError) throw createError;
        scheduleData = newSchedule;
      } else if (scheduleError) {
        throw scheduleError;
      }

      const scheduleId = scheduleData!.id;

      // Delete existing availability blocks
      const { error: deleteError } = await supabase
        .from('availability_blocks')
        .delete()
        .eq('schedule_id', scheduleId);

      if (deleteError) throw deleteError;

      // Insert new availability blocks
      const blocksToInsert = [];
      Object.values(schedule).forEach(daySchedule => {
        if (daySchedule.is_available && daySchedule.time_blocks.length > 0) {
          daySchedule.time_blocks.forEach(block => {
            blocksToInsert.push({
              schedule_id: scheduleId,
              day_of_week: daySchedule.day_of_week,
              start_time: block.start_time,
              end_time: block.end_time
            });
          });
        }
      });

      if (blocksToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('availability_blocks')
          .insert(blocksToInsert);

        if (insertError) throw insertError;
      }

      // Update the provider's updated_at timestamp if the column exists
      await supabase
        .from('providers')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', providerId);

    } catch (error) {
      console.error('Error saving weekly schedule:', error);
      throw error;
    }
  }

  // ========== EXCEPTION METHODS ==========

  async getExceptions(providerId: string, startDate?: Date, endDate?: Date): Promise<AvailabilityException[]> {
    try {
      let query = supabase
        .from('availability_exceptions')
        .select('*')
        .eq('provider_id', providerId);

      if (startDate) {
        query = query.gte('exception_date', startDate.toISOString().split('T')[0]);
      }

      if (endDate) {
        query = query.lte('exception_date', endDate.toISOString().split('T')[0]);
      }

      const { data, error } = await query.order('exception_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting exceptions:', error);
      throw error;
    }
  }

  async addException(exception: Omit<AvailabilityException, 'id' | 'created_at' | 'updated_at'>): Promise<AvailabilityException> {
    try {
      const { data, error } = await supabase
        .from('availability_exceptions')
        .insert([{
          ...exception,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding exception:', error);
      throw error;
    }
  }

  async updateException(exceptionId: string, updates: Partial<AvailabilityException>): Promise<AvailabilityException> {
    try {
      const { data, error } = await supabase
        .from('availability_exceptions')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', exceptionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating exception:', error);
      throw error;
    }
  }

  async removeException(exceptionId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('availability_exceptions')
        .delete()
        .eq('id', exceptionId);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing exception:', error);
      throw error;
    }
  }

  // ========== BOOKING SETTINGS METHODS ==========

  async getBookingSettings(providerId: string): Promise<BookingSettings> {
    try {
      const { data, error } = await supabase
        .from('provider_booking_settings')
        .select('*')
        .eq('provider_id', providerId)
        .single();

      if (error && error.code === 'PGRST116') {
        // No settings found, return defaults and create them
        const defaultSettings = this.getDefaultBookingSettings(providerId);
        await this.saveBookingSettings(defaultSettings);
        return defaultSettings;
      }

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting booking settings:', error);
      // Return defaults on error
      return this.getDefaultBookingSettings(providerId);
    }
  }

  async saveBookingSettings(settings: BookingSettings): Promise<void> {
    try {
      const { error } = await supabase
        .from('provider_booking_settings')
        .upsert(settings, { onConflict: 'provider_id' });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving booking settings:', error);
      throw error;
    }
  }

  // ========== AVAILABILITY GENERATION ==========

  async getAvailableSlots(
    providerId: string,
    startDate: Date,
    endDate: Date,
    appointmentDuration: number = 60
  ): Promise<Array<{ startTime: Date; endTime: Date; isAvailable: boolean }>> {
    try {
      // Get weekly schedule
      const weeklySchedule = await this.getWeeklySchedule(providerId);
      
      // Get exceptions
      const exceptions = await this.getExceptions(providerId, startDate, endDate);
      
      // Get booking settings
      const bookingSettings = await this.getBookingSettings(providerId);

      // Generate slots
      const slots = [];
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        const dateString = format(currentDate, 'yyyy-MM-dd');
        
        // Check if there's an exception for this date
        const exception = exceptions.find(ex => ex.exception_date === dateString);
        
        if (exception) {
          if (exception.exception_type === 'unavailable') {
            // Skip this day entirely
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          } else if (exception.exception_type === 'custom_hours' && exception.start_time && exception.end_time) {
            // Use custom hours for this day
            const daySlots = this.generateDaySlots(
              currentDate,
              exception.start_time,
              exception.end_time,
              appointmentDuration,
              bookingSettings.booking_buffer_minutes
            );
            slots.push(...daySlots);
          }
        } else {
          // Use regular weekly schedule
          const daySchedule = weeklySchedule[dayOfWeek];
          if (daySchedule && daySchedule.is_available) {
            for (const timeBlock of daySchedule.time_blocks) {
              const daySlots = this.generateDaySlots(
                currentDate,
                timeBlock.start_time,
                timeBlock.end_time,
                appointmentDuration,
                bookingSettings.booking_buffer_minutes
              );
              slots.push(...daySlots);
            }
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return slots;
    } catch (error) {
      console.error('Error getting available slots:', error);
      throw error;
    }
  }

  // Enhanced slot generation that considers exceptions
  async getAvailableSlotsWithExceptions(
    providerId: string,
    startDate: Date,
    endDate: Date,
    appointmentDuration: number = 60
  ): Promise<Array<{ startTime: Date; endTime: Date; isAvailable: boolean }>> {
    try {
      // Get weekly schedule
      const weeklySchedule = await this.getWeeklySchedule(providerId);
      
      // Get exceptions for the date range
      const exceptions = await this.getExceptions(providerId, startDate, endDate);
      
      // Get booking settings
      const bookingSettings = await this.getBookingSettings(providerId);

      const slots = [];
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        const dateString = format(currentDate, 'yyyy-MM-dd');
        
        // Check if there's an exception for this date
        const exception = exceptions.find(ex => ex.exception_date === dateString);
        
        if (exception) {
          if (exception.exception_type === 'unavailable') {
            // Skip this day entirely
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          } else if (exception.exception_type === 'custom_hours' && exception.start_time && exception.end_time) {
            // Use custom hours for this day
            const daySlots = this.generateDaySlots(
              currentDate,
              exception.start_time,
              exception.end_time,
              appointmentDuration,
              bookingSettings.booking_buffer_minutes
            );
            slots.push(...daySlots);
          }
        } else {
          // Use regular weekly schedule
          const daySchedule = weeklySchedule[dayOfWeek];
          if (daySchedule && daySchedule.is_available) {
            for (const timeBlock of daySchedule.time_blocks) {
              const daySlots = this.generateDaySlots(
                currentDate,
                timeBlock.start_time,
                timeBlock.end_time,
                appointmentDuration,
                bookingSettings.booking_buffer_minutes
              );
              slots.push(...daySlots);
            }
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return slots;
    } catch (error) {
      console.error('Error getting available slots with exceptions:', error);
      throw error;
    }
  }

  private generateDaySlots(
    date: Date,
    startTime: string,
    endTime: string,
    appointmentDuration: number,
    bufferMinutes: number
  ): Array<{ startTime: Date; endTime: Date; isAvailable: boolean }> {
    const slots = [];
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const currentSlotStart = new Date(date);
    currentSlotStart.setHours(startHour, startMinute, 0, 0);

    const dayEnd = new Date(date);
    dayEnd.setHours(endHour, endMinute, 0, 0);

    while (currentSlotStart < dayEnd) {
      const slotEnd = new Date(currentSlotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + appointmentDuration);

      if (slotEnd <= dayEnd) {
        slots.push({
          startTime: new Date(currentSlotStart),
          endTime: new Date(slotEnd),
          isAvailable: true
        });
      }

      // Move to next slot (appointment duration + buffer)
      currentSlotStart.setMinutes(currentSlotStart.getMinutes() + appointmentDuration + bufferMinutes);
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