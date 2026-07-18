/**
 * FSRS Parameter Optimizer Service
 *
 * Replay-based training: every candidate weight vector re-simulates each
 * card's full review history through ts-fsrs state equations, then scores
 * the predicted recall probability against the actual outcome. This makes
 * all 21 parameters observable in the loss — unlike scoring against the
 * stability stored in the logs, which was produced by the old weights and
 * leaves every parameter except the forgetting-curve decay with a zero
 * gradient.
 *
 * FSRS convention: Hard is a successful recall; only Again is a lapse.
 */

import {
	clipParameters,
	default_w,
	FSRSAlgorithm,
	generatorParameters,
	Rating,
} from "ts-fsrs";

import type { Grade } from "../../../types";
import type {
	OptimizationInput,
	OptimizationOutput,
	OptimizationReviewEntry,
	OptimizerOptions,
} from "./optimizer.types";

const MIN_REVIEWS_FOR_OPTIMIZATION = 400;
const MAX_ITERATIONS = 150;
/** Stop when the loss improves less than this (relative) for PATIENCE iterations */
const CONVERGENCE_THRESHOLD = 1e-5;
const PATIENCE = 8;

const ADAM_LEARNING_RATE = 0.04;
const ADAM_BETA1 = 0.9;
const ADAM_BETA2 = 0.999;
const ADAM_EPSILON = 1e-8;

/** Clamp for predicted recall inside the log-loss */
const MIN_PREDICTION = 0.001;
const MAX_PREDICTION = 0.999;

interface ReviewStep {
	elapsedDays: number;
	rating: Grade;
}

interface ReplayMetrics {
	avgLoss: number;
	rmse: number;
	predictionCount: number;
}

/** FSRS training label: Hard/Good/Easy are successful recalls, Again is not */
export function isRecalled(rating: Grade): boolean {
	return rating > Rating.Again;
}

export class ParameterOptimizerService {
	async optimize(
		input: OptimizationInput,
		options?: OptimizerOptions,
	): Promise<OptimizationOutput> {
		const minReviews = input.minReviews ?? MIN_REVIEWS_FOR_OPTIMIZATION;

		if (input.reviews.length < minReviews) {
			return {
				weights: input.currentWeights ?? [...default_w],
				metrics: {
					rmse: 0,
					logLoss: 0,
					reviewCount: input.reviews.length,
					convergenceStatus: "insufficient_data",
				},
			};
		}

		const sequences = this.prepareSequences(input.reviews);
		const startWeights = clipParameters(
			[...(input.currentWeights ?? default_w)],
			0,
		);

		let weights = [...startWeights];
		let bestWeights = [...weights];
		let bestLoss = this.evaluate(weights, sequences).avgLoss;

		const m = new Array<number>(weights.length).fill(0);
		const v = new Array<number>(weights.length).fill(0);
		let previousLoss = bestLoss;
		let stagnantIterations = 0;
		let convergenceStatus: OptimizationOutput["metrics"]["convergenceStatus"] =
			"max_iterations";

		for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
			if (options?.abortSignal?.aborted) break;

			const base = this.evaluate(weights, sequences);
			if (base.avgLoss < bestLoss) {
				bestLoss = base.avgLoss;
				bestWeights = [...weights];
			}

			options?.onProgress?.({
				iteration,
				totalIterations: MAX_ITERATIONS,
				currentLoss: base.avgLoss,
			});

			const relativeChange =
				Math.abs(previousLoss - base.avgLoss) / Math.max(previousLoss, 1e-9);
			stagnantIterations =
				relativeChange < CONVERGENCE_THRESHOLD ? stagnantIterations + 1 : 0;
			if (stagnantIterations >= PATIENCE) {
				convergenceStatus = "converged";
				break;
			}
			previousLoss = base.avgLoss;

			const gradients = this.numericGradients(weights, sequences, base.avgLoss);

			for (let i = 0; i < weights.length; i++) {
				const grad = gradients[i] ?? 0;
				m[i] = ADAM_BETA1 * (m[i] ?? 0) + (1 - ADAM_BETA1) * grad;
				v[i] = ADAM_BETA2 * (v[i] ?? 0) + (1 - ADAM_BETA2) * grad * grad;
				const mHat = (m[i] ?? 0) / (1 - ADAM_BETA1 ** iteration);
				const vHat = (v[i] ?? 0) / (1 - ADAM_BETA2 ** iteration);
				weights[i] =
					(weights[i] ?? 0) -
					(ADAM_LEARNING_RATE * mHat) / (Math.sqrt(vHat) + ADAM_EPSILON);
			}
			weights = clipParameters(weights, 0);

			// Keep the UI responsive — this runs on the plugin's main thread
			await new Promise<void>((resolve) => setTimeout(resolve, 0));
		}

