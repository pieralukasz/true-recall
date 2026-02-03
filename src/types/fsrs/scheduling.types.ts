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
