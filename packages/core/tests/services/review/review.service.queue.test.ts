/**
 * Queue Building Tests
 * Behavior-first tests for review queue construction
 *
 * These tests focus on queue ordering, learn-ahead logic, and edge cases
 * not covered in the main review.service.test.ts
 */

import { State } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FSRSService } from "../../../src/services/fsrs/fsrs.service";
import {
	type QueueBuildOptions,
	ReviewService,
} from "../../../src/services/review/review.service";
import type { FSRSFlashcardItem } from "../../../src/types";
import {
	createDefaultFSRSSettings,
	createMockFlashcard,
} from "../../mocks/fsrs.mocks";

/**
 * Create a card at a specific state with due time relative to "now"
 */
function createCardWithDue(
	id: string,
	state: State,
	dueOffsetMinutes: number,
): FSRSFlashcardItem {
	const due = new Date(Date.now() + dueOffsetMinutes * 60 * 1000);
	return createMockFlashcard({
		id,
		fsrs: {
			state,
			due: due.toISOString(),
			stability: state === State.Review ? 7 : 0.4,
			difficulty: 5,
		},
	});
}

describe("Queue Building - Advanced", () => {
	let reviewService: ReviewService;
	let fsrsService: FSRSService;

	const defaultOptions: QueueBuildOptions = {
		newCardsLimit: 20,
		reviewsLimit: 200,
		reviewedToday: new Set(),
		newCardsStudiedToday: 0,
	};

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2024-06-15T10:00:00Z"));
		reviewService = new ReviewService();
		fsrsService = new FSRSService(createDefaultFSRSSettings());
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("Queue Priority Order", () => {
		it("should order: Due Learning → Review → New → Pending Learning", () => {
			const cards = [
				// New card
				createMockFlashcard({
					id: "new-1",
					fsrs: { state: State.New },
				}),
				// Review card (due yesterday)
				createCardWithDue("review-1", State.Review, -60 * 24), // 24 hours ago
				// Learning card due NOW (within learn-ahead)
				createCardWithDue("learning-due", State.Learning, -5), // 5 min ago
				// Learning card due in 25 min (beyond learn-ahead, pending)
				createCardWithDue("learning-pending", State.Learning, 25),
			];

			const queue = reviewService.buildQueue(
				cards,
				fsrsService,
				defaultOptions,
			);

			// Order should be: learning-due, review-1, new-1, learning-pending
			expect(queue.length).toBe(4);
			expect(queue[0]?.id).toBe("learning-due"); // Due learning first
			expect(queue[1]?.id).toBe("review-1"); // Review cards next
			expect(queue[2]?.id).toBe("new-1"); // New cards
			expect(queue[3]?.id).toBe("learning-pending"); // Pending learning last
		});

		it("should sort due learning cards by due date (earliest first)", () => {
			const cards = [
				createCardWithDue("learning-later", State.Learning, -2), // 2 min ago
				createCardWithDue("learning-earlier", State.Learning, -10), // 10 min ago
				createCardWithDue("learning-middle", State.Learning, -5), // 5 min ago
			];

			const queue = reviewService.buildQueue(
				cards,
				fsrsService,
				defaultOptions,
			);

			// Earliest due should be first
			expect(queue[0]?.id).toBe("learning-earlier");
			expect(queue[1]?.id).toBe("learning-middle");
			expect(queue[2]?.id).toBe("learning-later");
		});
	});

	describe("Learn-Ahead Window (20 minutes)", () => {
		it("should place not-yet-due learning card after new cards (pending at end)", () => {
			const cards = [
				createCardWithDue("new-card", State.New, 0),
				createCardWithDue("learning-19", State.Learning, 19),
			];

			const queue = reviewService.buildQueue(
				cards,
				fsrsService,
				defaultOptions,
			);

			expect(queue).toHaveLength(2);
			// Queue order: [due learning] → [review] → [new] → [pending learning]
			// Card due in 19min is pending (not yet due), goes AFTER new cards
			expect(queue[0]?.id).toBe("new-card");
			expect(queue[1]?.id).toBe("learning-19");
		});

		it("should include learning card due exactly at 20 minutes", () => {
			const cards = [createCardWithDue("learning-20", State.Learning, 20)];

			const queue = reviewService.buildQueue(
				cards,
				fsrsService,
				defaultOptions,
			);

			expect(queue).toHaveLength(1);
		});

		it("should exclude learning card beyond learn-ahead window (>20 min)", () => {
			const cards = [createCardWithDue("learning-21", State.Learning, 21)];

			const queue = reviewService.buildQueue(
				cards,
				fsrsService,
				defaultOptions,
			);

			// Still in queue (for waiting screen display) but at the end
			expect(queue).toHaveLength(1);
			expect(queue[0]?.id).toBe("learning-21");
		});

		it("should place due learning cards BEFORE new and review cards", () => {
			const cards = [
				createCardWithDue("new-card", State.New, 0),
				createCardWithDue("review-card", State.Review, -60), // 1 hour overdue
				createCardWithDue("learning-due", State.Learning, -5), // 5 min overdue
			];

			const queue = reviewService.buildQueue(
				cards,
				fsrsService,
				defaultOptions,
			);

			// Due learning cards always come first in the queue
			expect(queue[0]?.id).toBe("learning-due");
		});
	});

	describe("shouldRequeue — Learning cards always requeue", () => {
		it("should requeue learning card due soon", () => {
			const card = createCardWithDue("learning-9", State.Learning, 9);
			expect(reviewService.shouldRequeue(card)).toBe(true);
		});

		it("should requeue learning card due later", () => {
			const card = createCardWithDue("learning-30", State.Learning, 30);
			// Learning/Relearning cards are ALWAYS requeued regardless of due time
			// (getRequeuePosition decides WHERE in queue; getPhase shows waiting screen if not yet due)
			expect(reviewService.shouldRequeue(card)).toBe(true);
		});

		it("should NOT requeue Review cards", () => {
			const card = createCardWithDue("review-card", State.Review, -5);
			expect(reviewService.shouldRequeue(card)).toBe(false);
		});
	});

	describe("Learning Card Multi-Study", () => {
		it("should allow same learning card to appear multiple times in session", () => {
			const learningCard = createCardWithDue(
				"learning-multi",
				State.Learning,
				-5,
			);

			// First pass: card is in queue even if marked as "reviewed today"
			const queue = reviewService.buildQueue([learningCard], fsrsService, {
				...defaultOptions,
				reviewedToday: new Set(["learning-multi"]),
			});

			expect(queue).toHaveLength(1);
			expect(queue[0]?.id).toBe("learning-multi");
		});

		it("should exclude Review cards that were reviewed today", () => {
			const reviewCard = createCardWithDue(
				"review-done",
				State.Review,
				-60 * 24,
			);

			const queue = reviewService.buildQueue([reviewCard], fsrsService, {
				...defaultOptions,
				reviewedToday: new Set(["review-done"]),
			});

			expect(queue).toHaveLength(0);
		});
	});

	describe("Daily Limits", () => {
		it("should cap new cards at newCardsLimit", () => {
			const cards: FSRSFlashcardItem[] = [];
			for (let i = 0; i < 50; i++) {
				cards.push(
					createMockFlashcard({
						id: `new-${i}`,
						fsrs: { state: State.New },
					}),
				);
			}

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...defaultOptions,
				newCardsLimit: 10,
			});

			const newCards = queue.filter((c) => c.fsrs.state === State.New);
			expect(newCards).toHaveLength(10);
		});

		it("should account for newCardsStudiedToday", () => {
			const cards: FSRSFlashcardItem[] = [];
			for (let i = 0; i < 20; i++) {
				cards.push(
					createMockFlashcard({
						id: `new-${i}`,
						fsrs: { state: State.New },
					}),
				);
			}

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...defaultOptions,
				newCardsLimit: 10,
				newCardsStudiedToday: 8, // Already studied 8
			});

			const newCards = queue.filter((c) => c.fsrs.state === State.New);
			expect(newCards).toHaveLength(2); // Only 2 remaining (10 - 8)
		});

		it("should return no new cards if limit already reached", () => {
			const cards = [
				createMockFlashcard({
					id: "new-1",
					fsrs: { state: State.New },
				}),
			];

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...defaultOptions,
				newCardsLimit: 5,
				newCardsStudiedToday: 5, // Already at limit
			});

			const newCards = queue.filter((c) => c.fsrs.state === State.New);
			expect(newCards).toHaveLength(0);
		});

		it("should apply review limits per preset in global mode", () => {
			const cards: FSRSFlashcardItem[] = [
				createCardWithDue("default-1", State.Review, -300),
				createCardWithDue("default-2", State.Review, -290),
				createCardWithDue("default-3", State.Review, -280),
				createCardWithDue("pro-1", State.Review, -270),
				createCardWithDue("pro-2", State.Review, -260),
				createCardWithDue("pro-3", State.Review, -250),
			];

			const cardPresetById = new Map<string, string>([
				["default-1", "Default"],
				["default-2", "Default"],
				["default-3", "Default"],
				["pro-1", "Pro"],
				["pro-2", "Pro"],
				["pro-3", "Pro"],
			]);

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...defaultOptions,
				reviewsLimit: 1,
				cardPresetById,
				presetDailyLimits: new Map([
					["Default", { newCardsPerDay: 20, reviewsPerDay: 1 }],
					["Pro", { newCardsPerDay: 20, reviewsPerDay: 10 }],
				]),
				presetProgressToday: new Map([
					["Default", { newStudied: 0, reviewsCompleted: 0 }],
					["Pro", { newStudied: 0, reviewsCompleted: 0 }],
				]),
				defaultPresetName: "Default",
			});

			const defaultCards = queue.filter(
				(c) => cardPresetById.get(c.id) === "Default",
			);
			const proCards = queue.filter((c) => cardPresetById.get(c.id) === "Pro");

			expect(defaultCards).toHaveLength(1);
			expect(proCards).toHaveLength(3);
		});

		it("should still exclude reviewedToday review cards in global mode", () => {
			const cards: FSRSFlashcardItem[] = [
				createCardWithDue("default-done", State.Review, -120),
				createCardWithDue("pro-open", State.Review, -110),
			];
			const cardPresetById = new Map<string, string>([
				["default-done", "Default"],
				["pro-open", "Pro"],
			]);

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...defaultOptions,
				reviewedToday: new Set(["default-done"]),
				cardPresetById,
				presetDailyLimits: new Map([
					["Default", { newCardsPerDay: 20, reviewsPerDay: 50 }],
					["Pro", { newCardsPerDay: 20, reviewsPerDay: 50 }],
				]),
				presetProgressToday: new Map(),
				defaultPresetName: "Default",
			});

			expect(queue.map((c) => c.id)).toEqual(["pro-open"]);
		});

		it("should keep single-limit behavior when per-preset maps are not provided", () => {
			const cards: FSRSFlashcardItem[] = [
				createCardWithDue("review-1", State.Review, -60),
				createCardWithDue("review-2", State.Review, -50),
			];

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...defaultOptions,
				reviewsLimit: 1,
			});

			expect(queue).toHaveLength(1);
		});
	});

	describe("State Filters", () => {
		it("should filter to show only new cards", () => {
			const cards = [
				createMockFlashcard({ id: "new-1", fsrs: { state: State.New } }),
				createCardWithDue("review-1", State.Review, -60),
				createCardWithDue("learning-1", State.Learning, -5),
			];

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...defaultOptions,
				stateFilter: "new",
			});

			expect(queue.every((c) => c.fsrs.state === State.New)).toBe(true);
		});

		it("should filter to show only learning cards", () => {
			const cards = [
				createMockFlashcard({ id: "new-1", fsrs: { state: State.New } }),
				createCardWithDue("review-1", State.Review, -60),
				createCardWithDue("learning-1", State.Learning, -5),
				createCardWithDue("relearning-1", State.Relearning, -5),
			];

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...defaultOptions,
				stateFilter: "learning",
			});

			expect(
				queue.every(
					(c) =>
						c.fsrs.state === State.Learning ||
						c.fsrs.state === State.Relearning,
				),
			).toBe(true);
		});

		it("should filter to show only review cards (stateFilter: due)", () => {
			const cards = [
				createMockFlashcard({ id: "new-1", fsrs: { state: State.New } }),
				createCardWithDue("review-1", State.Review, -60),
				createCardWithDue("learning-1", State.Learning, -5),
			];

			// Note: stateFilter uses "due" for Review state cards
			const queue = reviewService.buildQueue(cards, fsrsService, {
				...defaultOptions,
				stateFilter: "due",
				bypassScheduling: true,
			});

			expect(queue.every((c) => c.fsrs.state === State.Review)).toBe(true);
		});

		it("should filter buried cards correctly", () => {
			const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
			const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

			const cards = [
				createMockFlashcard({
					id: "buried-future",
					fsrs: {
						state: State.Review,
						buriedUntil: tomorrow.toISOString(),
					},
				}),
				createMockFlashcard({
					id: "buried-past",
					fsrs: {
						state: State.Review,
						buriedUntil: yesterday.toISOString(), // Expired burial
					},
				}),
				createMockFlashcard({
					id: "not-buried",
					fsrs: { state: State.Review },
				}),
			];

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...defaultOptions,
				stateFilter: "buried",
				bypassScheduling: true,
			});

			// Only card with future buriedUntil should be in "buried" filter
			expect(queue).toHaveLength(1);
			expect(queue[0]?.id).toBe("buried-future");
		});
	});

	describe("Bypass Scheduling Mode", () => {
		it("should include all cards regardless of due date", () => {
			const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

			const cards = [
				createMockFlashcard({
					id: "future-review",
					fsrs: {
						state: State.Review,
						due: futureDate.toISOString(),
					},
				}),
			];

			// Normal mode: not due, not in queue
			const normalQueue = reviewService.buildQueue(
				cards,
				fsrsService,
				defaultOptions,
			);
			expect(normalQueue).toHaveLength(0);

			// Bypass mode: included regardless
			const bypassQueue = reviewService.buildQueue(cards, fsrsService, {
				...defaultOptions,
				bypassScheduling: true,
			});
			expect(bypassQueue).toHaveLength(1);
		});

		it("should include suspended cards (filtering happens in UI layer)", () => {
			// Note: ReviewService.buildQueue() does NOT filter suspended cards
			// Suspended card filtering happens in filterActiveCards() in session-helpers.ts
			// This is intentional - the UI layer handles this filtering
			const cards = [
				createMockFlashcard({
					id: "suspended",
					fsrs: {
						state: State.Review,
						suspended: true,
					},
				}),
			];

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...defaultOptions,
				bypassScheduling: true,
			});

			// buildQueue includes suspended cards - UI filters them later
			expect(queue).toHaveLength(1);
		});
	});

	describe("Edge Cases", () => {
		it("should handle queue with ONLY pending learning cards", () => {
			const cards = [
				createCardWithDue("learning-30min", State.Learning, 30),
				createCardWithDue("learning-45min", State.Learning, 45),
			];

			const queue = reviewService.buildQueue(
				cards,
				fsrsService,
				defaultOptions,
			);

			// Both should be in queue as pending
			expect(queue).toHaveLength(2);
		});

		it("should handle all cards already reviewed today", () => {
			const reviewCard = createCardWithDue("review-1", State.Review, -60);

			const queue = reviewService.buildQueue([reviewCard], fsrsService, {
				...defaultOptions,
				reviewedToday: new Set(["review-1"]),
			});

			expect(queue).toHaveLength(0);
		});
	});
});

