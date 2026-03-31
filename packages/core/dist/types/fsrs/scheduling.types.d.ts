export interface SchedulingPreview {
    again: {
        due: Date;
        interval: string;
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
export interface HistoryValidationResult {
    isValid: boolean;
    totalReviews: number;
    totalCards: number;
    message: string;
    warnings: string[];
}
export interface OptimizationOptions {
    searchQuery?: string;
    minReviews?: number;
    excludeFirstDays?: number;
}
export interface OptimizationResult {
    success: boolean;
    weights: number[];
    reviewCount: number;
    message: string;
}
