/**
 * R-Mode queue construction through the real buildQueue entry point.
 *
 * The unit tests cover selection maths; these cover the contract with the rest
 * of the scheduler — what R-Mode changes (review selection) and, just as
 * importantly, what it must leave alone (learning steps, new cards, filters,
 * and the due-date path when the mode is off).
 */

import { State } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FSRSService } from "../../../src/services/fsrs/fsrs.service";
import type { RModeQueueOptions } from "../../../src/services/review/retrievability-queue";
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
const DAY = 86_400_000;

const R_MODE: RModeQueueOptions = {
	targetCount: 5,
	comfortMix: 0.3,
	ceiling: 0.95,
	comfortFloor: 0.9,
	urgentBelow: 0.5,
};

function reviewCard(
	id: string,
	stability: number,
	elapsedDays: number,
	extra: Partial<FSRSFlashcardItem> = {},
): FSRSFlashcardItem {
	const lastReview = new Date(NOW.getTime() - elapsedDays * DAY);
	return createMockFlashcard({
		id,
		...extra,
		fsrs: {
			state: State.Review,
			due: new Date(lastReview.getTime() + stability * DAY).toISOString(),
			lastReview: lastReview.toISOString(),
			stability,
			difficulty: 5,
			scheduledDays: stability,
			elapsedDays,
		},
	});
}

function stateCard(
	id: string,
	state: State,
	dueOffsetMinutes: number,
): FSRSFlashcardItem {
	return createMockFlashcard({
		id,
		fsrs: {
			state,
			due: new Date(NOW.getTime() + dueOffsetMinutes * 60_000).toISOString(),
			stability: state === State.New ? 0 : 0.4,
			difficulty: 5,
		},
	});
}