		const finalMetrics = this.evaluate(bestWeights, sequences);

		let improvement: number | undefined;
		if (input.currentWeights) {
			const currentMetrics = this.evaluate(startWeights, sequences);
			if (currentMetrics.avgLoss > 0) {
				improvement =
					((currentMetrics.avgLoss - finalMetrics.avgLoss) /
						currentMetrics.avgLoss) *
					100;
			}
		}

		return {
			weights: bestWeights,
			metrics: {
				logLoss: finalMetrics.avgLoss,
				rmse: finalMetrics.rmse,
				reviewCount: input.reviews.length,
				convergenceStatus,
			},
			improvement,
		};
	}

	/**
	 * Group reviews into per-card chronological sequences. The first review
	 * of a card initializes its memory state; later ones both score the
	 * prediction (when at least a day elapsed) and advance the state.
	 */
	private prepareSequences(reviews: OptimizationReviewEntry[]): ReviewStep[][] {
		const byCard = new Map<string, OptimizationReviewEntry[]>();
		for (const review of reviews) {
			const existing = byCard.get(review.cardId) ?? [];
			existing.push(review);
			byCard.set(review.cardId, existing);
		}

		const sequences: ReviewStep[][] = [];
		for (const cardReviews of byCard.values()) {
			cardReviews.sort((a, b) => a.reviewedAt - b.reviewedAt);
			sequences.push(
				cardReviews.map((review) => ({
					elapsedDays: Math.max(0, review.elapsedDays),
					rating: review.rating,
				})),
			);
		}
		return sequences;
	}

	/** Replay all sequences with the given weights and score the predictions */
	private evaluate(weights: number[], sequences: ReviewStep[][]): ReplayMetrics {
		const algorithm = new FSRSAlgorithm(
			generatorParameters({ w: weights, enable_short_term: true }),
		);

		let totalLoss = 0;
		let totalSquaredError = 0;
		let predictionCount = 0;

		for (const sequence of sequences) {
			let state: { stability: number; difficulty: number } | null = null;
			for (const step of sequence) {
				if (state && step.elapsedDays > 0) {
					const retrievability = algorithm.forgetting_curve(
						step.elapsedDays,
						state.stability,
					);
					const clipped = Math.max(
						MIN_PREDICTION,
						Math.min(MAX_PREDICTION, retrievability),
					);
					const wasRecalled = isRecalled(step.rating);

					totalLoss -= wasRecalled ? Math.log(clipped) : Math.log(1 - clipped);
					totalSquaredError += (retrievability - (wasRecalled ? 1 : 0)) ** 2;
					predictionCount++;
				}
				state = algorithm.next_state(state, step.elapsedDays, step.rating);
			}
		}

		const n = Math.max(predictionCount, 1);
		return {
			avgLoss: totalLoss / n,
			rmse: Math.sqrt(totalSquaredError / n),
			predictionCount,
		};
	}

	/**
	 * Forward-difference gradients against the already-computed base loss.
	 * When a parameter sits at its upper clip bound the probe flips backward
	 * so the perturbed vector stays inside the valid region.
	 */
	private numericGradients(
		weights: number[],
		sequences: ReviewStep[][],
		baseLoss: number,
	): number[] {
		const gradients = new Array<number>(weights.length).fill(0);

		for (let i = 0; i < weights.length; i++) {
			const value = weights[i] ?? 0;
			const epsilon = Math.max(1e-4, Math.abs(value) * 1e-3);

			const probe = [...weights];
			probe[i] = value + epsilon;
			const clippedForward = clipParameters([...probe], 0);
			if ((clippedForward[i] ?? 0) > value) {
				probe[i] = clippedForward[i] ?? value;
				const lossPlus = this.evaluate(probe, sequences).avgLoss;
				gradients[i] = (lossPlus - baseLoss) / ((probe[i] ?? 0) - value);
				continue;
			}

			probe[i] = value - epsilon;
			const clippedBackward = clipParameters([...probe], 0);
			if ((clippedBackward[i] ?? 0) < value) {
				probe[i] = clippedBackward[i] ?? value;
				const lossMinus = this.evaluate(probe, sequences).avgLoss;
				gradients[i] = (baseLoss - lossMinus) / (value - (probe[i] ?? 0));
			}
		}

		return gradients;
	}

	validateWeights(weights: number[]): boolean {
		if (!Array.isArray(weights)) return false;
		if (weights.length !== 21) return false;
		return weights.every(
			(w) => typeof w === "number" && Number.isFinite(w) && w >= 0,
		);
	}
}
