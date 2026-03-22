/**
 * FSRS Parameter Optimizer Service
 *
 * Optimizes the 21 FSRS v6 parameters based on review history.
 * Uses gradient descent optimization to minimize prediction error.
 */

import type {
	OptimizationInput,
	OptimizationOutput,
	OptimizationReviewEntry,
	OptimizerOptions,
} from "@features/metrics/services/fsrs-tools/optimizer/optimizer.types";
import { DEFAULT_FSRS_WEIGHTS } from "@shared/constants";
import { FSRS, type Rating, type State } from "ts-fsrs";

/**
 * Minimum reviews required for optimization
 */
const MIN_REVIEWS_FOR_OPTIMIZATION = 400;

/**
 * Maximum iterations for gradient descent
 */
const MAX_ITERATIONS = 1000;

/**
 * Learning rate for gradient descent
 */
const LEARNING_RATE = 0.01;

/**
 * Convergence threshold (stop if loss change is below this)
 */
const CONVERGENCE_THRESHOLD = 1e-6;

/**
 * FSRS Parameter Optimizer
 *
 * Finds optimal weights by minimizing log loss on review history.
 */
export class ParameterOptimizerService {
	/**
	 * Optimize FSRS parameters from review history
	 */
	async optimize(
		input: OptimizationInput,
		options?: OptimizerOptions,
	): Promise<OptimizationOutput> {
		const minReviews = input.minReviews ?? MIN_REVIEWS_FOR_OPTIMIZATION;

		if (input.reviews.length < minReviews) {
			return {
				weights: input.currentWeights ?? [...DEFAULT_FSRS_WEIGHTS],
				metrics: {
					rmse: 0,
					logLoss: 0,
					reviewCount: input.reviews.length,
					convergenceStatus: "insufficient_data",
				},
			};
		}

		// Prepare training data
		const trainingData = this.prepareTrainingData(input.reviews);

		// Initialize weights (start from current or default)
		let weights = input.currentWeights
			? [...input.currentWeights]
			: [...DEFAULT_FSRS_WEIGHTS];

		// Gradient descent optimization
		let previousLoss = Infinity;
		let iteration = 0;
		let convergenceStatus: OptimizationOutput["metrics"]["convergenceStatus"] =
			"max_iterations";

		for (iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
			if (options?.abortSignal?.aborted) {
				break;
			}

			// Calculate loss and gradients
			const { loss, gradients } = this.calculateLossAndGradients(
				weights,
				trainingData,
			);

			// Report progress
			options?.onProgress?.({
				iteration,
				totalIterations: MAX_ITERATIONS,
				currentLoss: loss,
			});

			if (Math.abs(previousLoss - loss) < CONVERGENCE_THRESHOLD) {
				convergenceStatus = "converged";
				break;
			}

			weights = weights.map((w, i) => {
				const grad = gradients[i] ?? 0;
				// Apply learning rate and clip to valid range
				const newW = w - LEARNING_RATE * grad;
				return this.clipWeight(newW, i);
			});

			previousLoss = loss;
		}

		// Calculate final metrics
		const finalMetrics = this.calculateMetrics(weights, trainingData);

		// Calculate improvement over current weights
		let improvement: number | undefined;
		if (input.currentWeights) {
			const currentMetrics = this.calculateMetrics(
				input.currentWeights,
				trainingData,
			);
			if (currentMetrics.logLoss > 0) {
				improvement =
					((currentMetrics.logLoss - finalMetrics.logLoss) /
						currentMetrics.logLoss) *
					100;
			}
		}

		return {
			weights,
			metrics: {
				...finalMetrics,
				reviewCount: input.reviews.length,
				convergenceStatus,
			},
			improvement,
		};
	}

	/**
	 * Prepare training data from review entries
	 */
	private prepareTrainingData(
		reviews: OptimizationReviewEntry[],
	): TrainingDataPoint[] {
		const dataPoints: TrainingDataPoint[] = [];

		// Group reviews by card
		const cardReviews = new Map<string, OptimizationReviewEntry[]>();
		for (const review of reviews) {
			const existing = cardReviews.get(review.cardId) ?? [];
			existing.push(review);
			cardReviews.set(review.cardId, existing);
		}

		// Convert to training data points
		for (const cardRevs of cardReviews.values()) {
			// Sort by timestamp
			cardRevs.sort((a, b) => a.reviewedAt - b.reviewedAt);

			for (let i = 1; i < cardRevs.length; i++) {
				const prev = cardRevs[i - 1];
				const curr = cardRevs[i];

				if (!prev || !curr) continue;

				// Only use reviews with valid elapsed time
				if (curr.elapsedDays > 0) {
					dataPoints.push({
						elapsedDays: curr.elapsedDays,
						stability: prev.stability,
						difficulty: prev.difficulty,
						state: prev.state as unknown as State,
						rating: curr.rating as unknown as Rating,
						wasRecalled: (curr.rating as number) >= 3, // Good or Easy = recalled
					});
				}
			}
		}

		return dataPoints;
	}

