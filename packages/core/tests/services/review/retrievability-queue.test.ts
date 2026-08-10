/**
 * R-Mode Queue Tests
 *
 * R-Mode selects review cards by current retrievability instead of due date.
 * The invariants that matter: nothing is excluded for being "late", cards the
 * user would gain nothing from are excluded, urgent cards are never displaced
 * by the comfort quota, and an exhausted pool is reported as such.
 */

import { State } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FSRSService } from "../../../src/services/fsrs/fsrs.service";
import {
	buildRetrievabilityQueue,
	countRModePool,
	type RModeQueueOptions,
	resolveRModeOptions,
	summarizeRetrievability,
} from "../../../src/services/review/retrievability-queue";
import {
	type QueueBuildOptions,
	ReviewService,
} from "../../../src/services/review/review.service";
import type { FSRSFlashcardItem } from "../../../src/types";
import {
	createDefaultFSRSSettings,
	createMockFlashcard,
} from "../../mocks/fsrs.mocks";

const NOW = new Date("2024-06-15T10:00:00Z");

/**
 * Build a review card whose retrievability is controlled by how far past its
 * last review it sits relative to its stability.
 */
function createReviewCard(
	id: string,
	stability: number,
	elapsedDays: number,
): FSRSFlashcardItem {
	const lastReview = new Date(NOW.getTime() - elapsedDays * 86_400_000);
	const due = new Date(lastReview.getTime() + stability * 86_400_000);
	return createMockFlashcard({
		id,
		fsrs: {
			state: State.Review,
			due: due.toISOString(),
			lastReview: lastReview.toISOString(),
			stability,
			difficulty: 5,
			scheduledDays: stability,
			elapsedDays,
		},
	});
}

