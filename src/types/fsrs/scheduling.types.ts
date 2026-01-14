/**
 * FSRS Scheduling Types
 * Scheduling preview and optimization
 */

/**
 * Scheduling preview for each rating
 */
export interface SchedulingPreview {
    again: {
        due: Date;
        interval: string; // e.g., "<1m", "10m", "1d"
    };
    hard: {
        due: Date;
        interval: string;
    };
    good: {
        due: Date;
        interval: string;
    };
    easy: {
        due: Date;
        interval: string;
    };
}

/**
 * History validation result before optimization
 */
export interface HistoryValidationResult {
    isValid: boolean;
    totalReviews: number;
    totalCards: number;
    message: string;
    warnings: string[];
}

/**
 * FSRS parameter optimization options
 */
export interface OptimizationOptions {
    /** Search filter (e.g., "folder:Math") */
    searchQuery?: string;
    /** Minimum reviews to use */
    minReviews?: number;
    /** Skip first N days (learning phase) */
    excludeFirstDays?: number;
}

/**
 * Parameter optimization result
 */
export interface OptimizationResult {
    success: boolean;
    weights: number[];
    reviewCount: number;
    message: string;
}