describe("Anki-style custom study queues", () => {
	let reviewService: ReviewService;
	let fsrsService: FSRSService;
	const baseOptions: QueueBuildOptions = {
		newCardsLimit: 20,
		reviewsLimit: 200,
		reviewedToday: new Set(),
	};

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2024-06-15T10:00:00Z"));
		reviewService = new ReviewService();
		fsrsService = new FSRSService(createDefaultFSRSSettings());
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("builds forgotten cards from Again review-log matches, including cards reviewed today", () => {
		const forgotten = createMockFlashcard({
			id: "forgotten",
			fsrs: { state: State.Review },
		});
		const other = createMockFlashcard({
			id: "other",
			fsrs: { state: State.Review },
		});

		const queue = reviewService.buildQueue([forgotten, other], fsrsService, {
			...baseOptions,
			reviewedToday: new Set(["forgotten"]),
			customStudy: { kind: "forgotten", days: 1 },
			forgottenCardIds: new Set(["forgotten"]),
		});

		expect(queue.map((card) => card.id)).toEqual(["forgotten"]);
	});

	it("includes only non-new cards inside the review-ahead window", () => {
		const cards = [
			createCardWithDue("tomorrow", State.Review, 24 * 60),
			createCardWithDue("next-week", State.Review, 7 * 24 * 60),
			createCardWithDue("new", State.New, 0),
		];

		const queue = reviewService.buildQueue(cards, fsrsService, {
			...baseOptions,
			customStudy: { kind: "review-ahead", days: 2 },
		});

		expect(queue.map((card) => card.id)).toEqual(["tomorrow"]);
	});

	it("previews only new cards added inside the selected day window", () => {
		const recent = createMockFlashcard({
			id: "recent",
			fsrs: {
				state: State.New,
				createdAt: new Date("2024-06-14T12:00:00Z").getTime(),
			},
		});
		const old = createMockFlashcard({
			id: "old",
			fsrs: {
				state: State.New,
				createdAt: new Date("2024-06-12T12:00:00Z").getTime(),
			},
		});

		const queue = reviewService.buildQueue([recent, old], fsrsService, {
			...baseOptions,
			dayStartHour: 4,
			customStudy: { kind: "preview-new", days: 2 },
		});

		expect(queue.map((card) => card.id)).toEqual(["recent"]);
	});

	it("applies include and exclude tags before the state-or-tag limit", () => {
		const cards = [
			createMockFlashcard({ id: "keep", tags: ["biology"] }),
			createMockFlashcard({ id: "exclude", tags: ["biology", "skip"] }),
			createMockFlashcard({ id: "other", tags: ["history"] }),
		];

		const queue = reviewService.buildQueue(cards, fsrsService, {
			...baseOptions,
			customStudy: {
				kind: "state-or-tag",
				cardState: "all",
				cardLimit: 10,
				tagsToInclude: ["biology"],
				tagsToExclude: ["skip"],
			},
		});

		expect(queue.map((card) => card.id)).toEqual(["keep"]);
	});

	it("replays a materialized filtered deck in its captured order", () => {
		const cards = [
			createMockFlashcard({ id: "first", tags: ["old-filter"] }),
			createMockFlashcard({ id: "second", tags: ["old-filter"] }),
			createMockFlashcard({ id: "outside", tags: ["new-filter"] }),
		];

		const queue = reviewService.buildQueue(cards, fsrsService, {
			...baseOptions,
			reviewedToday: new Set(["first", "second"]),
			customStudy: {
				kind: "state-or-tag",
				cardState: "all",
				cardLimit: 100,
				tagsToInclude: ["new-filter"],
				tagsToExclude: [],
			},
			materializedCardIds: ["second", "first"],
		});

		expect(queue.map((card) => card.id)).toEqual(["second", "first"]);
	});

	it("omits cards removed after a filtered deck was materialized", () => {
		const remaining = createMockFlashcard({ id: "remaining" });

		const queue = reviewService.buildQueue([remaining], fsrsService, {
			...baseOptions,
			customStudy: { kind: "forgotten", days: 1 },
			materializedCardIds: ["deleted", "remaining"],
		});

		expect(queue.map((card) => card.id)).toEqual(["remaining"]);
	});

	it("keeps filtered-deck cards out of a regular review queue", () => {
		const cards = [
			createCardWithDue("in-filtered-deck", State.Review, -60),
			createCardWithDue("regular", State.Review, -30),
		];

		const queue = reviewService.buildQueue(cards, fsrsService, {
			...baseOptions,
			temporaryDeckCardIds: new Set(["in-filtered-deck"]),
		});

		expect(queue.map((card) => card.id)).toEqual(["regular"]);
	});
});
