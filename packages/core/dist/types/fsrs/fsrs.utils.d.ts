/**
 * FSRS Utility Functions
 * Helper functions for FSRS operations
 */
import type { FSRSCardData } from "./card.types";
/**
 * Review view display mode
 */
export type ReviewViewMode = "fullscreen" | "panel";
/**
 * Default FSRS data for a new card
 */
export declare function createDefaultFSRSData(id: string): FSRSCardData;
/**
 * Format interval to readable form
 * @param minutes Number of minutes
 * @returns Formatted string (e.g., "<1m", "10m", "1d", "2mo")
 */
export declare function formatInterval(minutes: number): string;