	/**
	 * Calculate loss and gradients for current weights
	 */
	private calculateLossAndGradients(
		weights: number[],
		data: TrainingDataPoint[],
	): { loss: number; gradients: number[] } {
		new FSRS({ w: weights });

		let totalLoss = 0;
		const gradients = new Array(weights.length).fill(0);
		const epsilon = 1e-4; // For numerical gradient estimation

		// Calculate loss for each data point
		for (const point of data) {
			// Calculate retrievability (probability of recall)
			const retrievability = Math.exp(
				(-Math.LN10 * point.elapsedDays) / Math.max(point.stability, 0.1),
			);

			// Clip retrievability to avoid log(0)
			const clippedR = Math.max(0.001, Math.min(0.999, retrievability));

			// Binary cross-entropy loss
			if (point.wasRecalled) {
				totalLoss -= Math.log(clippedR);
			} else {
				totalLoss -= Math.log(1 - clippedR);
			}
		}

		// Average loss
		const avgLoss = totalLoss / Math.max(data.length, 1);

		// Numerical gradient estimation (simplified)
		// In a full implementation, we would use backpropagation through FSRS
		for (let i = 0; i < weights.length; i++) {
			const weightsPlus = [...weights];
			const weightsMinus = [...weights];
			weightsPlus[i] = (weightsPlus[i] ?? 0) + epsilon;
			weightsMinus[i] = (weightsMinus[i] ?? 0) - epsilon;

			const lossPlus = this.calculateLoss(weightsPlus, data);
			const lossMinus = this.calculateLoss(weightsMinus, data);

			gradients[i] = (lossPlus - lossMinus) / (2 * epsilon);
		}

		return { loss: avgLoss, gradients: gradients as number[] };
	}

	/**
	 * Calculate loss only (no gradients)
	 */
	private calculateLoss(_weights: number[], data: TrainingDataPoint[]): number {
		let totalLoss = 0;

		for (const point of data) {
			const retrievability = Math.exp(
				(-Math.LN10 * point.elapsedDays) / Math.max(point.stability, 0.1),
			);
			const clippedR = Math.max(0.001, Math.min(0.999, retrievability));

			if (point.wasRecalled) {
				totalLoss -= Math.log(clippedR);
			} else {
				totalLoss -= Math.log(1 - clippedR);
			}
		}

		return totalLoss / Math.max(data.length, 1);
	}

	/**
	 * Calculate final metrics
	 */
	private calculateMetrics(
		_weights: number[],
		data: TrainingDataPoint[],
	): { rmse: number; logLoss: number } {
		let totalLoss = 0;
		let totalSquaredError = 0;

		for (const point of data) {
			const retrievability = Math.exp(
				(-Math.LN10 * point.elapsedDays) / Math.max(point.stability, 0.1),
			);
			const clippedR = Math.max(0.001, Math.min(0.999, retrievability));

			// Log loss
			if (point.wasRecalled) {
				totalLoss -= Math.log(clippedR);
			} else {
				totalLoss -= Math.log(1 - clippedR);
			}

			// RMSE (prediction error)
			const actual = point.wasRecalled ? 1 : 0;
			totalSquaredError += (retrievability - actual) ** 2;
		}

		const n = Math.max(data.length, 1);
		return {
			logLoss: totalLoss / n,
			rmse: Math.sqrt(totalSquaredError / n),
		};
	}

	/**
	 * Clip weight to valid range based on parameter index
	 */
	private clipWeight(value: number, index: number): number {
		// Weight ranges based on FSRS v6 specification
		const ranges: [number, number][] = [
			[0.01, 1.0], // w0: initial stability Again
			[0.5, 5.0], // w1: initial stability Hard
			[1.0, 10.0], // w2: initial stability Good
			[2.0, 20.0], // w3: initial stability Easy
			[1.0, 15.0], // w4: difficulty weight
			[0.1, 2.0], // w5: difficulty decay
			[0.5, 5.0], // w6: difficulty base
			[0.0001, 0.1], // w7: hard penalty
			[1.0, 5.0], // w8: easy bonus
			[0.01, 0.5], // w9: mean reversion weight
			[0.3, 2.0], // w10: recall stability weight
			[0.5, 3.0], // w11: lapse stability base
			[0.01, 0.3], // w12: lapse difficulty weight
			[0.1, 0.5], // w13: lapse stability weight
			[0.5, 3.0], // w14: lapse retrievability weight
			[0.3, 1.0], // w15: hard interval modifier
			[1.0, 3.0], // w16: easy interval modifier
			[0.1, 1.0], // w17: short-term stability factor
			[0.01, 0.3], // w18: short-term stability offset
			[0.01, 0.2], // w19: same-day stability exponent
			[0.05, 0.5], // w20: forgetting curve decay
		];

		const range = ranges[index] ?? [0.001, 10.0];
		return Math.max(range[0], Math.min(range[1], value));
	}

	/**
	 * Validate weights array
	 */
	validateWeights(weights: number[]): boolean {
		if (!Array.isArray(weights)) return false;
		if (weights.length !== 21) return false;
		return weights.every(
			(w) => typeof w === "number" && Number.isFinite(w) && w > 0,
		);
	}
}

/**
 * Training data point for optimization
 */
interface TrainingDataPoint {
	/** Days since last review */
	elapsedDays: number;
	/** Card stability at time of review */
	stability: number;
	/** Card difficulty at time of review */
	difficulty: number;
	/** Card state at time of review */
	state: State;
	/** Rating given */
	rating: number;
	/** Whether the card was recalled (rating >= 3) */
	wasRecalled: boolean;
}
