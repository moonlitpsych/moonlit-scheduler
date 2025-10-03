// src/utils/timeFormat.ts

/**
 * Convert 24-hour time string to 12-hour format
 * @param time24 - Time in HH:MM format (e.g., "13:30")
 * @returns Time in 12-hour format (e.g., "1:30pm")
 */
export function formatTo12Hour(time24: string): string {
  if (!time24) return '';
  
  try {
    const [hours, minutes] = time24.split(':').map(Number);
    
    if (isNaN(hours) || isNaN(minutes)) {
      return time24; // Return original if invalid
    }
    
    const period = hours >= 12 ? 'pm' : 'am';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    
    return `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;
  } catch (error) {
    console.error('Error formatting time:', error);
    return time24; // Return original if error
  }
}

/**
 * Convert 12-hour time string to 24-hour format
 * @param time12 - Time in 12-hour format (e.g., "1:30pm")
 * @returns Time in HH:MM format (e.g., "13:30")
 */
export function formatTo24Hour(time12: string): string {
  if (!time12) return '';
  
  try {
    const timePattern = /^(\d{1,2}):(\d{2})(am|pm)$/i;
    const match = time12.toLowerCase().match(timePattern);
    
    if (!match) {
      return time12; // Return original if doesn't match pattern
    }
    
    const [, hours, minutes, period] = match;
    let hour24 = parseInt(hours);
    
    if (period === 'am' && hour24 === 12) {
      hour24 = 0;
    } else if (period === 'pm' && hour24 !== 12) {
      hour24 += 12;
    }
    
    return `${hour24.toString().padStart(2, '0')}:${minutes}`;
  } catch (error) {
    console.error('Error converting to 24-hour format:', error);
    return time12; // Return original if error
  }
}

/**
 * Format a time range for display
 * @param startTime - Start time in 24-hour format
 * @param endTime - End time in 24-hour format
 * @returns Formatted time range (e.g., "9:00am - 5:00pm")
 */
export function formatTimeRange(startTime: string, endTime: string): string {
  const start = formatTo12Hour(startTime);
  const end = formatTo12Hour(endTime);
  return `${start} - ${end}`;
}

/**
 * Validate if a time string is in valid 24-hour format
 * @param time - Time string to validate
 * @returns true if valid 24-hour format
 */
export function isValid24HourTime(time: string): boolean {
  const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timePattern.test(time);
}

/**
 * Validate if a time string is in valid 12-hour format
 * @param time - Time string to validate
 * @returns true if valid 12-hour format
 */
export function isValid12HourTime(time: string): boolean {
  const timePattern = /^(1[0-2]|[1-9]):[0-5][0-9](am|pm)$/i;
  return timePattern.test(time);
}