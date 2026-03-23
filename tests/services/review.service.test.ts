/**
 * Tests for ReviewService - queue building, answer processing, statistics
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { State, Rating } from "ts-fsrs";
import { ReviewService, type QueueBuildOptions } from "../../src/features/study/services/review.service";
import { FSRSService } from "../../src/features/core/services/fsrs.service";
import type { FSRSFlashcardItem, ReviewResult } from "../../src/shared/types/fsrs.types";
import {
	createMockFlashcard,
	createDefaultFSRSSettings,
	createMockReviewResult,
	createMixedCardQueue,
} from "./mocks/fsrs.mocks";

describe("ReviewService", () => {
	let reviewService: ReviewService;
	let fsrsService: FSRSService;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));
		reviewService = new ReviewService();
		fsrsService = new FSRSService(createDefaultFSRSSettings());
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("processAnswer", () => {
		it("should create ReviewResult with correct data", () => {
			const card = createMockFlashcard({
				id: "test-card",
				fsrs: {
					state: State.New,
					scheduledDays: 0,
					lastReview: null,
				},
			});

			const { result } = reviewService.processAnswer(
				card,
				Rating.Good,
				fsrsService,
				3000
			);

			expect(result.cardId).toBe("test-card");
			expect(result.rating).toBe(Rating.Good);
			expect(result.responseTime).toBe(3000);
			expect(result.previousState).toBe(State.New);
		});

		it("should return updated card with new FSRS data", () => {
			const card = createMockFlashcard({
				id: "test-card",
				fsrs: { state: State.New },
			});

			const { updatedCard } = reviewService.processAnswer(
				card,
				Rating.Good,
				fsrsService,
				1000
			);

			expect(updatedCard.fsrs.state).toBe(State.Learning);
			expect(updatedCard.fsrs.reps).toBe(1);
			expect(updatedCard.fsrs.lastReview).not.toBeNull();
		});

		it("should calculate elapsed days correctly for first review", () => {
			const card = createMockFlashcard({
				fsrs: { lastReview: null },
			});

			const { result } = reviewService.processAnswer(
				card,
				Rating.Good,
				fsrsService,
				1000
			);

			expect(result.elapsedDays).toBe(0);
		});

		it("should calculate elapsed days correctly for subsequent review", () => {
			const lastReview = new Date("2024-01-10T10:00:00Z"); // 5 days ago
			const card = createMockFlashcard({
				fsrs: {
					state: State.Review,
					lastReview: lastReview.toISOString(),
					due: new Date("2024-01-14T10:00:00Z").toISOString(), // Past due
					stability: 7,
					difficulty: 5,
				},
			});

			const { result } = reviewService.processAnswer(
				card,
				Rating.Good,
				fsrsService,
				1000
			);

			expect(result.elapsedDays).toBe(5);
		});

		it("should preserve previousScheduledDays in result", () => {
			const card = createMockFlashcard({
				fsrs: {
					state: State.Review,
					scheduledDays: 7,
					due: new Date("2024-01-14T10:00:00Z").toISOString(),
					lastReview: new Date("2024-01-07T10:00:00Z").toISOString(),
					stability: 7,
					difficulty: 5,
				},
			});

			const { result } = reviewService.processAnswer(
				card,
				Rating.Good,
				fsrsService,
				1000
			);

			expect(result.scheduledDays).toBe(7);
		});

		it("should set timestamp to current time", () => {
			const card = createMockFlashcard();
			const now = Date.now();

			const { result } = reviewService.processAnswer(
				card,
				Rating.Good,
				fsrsService,
				1000
			);

			expect(result.timestamp).toBe(now);
		});
	});

	describe("gradeCard", () => {
		it("returns persisted=false when FSRS write is rejected", async () => {
			const card = createMockFlashcard({
				id: "missing-card",
				fsrs: { state: State.New },
			});
			const flashcardManager = {
				updateCardFSRS: vi.fn(() => false),
			} as never;

			const result = await reviewService.gradeCard(
				card,
				Rating.Good,
				fsrsService,
				flashcardManager,
			);

			expect(result.persisted).toBe(false);
			expect(flashcardManager.updateCardFSRS).toHaveBeenCalledWith(
				"missing-card",
				result.updatedCard.fsrs,
			);
		});

		it("returns persisted=true when FSRS write succeeds", async () => {
			const card = createMockFlashcard({
				id: "existing-card",
				fsrs: { state: State.New },
			});
			const flashcardManager = {
				updateCardFSRS: vi.fn(() => true),
			} as never;

			const result = await reviewService.gradeCard(
				card,
				Rating.Good,
				fsrsService,
				flashcardManager,
			);

			expect(result.persisted).toBe(true);
		});
	});

	describe("calculateSessionStats", () => {
		it("should count ratings correctly", () => {
			const results = [
				createMockReviewResult({ rating: Rating.Again }),
				createMockReviewResult({ rating: Rating.Again }),
				createMockReviewResult({ rating: Rating.Hard }),
				createMockReviewResult({ rating: Rating.Good }),
				createMockReviewResult({ rating: Rating.Good }),
				createMockReviewResult({ rating: Rating.Good }),
				createMockReviewResult({ rating: Rating.Easy }),
			];

			const stats = reviewService.calculateSessionStats(
				results,
				10,
				Date.now() - 60000
			);

			expect(stats.again).toBe(2);
			expect(stats.hard).toBe(1);
			expect(stats.good).toBe(3);
			expect(stats.easy).toBe(1);
		});

		it("should count reviewed cards", () => {
			const results = [
				createMockReviewResult(),
				createMockReviewResult(),
				createMockReviewResult(),
			];

			const stats = reviewService.calculateSessionStats(results, 5, Date.now());

			expect(stats.reviewed).toBe(3);
			expect(stats.total).toBe(5);
		});

		it("should calculate duration correctly", () => {
			const startTime = Date.now() - 120000; // 2 minutes ago

			const stats = reviewService.calculateSessionStats([], 0, startTime);

			expect(stats.duration).toBeCloseTo(120000, -2);
		});

		it("should count new, learning, and review cards", () => {
			const results = [
				createMockReviewResult({ previousState: State.New }),
				createMockReviewResult({ previousState: State.New }),
				createMockReviewResult({ previousState: State.Learning }),
				createMockReviewResult({ previousState: State.Relearning }),
				createMockReviewResult({ previousState: State.Review }),
			];

			const stats = reviewService.calculateSessionStats(results, 5, Date.now());

			expect(stats.newCards).toBe(2);
			expect(stats.learningCards).toBe(2); // Learning + Relearning
			expect(stats.reviewCards).toBe(1);
		});

		it("should handle empty results", () => {
			const stats = reviewService.calculateSessionStats([], 0, Date.now());

			expect(stats.reviewed).toBe(0);
			expect(stats.again).toBe(0);
			expect(stats.hard).toBe(0);
			expect(stats.good).toBe(0);
			expect(stats.easy).toBe(0);
		});
	});

	describe("calculateRetentionRate", () => {
		it("should return 0 for empty results", () => {
			const rate = reviewService.calculateRetentionRate([]);
			expect(rate).toBe(0);
		});

		it("should return 1.0 for all Good/Easy ratings", () => {
			const results = [
				createMockReviewResult({ rating: Rating.Good }),
				createMockReviewResult({ rating: Rating.Easy }),
				createMockReviewResult({ rating: Rating.Good }),
			];

			const rate = reviewService.calculateRetentionRate(results);
			expect(rate).toBe(1);
		});

		it("should return 0 for all Again/Hard ratings", () => {
			const results = [
				createMockReviewResult({ rating: Rating.Again }),
				createMockReviewResult({ rating: Rating.Hard }),
			];

			const rate = reviewService.calculateRetentionRate(results);
			expect(rate).toBe(0);
		});

		it("should calculate correct ratio", () => {
			const results = [
				createMockReviewResult({ rating: Rating.Good }),
				createMockReviewResult({ rating: Rating.Again }),
				createMockReviewResult({ rating: Rating.Easy }),
				createMockReviewResult({ rating: Rating.Hard }),
			];

			const rate = reviewService.calculateRetentionRate(results);
			expect(rate).toBe(0.5); // 2 success out of 4
		});
	});

	describe("shouldRequeue", () => {
		it("should return true for Learning cards due soon", () => {
			const soon = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
			const card = createMockFlashcard({
				fsrs: {
					state: State.Learning,
					due: soon.toISOString(),
				},
			});

			expect(reviewService.shouldRequeue(card)).toBe(true);
		});

		it("should return true for Relearning cards due soon", () => {
			const soon = new Date(Date.now() + 5 * 60 * 1000);
			const card = createMockFlashcard({
				fsrs: {
					state: State.Relearning,
					due: soon.toISOString(),
				},
			});

			expect(reviewService.shouldRequeue(card)).toBe(true);
		});

		it("should return true for Learning cards even if due later (position determines when shown)", () => {
			const later = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
			const card = createMockFlashcard({
				fsrs: {
					state: State.Learning,
					due: later.toISOString(),
				},
			});

			// Learning cards are always requeued - getRequeuePosition determines where
			// When reached, getPhase() will show waiting screen if not yet due
			expect(reviewService.shouldRequeue(card)).toBe(true);
		});

		it("should return false for Review cards even if due soon", () => {
			const soon = new Date(Date.now() + 1 * 60 * 1000);
			const card = createMockFlashcard({
				fsrs: {
					state: State.Review,
					due: soon.toISOString(),
				},
			});

			expect(reviewService.shouldRequeue(card)).toBe(false);
		});

		it("should return false for New cards", () => {
			const card = createMockFlashcard({
				fsrs: { state: State.New },
			});

			expect(reviewService.shouldRequeue(card)).toBe(false);
		});
	});

	describe("getRequeuePosition", () => {
		it("should find correct position based on due time", () => {
			const queue = [
				createMockFlashcard({
					id: "card-1",
					fsrs: { due: new Date("2024-01-15T10:05:00Z").toISOString() },
				}),
				createMockFlashcard({
					id: "card-2",
					fsrs: { due: new Date("2024-01-15T10:15:00Z").toISOString() },
				}),
				createMockFlashcard({
					id: "card-3",
					fsrs: { due: new Date("2024-01-15T10:25:00Z").toISOString() },
				}),
			];

			const card = createMockFlashcard({
				fsrs: { due: new Date("2024-01-15T10:10:00Z").toISOString() },
			});

			const position = reviewService.getRequeuePosition(queue, 0, card);
			expect(position).toBe(1); // Between card-1 and card-2
		});

		it("should return startIndex for earliest due card", () => {
			const queue = [
				createMockFlashcard({
					fsrs: { due: new Date("2024-01-15T10:30:00Z").toISOString() },
				}),
			];

			const card = createMockFlashcard({
				fsrs: { due: new Date("2024-01-15T10:00:00Z").toISOString() },
			});

			const position = reviewService.getRequeuePosition(queue, 0, card);
			expect(position).toBe(0);
		});

		it("should return queue length for latest due card", () => {
			const queue = [
				createMockFlashcard({
					fsrs: { due: new Date("2024-01-15T10:00:00Z").toISOString() },
				}),
				createMockFlashcard({
					fsrs: { due: new Date("2024-01-15T10:10:00Z").toISOString() },
				}),
			];

			const card = createMockFlashcard({
				fsrs: { due: new Date("2024-01-15T11:00:00Z").toISOString() },
			});

			const position = reviewService.getRequeuePosition(queue, 0, card);
			expect(position).toBe(2);
		});

		it("should handle empty queue", () => {
			const card = createMockFlashcard();
			const position = reviewService.getRequeuePosition([], 0, card);
			expect(position).toBe(0);
		});

		it("should search only from startIndex", () => {
			const queue = [
				createMockFlashcard({
					id: "already-reviewed",
					fsrs: { due: new Date("2024-01-15T10:00:00Z").toISOString() },
				}),
				createMockFlashcard({
					id: "card-1",
					fsrs: { due: new Date("2024-01-15T10:20:00Z").toISOString() },
				}),
				createMockFlashcard({
					id: "card-2",
					fsrs: { due: new Date("2024-01-15T10:40:00Z").toISOString() },
				}),
			];

			const card = createMockFlashcard({
				fsrs: { due: new Date("2024-01-15T10:30:00Z").toISOString() },
			});

			const position = reviewService.getRequeuePosition(queue, 1, card);
			expect(position).toBe(2); // Between card-1 and card-2
		});
	});

	describe("buildQueue", () => {
		const defaultOptions: QueueBuildOptions = {
			newCardsLimit: 20,
			reviewsLimit: 200,
			reviewedToday: new Set(),
			newCardsStudiedToday: 0,
		};

		it("should respect new cards limit", () => {
			const cards = [];
			for (let i = 0; i < 30; i++) {
				cards.push(
					createMockFlashcard({
						id: `new-${i}`,
						fsrs: { state: State.New },
					})
				);
			}

			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Test mocks with minimal types
			const queue = reviewService.buildQueue(cards as FSRSFlashcardItem[], fsrsService, {
				...defaultOptions,
				newCardsLimit: 5,
			});

			const newInQueue = queue.filter((c) => c.fsrs.state === State.New);
			expect(newInQueue.length).toBe(5);
		});

		it("should exclude already reviewed cards", () => {
			const cards = [
				createMockFlashcard({
					id: "reviewed-1",
					fsrs: {
						state: State.Review,
						due: new Date("2024-01-14").toISOString(),
					},
				}),
				createMockFlashcard({
					id: "not-reviewed",
					fsrs: {
						state: State.Review,
						due: new Date("2024-01-14").toISOString(),
					},
				}),
			];

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...defaultOptions,
				reviewedToday: new Set(["reviewed-1"]),
			});

			expect(queue.find((c) => c.id === "reviewed-1")).toBeUndefined();
			expect(queue.find((c) => c.id === "not-reviewed")).toBeDefined();
		});

		it("should include Learning cards even if reviewed today", () => {
			const cards = [
				createMockFlashcard({
					id: "learning-1",
					fsrs: {
						state: State.Learning,
						due: new Date().toISOString(),
					},
				}),
			];

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...defaultOptions,
				reviewedToday: new Set(["learning-1"]),
			});

			expect(queue.find((c) => c.id === "learning-1")).toBeDefined();
		});

		it("should handle empty card list", () => {
			const queue = reviewService.buildQueue([], fsrsService, defaultOptions);
			expect(queue).toEqual([]);
		});

		it("should respect newCardsStudiedToday", () => {
			const cards = [];
			for (let i = 0; i < 10; i++) {
				cards.push(
					createMockFlashcard({
						id: `new-${i}`,
						fsrs: { state: State.New },
					})
				);
			}

			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Test mocks with minimal types
			const queue = reviewService.buildQueue(cards as FSRSFlashcardItem[], fsrsService, {
				...defaultOptions,
				newCardsLimit: 5,
				newCardsStudiedToday: 3, // Already studied 3
			});

			const newInQueue = queue.filter((c) => c.fsrs.state === State.New);
			expect(newInQueue.length).toBe(2); // 5 - 3 = 2 remaining
		});

		it("should apply newCardOrder: oldest-first", () => {
			const cards = [
				createMockFlashcard({
					id: "new-newer",
					fsrs: { state: State.New, createdAt: Date.now() },
				}),
				createMockFlashcard({
					id: "new-older",
					fsrs: { state: State.New, createdAt: Date.now() - 86400000 },
				}),
			];

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...defaultOptions,
				newCardOrder: "oldest-first",
			});

			const newCards = queue.filter((c) => c.fsrs.state === State.New);
			expect(newCards[0].id).toBe("new-older");
		});

		it("should filter weak cards when weakCardsOnly is true", () => {
			const cards = [
				createMockFlashcard({
					id: "weak",
					fsrs: { state: State.Review, stability: 3 },
				}),
				createMockFlashcard({
					id: "strong",
					fsrs: { state: State.Review, stability: 30 },
				}),
			];

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...defaultOptions,
				weakCardsOnly: true,
				bypassScheduling: true, // Include all regardless of due date
			});

			expect(queue.length).toBe(1);
			expect(queue[0].id).toBe("weak");
		});

		it("should bypass scheduling when bypassScheduling is true", () => {
			const futureDate = new Date("2024-01-20").toISOString();
			const cards = [
				createMockFlashcard({
					id: "future-review",
					fsrs: {
						state: State.Review,
						due: futureDate,
					},
				}),
			];

			// Without bypass: should be empty (not due)
			const normalQueue = reviewService.buildQueue(cards, fsrsService, {
				...defaultOptions,
			});
			expect(normalQueue.length).toBe(0);

			// With bypass: should include the card
			const bypassQueue = reviewService.buildQueue(cards, fsrsService, {
				...defaultOptions,
				bypassScheduling: true,
			});
			expect(bypassQueue.length).toBe(1);
		});

		it("should filter by source note names", () => {
			const cards = [
				createMockFlashcard({ id: "c1", sourceNoteName: "Note A" }),
				createMockFlashcard({ id: "c2", sourceNoteName: "Note B" }),
				createMockFlashcard({ id: "c3", sourceNoteName: "Note C" }),
			];

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...defaultOptions,
				sourceNoteFilters: ["Note A", "Note C"],
			});

			expect(queue.length).toBe(2);
			expect(queue.find((c) => c.sourceNoteName === "Note B")).toBeUndefined();
		});

		it("should filter by state", () => {
			const cards = createMixedCardQueue();

			const queue = reviewService.buildQueue(cards, fsrsService, {
				...defaultOptions,
				stateFilter: "new",
			});

			queue.forEach((card) => {
				expect(card.fsrs.state).toBe(State.New);
			});
		});

		it("should place due learning cards first", () => {
			const now = new Date();
			const cards = [
				createMockFlashcard({
					id: "new-1",
					fsrs: { state: State.New },
				}),
				createMockFlashcard({
					id: "learning-due",
					fsrs: {
						state: State.Learning,
						due: now.toISOString(), // Due now
					},
				}),
				createMockFlashcard({
					id: "review-due",
					fsrs: {
						state: State.Review,
						due: new Date("2024-01-14").toISOString(), // Past due
					},
				}),
			];

			const queue = reviewService.buildQueue(cards, fsrsService, defaultOptions);

			// Learning cards due now should be first
			expect(queue[0].id).toBe("learning-due");
		});
	});

	describe("getStreakInfo", () => {
		it("should return 0 for empty history", () => {
			const { currentStreak, longestStreak } = reviewService.getStreakInfo([]);

			expect(currentStreak).toBe(0);
			expect(longestStreak).toBe(0);
		});

		it("should count current streak correctly", () => {
			const today = new Date("2024-01-15T10:00:00Z");
			const yesterday = new Date("2024-01-14T10:00:00Z");
			const twoDaysAgo = new Date("2024-01-13T10:00:00Z");

			const results = [
				createMockReviewResult({ timestamp: twoDaysAgo.getTime() }),
				createMockReviewResult({ timestamp: yesterday.getTime() }),
				createMockReviewResult({ timestamp: today.getTime() }),
			];

			const { currentStreak, longestStreak } = reviewService.getStreakInfo(results);

			expect(currentStreak).toBe(3);
			expect(longestStreak).toBe(3);
		});

		it("should break streak on missed days", () => {
			const today = new Date("2024-01-15T10:00:00Z");
			const threeDaysAgo = new Date("2024-01-12T10:00:00Z");
			const fourDaysAgo = new Date("2024-01-11T10:00:00Z");

			const results = [
				createMockReviewResult({ timestamp: fourDaysAgo.getTime() }),
				createMockReviewResult({ timestamp: threeDaysAgo.getTime() }),
				createMockReviewResult({ timestamp: today.getTime() }),
			];

			const { currentStreak, longestStreak } = reviewService.getStreakInfo(results);

			// Current streak is just today (1), longest was 2 (four days ago + three days ago)
			expect(currentStreak).toBe(1);
			expect(longestStreak).toBe(2);
		});

		it("should count streak from yesterday if no review today", () => {
			// System time is 2024-01-15T10:00:00Z
			const yesterday = new Date("2024-01-14T10:00:00Z");
			const twoDaysAgo = new Date("2024-01-13T10:00:00Z");

			const results = [
				createMockReviewResult({ timestamp: twoDaysAgo.getTime() }),
				createMockReviewResult({ timestamp: yesterday.getTime() }),
			];

			const { currentStreak } = reviewService.getStreakInfo(results);

			// Last review was yesterday, streak continues
			expect(currentStreak).toBe(2);
		});

		it("should handle multiple reviews on same day", () => {
			const today = new Date("2024-01-15T10:00:00Z");
			const todayLater = new Date("2024-01-15T15:00:00Z");
			const yesterday = new Date("2024-01-14T10:00:00Z");

			const results = [
				createMockReviewResult({ timestamp: yesterday.getTime() }),
				createMockReviewResult({ timestamp: today.getTime() }),
				createMockReviewResult({ timestamp: todayLater.getTime() }),
			];

			const { currentStreak, longestStreak } = reviewService.getStreakInfo(results);

			// Multiple reviews on same day count as one day
			expect(currentStreak).toBe(2);
			expect(longestStreak).toBe(2);
		});
	});

	describe("calculateDailyStats", () => {
		it("should count new cards reviewed today", () => {
			const results = [
				createMockReviewResult({ previousState: State.New }),
				createMockReviewResult({ previousState: State.New }),
				createMockReviewResult({ previousState: State.Review }),
			];

			const stats = reviewService.calculateDailyStats([], results, {
				newCardsPerDay: 20,
				reviewsPerDay: 200,
			});

			expect(stats.newReviewed).toBe(2);
		});

		it("should calculate remaining new cards", () => {
			const results = [
				createMockReviewResult({ previousState: State.New }),
				createMockReviewResult({ previousState: State.New }),
				createMockReviewResult({ previousState: State.New }),
			];

			const stats = reviewService.calculateDailyStats([], results, {
				newCardsPerDay: 10,
				reviewsPerDay: 200,
			});

			expect(stats.newRemaining).toBe(7); // 10 - 3
		});

		it("should not go below 0 for remaining", () => {
			const results = [];
			for (let i = 0; i < 25; i++) {
				results.push(createMockReviewResult({ previousState: State.New }));
			}

			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Test mocks with minimal types
			const stats = reviewService.calculateDailyStats([], results as ReviewResult[], {
				newCardsPerDay: 20,
				reviewsPerDay: 200,
			});

			expect(stats.newRemaining).toBe(0);
		});

		it("should count total reviews completed", () => {
			const results = [
				createMockReviewResult(),
				createMockReviewResult(),
				createMockReviewResult(),
				createMockReviewResult(),
				createMockReviewResult(),
			];

			const stats = reviewService.calculateDailyStats([], results, {
				newCardsPerDay: 20,
				reviewsPerDay: 200,
			});

			expect(stats.reviewsCompleted).toBe(5);
		});

		it("should set today's date", () => {
			const stats = reviewService.calculateDailyStats([], [], {
				newCardsPerDay: 20,
				reviewsPerDay: 200,
			});

			// Date uses day boundary (default dayStartHour=4), not midnight
			const now = new Date();
			const boundary = new Date(now);
			if (now.getHours() < 4) {
				boundary.setDate(boundary.getDate() - 1);
			}
			boundary.setHours(4, 0, 0, 0);
			const y = boundary.getFullYear();
			const m = String(boundary.getMonth() + 1).padStart(2, "0");
			const d = String(boundary.getDate()).padStart(2, "0");
			const expectedDateStr = `${y}-${m}-${d}`;

			expect(stats.date).toBe(expectedDateStr);
		});
	});
});
