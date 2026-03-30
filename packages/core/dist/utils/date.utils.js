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
export function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
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
export function getTodayBoundary(dayStartHour = 4, now) {
    const currentTime = now !== null && now !== void 0 ? now : new Date();
    const boundary = new Date(currentTime);
    if (currentTime.getHours() < dayStartHour) {
        boundary.setDate(boundary.getDate() - 1);
    }
    boundary.setHours(dayStartHour, 0, 0, 0);
    return boundary;
}
/**
 * Get tomorrow's boundary (end of "today")
 *
 * @param dayStartHour - Hour when the day starts (default 4)
 * @param now - Optional current time (for testing)
 */
export function getTomorrowBoundary(dayStartHour = 4, now) {
    const today = getTodayBoundary(dayStartHour, now);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
}
/**
 * Get today's date key (YYYY-MM-DD) respecting dayStartHour
 * At 3 AM with dayStartHour=4, this returns yesterday's date
 *
 * @param dayStartHour - Hour when the day starts (default 4)
 * @param now - Optional current time (for testing)
 */
export function getTodayKey(dayStartHour = 4, now) {
    const boundary = getTodayBoundary(dayStartHour, now);
    return formatLocalDate(boundary);
}
/**
 * Check if a timestamp falls within "today" (respecting dayStartHour)
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @param dayStartHour - Hour when the day starts (default 4)
 * @param now - Optional current time (for testing)
 */
export function isTimestampToday(timestamp, dayStartHour = 4, now) {
    const date = new Date(timestamp);
    const todayBoundary = getTodayBoundary(dayStartHour, now);
    const tomorrowBoundary = getTomorrowBoundary(dayStartHour, now);
    return date >= todayBoundary && date < tomorrowBoundary;
}
