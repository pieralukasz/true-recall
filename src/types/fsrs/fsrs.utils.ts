/**
 * FSRS Utility Functions
 * Helper functions for FSRS operations
 */

import type { State } from "ts-fsrs";
import type { FSRSCardData } from "./card.types";

/**
 * Review view display mode
 */
export type ReviewViewMode = "fullscreen" | "panel";

/**
 * Default FSRS data for a new card
 */
export function createDefaultFSRSData(id: string): FSRSCardData {
    return {
        id,
        due: new Date().toISOString(),
        stability: 0,
        difficulty: 0,
        reps: 0,
        lapses: 0,
        state: 0 as State, // State.New
        lastReview: null,
        scheduledDays: 0,
        learningStep: 0,
        createdAt: Date.now(),
    };
}

/**
 * Format interval to readable form
 * @param minutes Number of minutes
 * @returns Formatted string (e.g., "<1m", "10m", "1d", "2mo")
 */
export function formatInterval(minutes: number): string {
    if (minutes < 1) {
        return "<1m";
    }
    if (minutes < 60) {
        return `${Math.round(minutes)}m`;
    }
    if (minutes < 60 * 24) {
        const hours = Math.round(minutes / 60);
        return `${hours}h`;
    }
    if (minutes < 60 * 24 * 30) {
        const days = Math.round(minutes / (60 * 24));
        return `${days}d`;
    }
    if (minutes < 60 * 24 * 365) {
        const months = Math.round(minutes / (60 * 24 * 30));
        return `${months}mo`;
    }
    const years = Math.round(minutes / (60 * 24 * 365));
    return `${years}y`;
}

/**
 * Format interval from days to readable form
 */
export function formatIntervalDays(days: number): string {
    return formatInterval(days * 24 * 60);
}
