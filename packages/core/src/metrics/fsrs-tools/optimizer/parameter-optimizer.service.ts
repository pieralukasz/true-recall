/**
 * FSRS Parameter Optimizer Service
 */

import { forgetting_curve, type Rating, type State } from "ts-fsrs";
import { DEFAULT_FSRS_WEIGHTS } from "../../../constants";
import type {
	OptimizationInput,
	OptimizationOutput,
	OptimizationReviewEntry,
	OptimizerOptions,
} from "./optimizer.types";

const MIN_REVIEWS_FOR_OPTIMIZATION = 400;
const MAX_ITERATIONS = 1000;
const LEARNING_RATE = 0.01;
const CONVERGENCE_THRESHOLD = 1e-6;

interface TrainingDataPoint {
	elapsedDays: number;
	stability: number;
	difficulty: number;
	state: State;
	rating: number;
	wasRecalled: boolean;
}

export class ParameterOptimizerService {
	optimize(
		input: OptimizationInput,
		options?: OptimizerOptions,
	): OptimizationOutput {
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

		const trainingData = this.prepareTrainingData(input.reviews);

		let weights = input.currentWeights
			? [...input.currentWeights]
			: [...DEFAULT_FSRS_WEIGHTS];

		let previousLoss = Infinity;
		let convergenceStatus: OptimizationOutput["metrics"]["convergenceStatus"] =
			"max_iterations";

		for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
			if (options?.abortSignal?.aborted) {
				break;
			}

			const { loss, gradients } = this.calculateLossAndGradients(
				weights,
				trainingData,
			);

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
				const newW = w - LEARNING_RATE * grad;
				return this.clipWeight(newW, i);
			});

			previousLoss = loss;
		}

		const finalMetrics = this.calculateMetrics(weights, trainingData);

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

	private prepareTrainingData(
		reviews: OptimizationReviewEntry[],
	): TrainingDataPoint[] {
		const dataPoints: TrainingDataPoint[] = [];

		const cardReviews = new Map<string, OptimizationReviewEntry[]>();
		for (const review of reviews) {
			const existing = cardReviews.get(review.cardId) ?? [];
			existing.push(review);
			cardReviews.set(review.cardId, existing);
		}

		for (const cardRevs of cardReviews.values()) {
			cardRevs.sort((a, b) => a.reviewedAt - b.reviewedAt);

			for (let i = 1; i < cardRevs.length; i++) {
				const prev = cardRevs[i - 1];
				const curr = cardRevs[i];

				if (!prev || !curr) continue;

				if (curr.elapsedDays > 0) {
					dataPoints.push({
						elapsedDays: curr.elapsedDays,
						stability: prev.stability,
						difficulty: prev.difficulty,
						state: prev.state as unknown as State,
						rating: curr.rating as unknown as Rating,
						wasRecalled: (curr.rating as number) >= 3,
					});
				}
			}
		}

		return dataPoints;
	}

	private calculateLossAndGradients(
		weights: number[],
		data: TrainingDataPoint[],
	): { loss: number; gradients: number[] } {
		const avgLoss = this.calculateLoss(weights, data);

		const gradients = new Array<number>(weights.length).fill(0);
		const epsilon = 1e-4;

		for (let i = 0; i < weights.length; i++) {
			const weightsPlus = [...weights];
			const weightsMinus = [...weights];
			weightsPlus[i] = (weightsPlus[i] ?? 0) + epsilon;
			weightsMinus[i] = (weightsMinus[i] ?? 0) - epsilon;

			const lossPlus = this.calculateLoss(weightsPlus, data);
			const lossMinus = this.calculateLoss(weightsMinus, data);

			gradients[i] = (lossPlus - lossMinus) / (2 * epsilon);
		}

		return { loss: avgLoss, gradients };
	}

	private calculateLoss(weights: number[], data: TrainingDataPoint[]): number {
		let totalLoss = 0;

		for (const point of data) {
			const retrievability = forgetting_curve(
				weights,
				point.elapsedDays,
				Math.max(point.stability, 0.1),
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

	private calculateMetrics(
		weights: number[],
		data: TrainingDataPoint[],
	): { rmse: number; logLoss: number } {
		let totalLoss = 0;
		let totalSquaredError = 0;

		for (const point of data) {
			const retrievability = forgetting_curve(
				weights,
				point.elapsedDays,
				Math.max(point.stability, 0.1),
			);
			const clippedR = Math.max(0.001, Math.min(0.999, retrievability));

			if (point.wasRecalled) {
				totalLoss -= Math.log(clippedR);
			} else {
				totalLoss -= Math.log(1 - clippedR);
			}

			const actual = point.wasRecalled ? 1 : 0;
			totalSquaredError += (retrievability - actual) ** 2;
		}

		const n = Math.max(data.length, 1);
		return {
			logLoss: totalLoss / n,
			rmse: Math.sqrt(totalSquaredError / n),
		};
	}

	private clipWeight(value: number, index: number): number {
		const ranges: [number, number][] = [
			[0.01, 1.0],
			[0.5, 5.0],
			[1.0, 10.0],
			[2.0, 20.0],
			[1.0, 15.0],
			[0.1, 2.0],
			[0.5, 5.0],
			[0.0001, 0.1],
			[1.0, 5.0],
			[0.01, 0.5],
			[0.3, 2.0],
			[0.5, 3.0],
			[0.01, 0.3],
			[0.1, 0.5],
			[0.5, 3.0],
			[0.3, 1.0],
			[1.0, 3.0],
			[0.1, 1.0],
			[0.01, 0.3],
			[0.01, 0.2],
			[0.05, 0.5],
		];

		const range = ranges[index] ?? [0.001, 10.0];
		return Math.max(range[0], Math.min(range[1], value));
	}

	validateWeights(weights: number[]): boolean {
		if (!Array.isArray(weights)) return false;
		if (weights.length !== 21) return false;
		return weights.every(
			(w) => typeof w === "number" && Number.isFinite(w) && w > 0,
		);
	}
}