describe("buildQueue — R-Mode", () => {
	let reviewService: ReviewService;
	let fsrsService: FSRSService;

	const base: QueueBuildOptions = {
		newCardsLimit: 20,
		reviewsLimit: 200,
		reviewedToday: new Set(),
		newCardsStudiedToday: 0,
		rMode: R_MODE,
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

	describe("what R-Mode changes", () => {
		it("has no tomorrow boundary — future cards enter on R alone", () => {
			const farFuture = reviewCard("far", 60, 40);
			expect(new Date(farFuture.fsrs.due).getTime()).toBeGreaterThan(
				NOW.getTime() + DAY,
			);

			const queue = reviewService.buildQueue([farFuture], fsrsService, base);

			expect(queue.map((c) => c.id)).toContain("far");
		});

		it("excludes freshly reviewed cards even when they are due", () => {
			// Due right now, but R is still ~1.0 — a review would buy nothing.
			const fresh = reviewCard("fresh", 100, 0);

			const queue = reviewService.buildQueue([fresh], fsrsService, base);

			expect(queue.filter((c) => c.fsrs.state === State.Review)).toHaveLength(
				0,
			);
		});

		it("serves at most the requested number of review cards", () => {
			const cards = Array.from({ length: 40 }, (_, i) =>
				reviewCard(`c${i}`, 10, 15 + i),
			);

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...base,
				rMode: { ...R_MODE, targetCount: 7 },
			});

			expect(queue.filter((c) => c.fsrs.state === State.Review)).toHaveLength(
				7,
			);
		});

		it("ignores the daily review limit and today's completed count", () => {
			const cards = Array.from({ length: 20 }, (_, i) =>
				reviewCard(`c${i}`, 10, 15 + i),
			);

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...base,
				reviewsLimit: 1,
				reviewsCompletedToday: 9999,
				rMode: { ...R_MODE, targetCount: 8 },
			});

			expect(queue.filter((c) => c.fsrs.state === State.Review)).toHaveLength(
				8,
			);
		});
	});

	describe("a session of zero review cards", () => {
		it("still serves new cards", () => {
			const cards = [
				reviewCard("review", 10, 20),
				stateCard("new", State.New, 0),
			];

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...base,
				rMode: { ...R_MODE, targetCount: 0 },
			});

			expect(queue.map((c) => c.id)).toEqual(["new"]);
		});

		it("still serves due learning cards", () => {
			const cards = [
				reviewCard("review", 10, 20),
				stateCard("learn", State.Learning, -5),
			];

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...base,
				rMode: { ...R_MODE, targetCount: 0 },
			});

			expect(queue.map((c) => c.id)).toEqual(["learn"]);
		});

		it("serves no review cards at all", () => {
			const cards = Array.from({ length: 10 }, (_, i) =>
				reviewCard(`c${i}`, 10, 20 + i),
			);

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...base,
				rMode: { ...R_MODE, targetCount: 0 },
			});

			expect(queue).toHaveLength(0);
		});
	});

	describe("what R-Mode must leave alone", () => {
		it("keeps due learning cards at the front of the queue", () => {
			const cards = [
				reviewCard("review", 10, 20),
				stateCard("learn", State.Learning, -5),
			];

			const queue = reviewService.buildQueue(cards, fsrsService, base);

			expect(queue[0]?.id).toBe("learn");
		});

		it("keeps pending learning cards at the very end", () => {
			const cards = [
				reviewCard("review", 10, 20),
				stateCard("pending", State.Learning, 5),
			];

			const queue = reviewService.buildQueue(cards, fsrsService, base);

			expect(queue.at(-1)?.id).toBe("pending");
		});

		it("still applies the daily new-card limit", () => {
			const cards = Array.from({ length: 30 }, (_, i) =>
				stateCard(`n${i}`, State.New, 0),
			);

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...base,
				newCardsLimit: 4,
			});

			expect(queue.filter((c) => c.fsrs.state === State.New)).toHaveLength(4);
		});

		it("subtracts new cards already studied today", () => {
			const cards = Array.from({ length: 30 }, (_, i) =>
				stateCard(`n${i}`, State.New, 0),
			);

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...base,
				newCardsLimit: 10,
				newCardsStudiedToday: 7,
			});

			expect(queue.filter((c) => c.fsrs.state === State.New)).toHaveLength(3);
		});

		it("honours ignoreDailyLimits for new cards", () => {
			const cards = Array.from({ length: 12 }, (_, i) =>
				stateCard(`n${i}`, State.New, 0),
			);

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...base,
				newCardsLimit: 2,
				ignoreDailyLimits: true,
			});

			expect(queue.filter((c) => c.fsrs.state === State.New)).toHaveLength(12);
		});

		it("still excludes cards already reviewed today", () => {
			const cards = [reviewCard("a", 10, 20), reviewCard("b", 10, 25)];

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...base,
				reviewedToday: new Set(["a"]),
			});

			expect(queue.map((c) => c.id)).not.toContain("a");
			expect(queue.map((c) => c.id)).toContain("b");
		});

		it("still respects the source-uid filter", () => {
			const cards = [
				reviewCard("keep", 10, 20, { sourceUid: "uid-1" }),
				reviewCard("drop", 10, 20, { sourceUid: "uid-2" }),
			];

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...base,
				sourceUidFilter: new Set(["uid-1"]),
			});

			expect(queue.map((c) => c.id)).toEqual(["keep"]);
		});

		it("treats suspended cards exactly as the due queue does", () => {
			// buildQueue does not filter suspension — callers pass cards through
			// filterActiveCards first. What matters is that R-Mode does not
			// diverge from the due path and start leaking them on its own.
			const suspended = reviewCard("susp", 10, 20);
			suspended.fsrs.suspended = true;
			const cards = [suspended, reviewCard("ok", 10, 20)];
			const { rMode: _omit, ...dueMode } = base;

			const inRMode = reviewService
				.buildQueue(cards, fsrsService, base)
				.map((c) => c.id)
				.sort();
			const inDueMode = reviewService
				.buildQueue(cards, fsrsService, dueMode as QueueBuildOptions)
				.map((c) => c.id)
				.sort();

			expect(inRMode).toEqual(inDueMode);
		});
	});

	describe("mode isolation", () => {
		it("reverts to the due-date queue when rMode is absent", () => {
			const notDue = reviewCard("not-due", 60, 40);
			const { rMode: _omit, ...dueMode } = base;

			const queue = reviewService.buildQueue(
				[notDue],
				fsrsService,
				dueMode as QueueBuildOptions,
			);

			expect(queue.map((c) => c.id)).not.toContain("not-due");
		});

		it("leaves card scheduling data untouched either way", () => {
			const card = reviewCard("a", 10, 20);
			const before = JSON.stringify(card.fsrs);

			reviewService.buildQueue([card], fsrsService, base);
			const { rMode: _omit, ...dueMode } = base;
			reviewService.buildQueue(
				[card],
				fsrsService,
				dueMode as QueueBuildOptions,
			);

			expect(JSON.stringify(card.fsrs)).toBe(before);
		});

		it("yields the same card set both ways when everything is overdue", () => {
			// Long past due and well decayed: both modes should want these.
			const cards = Array.from({ length: 3 }, (_, i) =>
				reviewCard(`c${i}`, 5, 40 + i),
			);
			const { rMode: _omit, ...dueMode } = base;

			const inRMode = reviewService
				.buildQueue(cards, fsrsService, {
					...base,
					rMode: { ...R_MODE, targetCount: 3 },
				})
				.map((c) => c.id)
				.sort();
			const inDueMode = reviewService
				.buildQueue(cards, fsrsService, dueMode as QueueBuildOptions)
				.map((c) => c.id)
				.sort();

			expect(inRMode).toEqual(inDueMode);
		});
	});
});
