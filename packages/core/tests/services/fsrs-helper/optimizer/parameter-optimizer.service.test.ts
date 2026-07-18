/**
 * Replay-based FSRS optimizer tests.
 *
 * Synthetic review histories are generated with ts-fsrs itself using a
 * "true" weight vector different from the training start, so a working
 * optimizer must move multiple parameters — the historical failure mode
 * was a loss in which only the decay parameter (w20) had a gradient.
 */
import {
	default_w,
	FSRSAlgorithm,
	clipParameters,
	generatorParameters,
	Rating,
	State,
} from "ts-fsrs";
import { describe, expect, it } from "vitest";

import {
	isRecalled,
	ParameterOptimizerService,
} from "../../../../src/metrics/fsrs-tools/optimizer/parameter-optimizer.service";
import type { OptimizationReviewEntry } from "../../../../src/metrics/fsrs-tools/optimizer/optimizer.types";
import {
	hashString,
	mulberry32,
} from "../../../../src/metrics/fsrs-tools/scheduler/fuzz";
import type { Grade } from "../../../../src/types";

function generateReviews(
	trueWeights: number[],
	cards: number,
	reviewsPerCard: number,
): OptimizationReviewEntry[] {
	const algorithm = new FSRSAlgorithm(
		generatorParameters({ w: trueWeights, enable_short_term: true }),
	);
	const entries: OptimizationReviewEntry[] = [];

	for (let c = 0; c < cards; c++) {
		let state: { stability: number; difficulty: number } | null = null;
		let reviewedAt = 1_700_000_000_000 + c;

		for (let r = 0; r < reviewsPerCard; r++) {
			const elapsedDays = state ? Math.max(1, Math.round(state.stability)) : 0;
			reviewedAt += elapsedDays * 86_400_000;

			let rating: Grade;
			if (!state) {
				rating = Rating.Good as Grade;
			} else {
				const retrievability = algorithm.forgetting_curve(
					elapsedDays,
					state.stability,
				);
				const roll = mulberry32(hashString(`${c}:${r}`))();
				rating = (roll < retrievability ? Rating.Good : Rating.Again) as Grade;
			}

			entries.push({
				cardId: `card-${c}`,
				reviewedAt,
				rating,
				scheduledDays: elapsedDays,
				elapsedDays,
				state: State.Review,
				stability: state?.stability ?? 0,
				difficulty: state?.difficulty ?? 0,
			});
			state = algorithm.next_state(state, elapsedDays, rating);
		}
	}

	return entries;
}

describe("ParameterOptimizerService (replay-based)", () => {
	it("returns insufficient_data below the review threshold", async () => {
		const service = new ParameterOptimizerService();
		const reviews = generateReviews([...default_w], 10, 3);

		const result = await service.optimize({
			reviews,
			currentWeights: [...default_w],
		});

		expect(result.metrics.convergenceStatus).toBe("insufficient_data");
		expect(result.weights).toEqual([...default_w]);
	});

	it("improves the loss and moves more than just the decay parameter", async () => {
		const service = new ParameterOptimizerService();
		// True model has much stronger initial stabilities than the defaults
		const trueWeights = [...default_w];
		trueWeights[0] = 1.5;
		trueWeights[1] = 4.0;
		trueWeights[2] = 8.0;
		trueWeights[3] = 16.0;
		const reviews = generateReviews(trueWeights, 120, 4);

		const result = await service.optimize({
			reviews,
			currentWeights: [...default_w],
		});

		expect(result.improvement ?? 0).toBeGreaterThan(0);
		expect(["converged", "max_iterations"]).toContain(
			result.metrics.convergenceStatus,
		);

		const movedParams = result.weights.filter(
			(w, i) => Math.abs(w - (default_w[i] ?? 0)) > 1e-6,
		);
		expect(movedParams.length).toBeGreaterThan(1);
	}, 120_000);

	it("returns weights inside the valid FSRS parameter bounds", async () => {
		const service = new ParameterOptimizerService();
		const reviews = generateReviews([...default_w], 110, 4);

		const result = await service.optimize({
			reviews,
			currentWeights: [...default_w],
		});

		expect(clipParameters([...result.weights], 0)).toEqual(result.weights);
	}, 120_000);

	it("stops promptly when aborted", async () => {
		const service = new ParameterOptimizerService();
		const reviews = generateReviews([...default_w], 110, 4);
		const controller = new AbortController();
		let progressCalls = 0;

		const promise = service.optimize(
			{ reviews, currentWeights: [...default_w] },
			{
				abortSignal: controller.signal,
				onProgress: () => {
					progressCalls++;
					controller.abort();
				},
			},
		);
		const result = await promise;

		expect(progressCalls).toBeLessThanOrEqual(2);
		expect(result.weights).toHaveLength(21);
	}, 120_000);

	it("counts Hard as a successful recall and Again as a lapse", () => {
		expect(isRecalled(Rating.Hard as Grade)).toBe(true);
		expect(isRecalled(Rating.Good as Grade)).toBe(true);
		expect(isRecalled(Rating.Easy as Grade)).toBe(true);
		expect(isRecalled(Rating.Again as Grade)).toBe(false);
	});

	it("validates weight vectors", () => {
		const service = new ParameterOptimizerService();
		expect(service.validateWeights([...default_w])).toBe(true);
		expect(service.validateWeights([...default_w].slice(0, 19))).toBe(false);
		expect(service.validateWeights([])).toBe(false);
	});
});
