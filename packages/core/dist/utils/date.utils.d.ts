/**
 * Date Utilities
 * Centralized date formatting and parsing functions
 * Avoids timezone issues by using local calendar dates (not UTC)
 */
/**
 * Format a date as local YYYY-MM-DD string
 * Uses local calendar date (not UTC) to avoid timezone issues with toISOString()
 *
 * @example
 * formatLocalDate(new Date('2024-01-15T23:00:00')) // "2024-01-15" (local)
 */
export declare function formatLocalDate(date: Date): string;
/**
 * Get today's date boundary based on dayStartHour (Anki-style)
 * If current hour < dayStartHour, we're still in "yesterday"
 *
 * @param dayStartHour - Hour when the day starts (default 4, like Anki)
 * @param now - Optional current time (for testing)
 *
 * @example
 * // At 3 AM with dayStartHour=4, returns yesterday at 4 AM
 * getTodayBoundary(4, new Date('2024-01-15T03:00:00'))
 */
export declare function getTodayBoundary(dayStartHour?: number, now?: Date): Date;
/**
 * Get tomorrow's boundary (end of "today")
 *
 * @param dayStartHour - Hour when the day starts (default 4)
 * @param now - Optional current time (for testing)
 */
export declare function getTomorrowBoundary(dayStartHour?: number, now?: Date): Date;
/**
 * Get today's date key (YYYY-MM-DD) respecting dayStartHour
 * At 3 AM with dayStartHour=4, this returns yesterday's date
 *
 * @param dayStartHour - Hour when the day starts (default 4)
 * @param now - Optional current time (for testing)
 */
export declare function getTodayKey(dayStartHour?: number, now?: Date): string;
/**
 * Check if a timestamp falls within "today" (respecting dayStartHour)
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @param dayStartHour - Hour when the day starts (default 4)
 * @param now - Optional current time (for testing)
 */
export declare function isTimestampToday(timestamp: number, dayStartHour?: number, now?: Date): boolean;
