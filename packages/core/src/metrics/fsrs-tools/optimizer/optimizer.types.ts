/**
 * Types for FSRS parameter optimization
 */

import type { Grade } from "../../../types";

export interface OptimizationReviewEntry {
	cardId: string;
	reviewedAt: number;
	rating: Grade;
	scheduledDays: number;
	elapsedDays: number;
	state: number;
	stability: number;
	difficulty: number;
}

export interface OptimizationInput {
	reviews: OptimizationReviewEntry[];
	minReviews?: number;
	currentWeights?: number[];
}

export interface OptimizationOutput {
	weights: number[];
	metrics: {
		rmse: number;
		logLoss: number;
		reviewCount: number;
		convergenceStatus: "converged" | "max_iterations" | "insufficient_data";
	};
	improvement?: number;
}

export type OptimizationProgressCallback = (progress: {
	iteration: number;
	totalIterations: number;
	currentLoss: number;
}) => void;

export interface OptimizerOptions {
	onProgress?: OptimizationProgressCallback;
	abortSignal?: AbortSignal;
}
