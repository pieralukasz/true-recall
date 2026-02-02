/**
 * Queue Building Tests
 * Behavior-first tests for review queue construction
 *
 * These tests focus on queue ordering, learn-ahead logic, and edge cases
 * not covered in the main review.service.test.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { State } from "ts-fsrs";
import { ReviewService, type QueueBuildOptions } from "../../../src/services/review/review.service";
import { FSRSService } from "../../../src/services/core/fsrs.service";
import type { FSRSFlashcardItem } from "../../../src/types";
import {
	createMockFlashcard,
	createDefaultFSRSSettings,
} from "../mocks/fsrs.mocks";

/**
 * Create a card at a specific state with due time relative to "now"
 */
function createCardWithDue(
	id: string,
	state: State,
	dueOffsetMinutes: number
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

			const queue = reviewService.buildQueue(cards, fsrsService, defaultOptions);

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

			const queue = reviewService.buildQueue(cards, fsrsService, defaultOptions);

			// Earliest due should be first
			expect(queue[0]?.id).toBe("learning-earlier");
			expect(queue[1]?.id).toBe("learning-middle");
			expect(queue[2]?.id).toBe("learning-later");
		});
	});

	describe("Learn-Ahead Window (20 minutes)", () => {
		it("should include learning card due in 19 minutes (within learn-ahead)", () => {
			const cards = [
				createCardWithDue("learning-19", State.Learning, 19),
			];

			const queue = reviewService.buildQueue(cards, fsrsService, defaultOptions);

			// Card due in 19 min should be in queue (shown early)
			expect(queue).toHaveLength(1);
			expect(queue[0]?.id).toBe("learning-19");
		});

		it("should include learning card due exactly at 20 minutes", () => {
			const cards = [
				createCardWithDue("learning-20", State.Learning, 20),
			];

			const queue = reviewService.buildQueue(cards, fsrsService, defaultOptions);

			// Exactly at boundary - should be included (<=)
			expect(queue).toHaveLength(1);
		});

		it("should move learning card due in 21 minutes to pending", () => {
			const cards = [
				createCardWithDue("learning-21", State.Learning, 21),
			];

			const queue = reviewService.buildQueue(cards, fsrsService, defaultOptions);

			// Card due in 21 min should still be in queue, but as pending (at end)
			expect(queue).toHaveLength(1);
			expect(queue[0]?.id).toBe("learning-21");
		});
	});

	describe("Requeue Window (10 minutes)", () => {
		it("should requeue learning card due in 9 minutes", () => {
			const card = createCardWithDue("learning-9", State.Learning, 9);

			expect(reviewService.shouldRequeue(card)).toBe(true);
		});

		it("should requeue learning card due exactly at 10 minutes", () => {
			const card = createCardWithDue("learning-10", State.Learning, 10);

			// Exactly at boundary - should requeue (<=)
			expect(reviewService.shouldRequeue(card)).toBe(true);
		});

		it("should requeue learning card due in 11 minutes (positioned at end, shows waiting screen)", () => {
			const card = createCardWithDue("learning-11", State.Learning, 11);

			// Learning cards are always requeued - getRequeuePosition places them
			// at end if not due soon, and getPhase() shows waiting screen when reached
			expect(reviewService.shouldRequeue(card)).toBe(true);
		});
	});

	describe("Learning Card Multi-Study", () => {
		it("should allow same learning card to appear multiple times in session", () => {
			const learningCard = createCardWithDue("learning-multi", State.Learning, -5);

			// First pass: card is in queue even if marked as "reviewed today"
			const queue = reviewService.buildQueue([learningCard], fsrsService, {
				...defaultOptions,
				reviewedToday: new Set(["learning-multi"]),
			});

			expect(queue).toHaveLength(1);
			expect(queue[0]?.id).toBe("learning-multi");
		});

		it("should exclude Review cards that were reviewed today", () => {
			const reviewCard = createCardWithDue("review-done", State.Review, -60 * 24);

			const queue = reviewService.buildQueue([reviewCard], fsrsService, {
				...defaultOptions,
				reviewedToday: new Set(["review-done"]),
			});

			expect(queue).toHaveLength(0);
		});
	});

	describe("Project Filter Normalization", () => {
		it("should match cards with wiki-link brackets stripped", () => {
			const cards = [
				createMockFlashcard({
					id: "math-wiki",
					projects: ["[[Math]]"], // Wiki-link format
				}),
				createMockFlashcard({
					id: "math-plain",
					projects: ["Math"], // Plain format
				}),
				createMockFlashcard({
					id: "science",
					projects: ["Science"],
				}),
			];

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...defaultOptions,
				projectFilters: ["Math"],
			});

			// Both Math cards should match
			expect(queue).toHaveLength(2);
			expect(queue.map((c) => c.id)).toContain("math-wiki");
			expect(queue.map((c) => c.id)).toContain("math-plain");
		});

		it("should handle mixed wiki-link and plain project names", () => {
			const cards = [
				createMockFlashcard({
					id: "mixed",
					projects: ["[[Math]]", "Science", "[[History]]"],
				}),
			];

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...defaultOptions,
				projectFilters: ["History"],
			});

			expect(queue).toHaveLength(1);
			expect(queue[0]?.id).toBe("mixed");
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
					})
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
					})
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
						c.fsrs.state === State.Learning || c.fsrs.state === State.Relearning
				)
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
			const normalQueue = reviewService.buildQueue(cards, fsrsService, defaultOptions);
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
		it("should handle empty queue after filtering", () => {
			const cards = [
				createMockFlashcard({
					id: "wrong-project",
					projects: ["Science"],
				}),
			];

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...defaultOptions,
				projectFilters: ["Math"], // No cards match
			});

			expect(queue).toHaveLength(0);
		});

		it("should handle queue with ONLY pending learning cards", () => {
			const cards = [
				createCardWithDue("learning-30min", State.Learning, 30),
				createCardWithDue("learning-45min", State.Learning, 45),
			];

			const queue = reviewService.buildQueue(cards, fsrsService, defaultOptions);

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

		it("should handle cards with no projects (empty array)", () => {
			const cards = [
				createMockFlashcard({
					id: "no-projects",
					projects: [],
				}),
				createMockFlashcard({
					id: "has-project",
					projects: ["Math"],
				}),
			];

			// Filter by project should exclude card without projects
			const queue = reviewService.buildQueue(cards, fsrsService, {
				...defaultOptions,
				projectFilters: ["Math"],
			});

			expect(queue).toHaveLength(1);
			expect(queue[0]?.id).toBe("has-project");
		});
	});
});