describe("R-Mode queue", () => {
	let fsrsService: FSRSService;

	const options: RModeQueueOptions = {
		targetCount: 10,
		comfortMix: 0.3,
		ceiling: 0.95,
		comfortFloor: 0.9,
		urgentBelow: 0.5,
	};

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		fsrsService = new FSRSService(createDefaultFSRSSettings());
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("saturation ceiling", () => {
		it("excludes cards whose retrievability is above the ceiling", () => {
			// Freshly reviewed: R sits at ~1.0, so a review would buy nothing.
			const fresh = createReviewCard("fresh", 100, 0);
			const result = buildRetrievabilityQueue(
				[fresh],
				fsrsService,
				options,
				NOW,
			);

			expect(result.cards).toHaveLength(0);
			expect(result.poolSize).toBe(0);
			expect(result.poolExhausted).toBe(true);
		});

		it("reports pool exhaustion when the pool is smaller than the request", () => {
			const cards = [
				createReviewCard("a", 10, 20),
				createReviewCard("b", 10, 25),
			];
			const result = buildRetrievabilityQueue(cards, fsrsService, options, NOW);

			expect(result.cards).toHaveLength(2);
			expect(result.poolExhausted).toBe(true);
		});

		it("does not report exhaustion when the pool exceeds the request", () => {
			const cards = Array.from({ length: 40 }, (_, i) =>
				createReviewCard(`c${i}`, 10, 15 + i),
			);
			const result = buildRetrievabilityQueue(
				cards,
				fsrsService,
				{ ...options, targetCount: 5 },
				NOW,
			);

			expect(result.cards).toHaveLength(5);
			expect(result.poolExhausted).toBe(false);
		});
	});

	describe("selection", () => {
		it("serves exactly the requested number of cards when the pool allows", () => {
			const cards = Array.from({ length: 50 }, (_, i) =>
				createReviewCard(`c${i}`, 10, 5 + i * 0.5),
			);
			const result = buildRetrievabilityQueue(
				cards,
				fsrsService,
				{ ...options, targetCount: 12 },
				NOW,
			);

			expect(result.cards).toHaveLength(12);
		});

		it("never returns duplicates", () => {
			const cards = Array.from({ length: 30 }, (_, i) =>
				createReviewCard(`c${i}`, 10, 5 + i),
			);
			const result = buildRetrievabilityQueue(
				cards,
				fsrsService,
				{ ...options, targetCount: 25 },
				NOW,
			);

			const ids = result.cards.map((card) => card.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		it("includes every urgent card before honouring the comfort quota", () => {
			// 10 cards deep below urgentBelow, plus plenty of comfortable ones.
			const urgent = Array.from({ length: 10 }, (_, i) =>
				createReviewCard(`urgent-${i}`, 1, 20 + i),
			);
			const comfortable = Array.from({ length: 30 }, (_, i) =>
				createReviewCard(`comfort-${i}`, 100, 3 + i * 0.1),
			);

			const result = buildRetrievabilityQueue(
				[...comfortable, ...urgent],
				fsrsService,
				{ ...options, targetCount: 10, comfortMix: 0.5 },
				NOW,
			);

			const servedUrgent = result.cards.filter((card) =>
				card.id.startsWith("urgent-"),
			);
			expect(servedUrgent).toHaveLength(10);
		});

		it("returns nothing when the requested count is zero", () => {
			const cards = [createReviewCard("a", 10, 20)];
			const result = buildRetrievabilityQueue(
				cards,
				fsrsService,
				{ ...options, targetCount: 0 },
				NOW,
			);

			expect(result.cards).toHaveLength(0);
			expect(result.poolSize).toBe(1);
		});
	});

	describe("ordering", () => {
		it("never runs more than three hard cards back to back while comfort cards remain", () => {
			const hard = Array.from({ length: 20 }, (_, i) =>
				createReviewCard(`hard-${i}`, 5, 10 + i),
			);
			// stability 100 with 60-79 elapsed days lands between comfortFloor and
			// ceiling: cards the user still knows, but not freshly reviewed.
			const comfortable = Array.from({ length: 20 }, (_, i) =>
				createReviewCard(`comfort-${i}`, 100, 60 + i),
			);

			const result = buildRetrievabilityQueue(
				[...hard, ...comfortable],
				fsrsService,
				{ ...options, targetCount: 20, comfortMix: 0.5 },
				NOW,
			);

			const isHard = result.cards.map(
				(card) =>
					fsrsService.getRetrievability(card.fsrs, NOW) < options.comfortFloor,
			);
			const lastComfortIndex = isHard.lastIndexOf(false);
			expect(lastComfortIndex).toBeGreaterThan(-1);

			// Past the final comfort card there is nothing left to break up a run,
			// so the cap only applies while the comfort band is not exhausted.
			let run = 0;
			for (let i = 0; i <= lastComfortIndex; i++) {
				run = isHard[i] ? run + 1 : 0;
				expect(run).toBeLessThanOrEqual(3);
			}
		});
	});

	describe("resolveRModeOptions", () => {
		const enabled = {
			enabled: true,
			defaultSessionSize: 30,
			comfortMix: 0.3,
			ceilingOffset: 0.05,
			urgentBelow: 0.5,
		};

		it("derives bands from the preset's request retention", () => {
			const resolved = resolveRModeOptions(enabled, 0.9, 20);

			expect(resolved?.targetCount).toBe(20);
			expect(resolved?.comfortMix).toBe(0.3);
			expect(resolved?.comfortFloor).toBe(0.9);
			expect(resolved?.urgentBelow).toBe(0.5);
			expect(resolved?.ceiling).toBeCloseTo(0.95, 6);
		});

		it("falls back to the due queue when settings predate R-Mode", () => {
			expect(resolveRModeOptions(undefined, 0.9, 20)).toBeUndefined();
		});

		it("falls back to the due queue only when the mode is off", () => {
			expect(
				resolveRModeOptions({ ...enabled, enabled: false }, 0.9, 20),
			).toBeUndefined();
		});

		it("uses the default size when an entry point states none", () => {
			// Commands and context menus start sessions without a size. Returning
			// undefined here would hand back a due-date queue while R-Mode is on.
			expect(resolveRModeOptions(enabled, 0.9, undefined)?.targetCount).toBe(
				30,
			);
		});

		it("honours an explicit zero instead of substituting the default", () => {
			// Zero is a real request: no reviews, just new and learning cards.
			expect(resolveRModeOptions(enabled, 0.9, 0)?.targetCount).toBe(0);
		});

		it("clamps a negative size to zero rather than to the default", () => {
			expect(resolveRModeOptions(enabled, 0.9, -5)?.targetCount).toBe(0);
		});

		it("never lets the ceiling reach certainty", () => {
			const resolved = resolveRModeOptions(
				{ ...enabled, ceilingOffset: 0.09 },
				0.99,
				10,
			);

			expect(resolved?.ceiling).toBeLessThan(1);
		});
	});

	describe("summarizeRetrievability", () => {
		it("splits cards across bands and reports the drawable pool", () => {
			// R values under default FSRS parameters: 1.00 / 0.92 / 0.87 / 0.36
			const cards = [
				createReviewCard("fresh", 100, 0),
				createReviewCard("known", 100, 70),
				createReviewCard("losing", 10, 15),
				createReviewCard("urgent", 0.5, 400),
			];

			const summary = summarizeRetrievability(cards, fsrsService, options, NOW);

			expect(summary.total).toBe(4);
			expect(summary.fresh).toBe(1);
			expect(summary.known).toBe(1);
			expect(summary.losing).toBe(1);
			expect(summary.urgent).toBe(1);
			expect(summary.pool).toBe(3);
			expect(summary.averageR).not.toBeNull();
		});

		it("reports no average for an empty set", () => {
			const summary = summarizeRetrievability([], fsrsService, options, NOW);

			expect(summary.total).toBe(0);
			expect(summary.averageR).toBeNull();
		});
	});

	describe("countRModePool", () => {
		it("counts only cards below the ceiling", () => {
			const cards = [
				createReviewCard("fresh", 100, 0),
				createReviewCard("stale-a", 10, 20),
				createReviewCard("stale-b", 10, 30),
			];

			expect(countRModePool(cards, fsrsService, 0.95, NOW)).toBe(2);
		});
	});
});

describe("R-Mode via buildQueue", () => {
	let reviewService: ReviewService;
	let fsrsService: FSRSService;

	const rModeOptions: RModeQueueOptions = {
		targetCount: 5,
		comfortMix: 0.3,
		ceiling: 0.95,
		comfortFloor: 0.9,
		urgentBelow: 0.5,
	};

	const baseOptions: QueueBuildOptions = {
		newCardsLimit: 20,
		reviewsLimit: 200,
		reviewedToday: new Set(),
		newCardsStudiedToday: 0,
		rMode: rModeOptions,
	};

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		reviewService = new ReviewService();
		fsrsService = new FSRSService(createDefaultFSRSSettings());
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("serves cards that are not due yet when their R has dropped enough", () => {
		// Due far in the future, but R is already well below the ceiling.
		const notDue = createReviewCard("not-due", 60, 40);
		expect(new Date(notDue.fsrs.due).getTime()).toBeGreaterThan(NOW.getTime());

		const queue = reviewService.buildQueue([notDue], fsrsService, baseOptions);

		expect(queue.map((card) => card.id)).toContain("not-due");
	});

	it("ignores the daily review limit", () => {
		const cards = Array.from({ length: 20 }, (_, i) =>
			createReviewCard(`c${i}`, 10, 15 + i),
		);

		const queue = reviewService.buildQueue(cards, fsrsService, {
			...baseOptions,
			reviewsLimit: 1,
			reviewsCompletedToday: 999,
			rMode: { ...rModeOptions, targetCount: 8 },
		});

		expect(
			queue.filter((card) => card.fsrs.state === State.Review),
		).toHaveLength(8);
	});

	it("leaves the due queue untouched when rMode is absent", () => {
		const notDue = createReviewCard("not-due", 60, 40);
		const { rMode: _rMode, ...withoutRMode } = baseOptions;

		const queue = reviewService.buildQueue(
			[notDue],
			fsrsService,
			withoutRMode as QueueBuildOptions,
		);

		expect(queue.map((card) => card.id)).not.toContain("not-due");
	});
});
