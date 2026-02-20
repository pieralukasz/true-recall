/**
 * Types for FSRS parameter optimization
 */

import type { Grade } from "../../../../../shared/types";

/**
 * Review data entry for parameter optimization
 */
export interface OptimizationReviewEntry {
	/** Card ID */
	cardId: string;
	/** Review timestamp (Unix ms) */
	reviewedAt: number;
	/** Rating given (1-4) */
	rating: Grade;
	/** Days scheduled at time of review */
	scheduledDays: number;
	/** Days elapsed since last review */
	elapsedDays: number;
	/** Card state at time of review (0=New, 1=Learning, 2=Review, 3=Relearning) */
	state: number;
	/** Card stability at time of review */
	stability: number;
	/** Card difficulty at time of review */
	difficulty: number;
}

/**
 * Input for the optimization algorithm
 */
export interface OptimizationInput {
	/** Review history entries */
	reviews: OptimizationReviewEntry[];
	/** Minimum reviews required (default 400) */
	minReviews?: number;
	/** Current weights to compare against (optional) */
	currentWeights?: number[];
}

/**
 * Output from the optimization algorithm
 */
export interface OptimizationOutput {
	/** Optimized weights (21 parameters for FSRS v6) */
	weights: number[];
	/** Optimization metrics */
	metrics: {
		/** Root mean square error */
		rmse: number;
		/** Log loss */
		logLoss: number;
		/** Number of reviews used */
		reviewCount: number;
		/** Convergence status */
		convergenceStatus: "converged" | "max_iterations" | "insufficient_data";
	};
	/** Improvement percentage over current/default weights (optional) */
	improvement?: number;
}

/**
 * Progress callback for optimization
 */
export type OptimizationProgressCallback = (progress: {
	/** Current iteration */
	iteration: number;
	/** Total iterations (estimate) */
	totalIterations: number;
	/** Current loss value */
	currentLoss: number;
}) => void;

/**
 * Options for optimization
 */
export interface OptimizerOptions {
	/** Progress callback */
	onProgress?: OptimizationProgressCallback;
	/** Abort signal for cancellation */
	abortSignal?: AbortSignal;
}
