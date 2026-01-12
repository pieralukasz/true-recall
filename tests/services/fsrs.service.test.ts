/**
 * Tests for FSRSService - core FSRS scheduling logic
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { State, Rating } from "ts-fsrs";
import { FSRSService } from "../../src/services/core/fsrs.service";
import {
	createMockCard,
	createNewCard,
	createLearningCard,
	createReviewCard,
	createRelearningCard,
	createMockFlashcard,
	createDefaultFSRSSettings,
	createMixedCardQueue,
} from "./mocks/fsrs.mocks";

describe("FSRSService", () => {
	let service: FSRSService;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));
		service = new FSRSService(createDefaultFSRSSettings());
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("createNewCard", () => {
		it("should create card with New state", () => {
			const card = service.createNewCard("test-id");
			expect(card.state).toBe(State.New);
		});

		it("should preserve card ID", () => {
			const card = service.createNewCard("my-unique-id");
			expect(card.id).toBe("my-unique-id");
		});

		it("should have zero reps and lapses", () => {
			const card = service.createNewCard("test-id");
			expect(card.reps).toBe(0);
			expect(card.lapses).toBe(0);
		});

		it("should have null lastReview", () => {
			const card = service.createNewCard("test-id");
			expect(card.lastReview).toBeNull();
		});

		it("should set due date to now", () => {
			const card = service.createNewCard("test-id");
			const dueDate = new Date(card.due);
			expect(dueDate.getTime()).toBe(Date.now());
		});
	});

	describe("scheduleCard", () => {
		it("should transition New → Learning on first review with Good", () => {
			const card = createNewCard("test-card");
			const result = service.scheduleCard(card, Rating.Good);

			expect(result.state).toBe(State.Learning);
			expect(result.reps).toBe(1);
		});

		it("should transition New → Learning on first review with Again", () => {
			const card = createNewCard("test-card");
			const result = service.scheduleCard(card, Rating.Again);

			expect(result.state).toBe(State.Learning);
		});

		it("should increase stability on Good rating", () => {
			const card = createLearningCard("test-card", 1);
			const initialStability = card.stability;
			const result = service.scheduleCard(card, Rating.Good);

			expect(result.stability).toBeGreaterThan(initialStability);
		});

		it("should update lastReview timestamp", () => {
			const card = createNewCard("test-card");
			expect(card.lastReview).toBeNull();

			const result = service.scheduleCard(card, Rating.Good);
			expect(result.lastReview).not.toBeNull();
			expect(new Date(result.lastReview!).getTime()).toBe(Date.now());
		});

		it("should handle custom review time", () => {
			const card = createNewCard("test-card");
			const customTime = new Date("2024-01-20T15:00:00Z");

			const result = service.scheduleCard(card, Rating.Good, customTime);
			expect(new Date(result.lastReview!).getTime()).toBe(
				customTime.getTime()
			);
		});

		it("should handle Again rating on Review card (lapse)", () => {
			const card = createReviewCard("test-card");
			const initialLapses = card.lapses;

			const result = service.scheduleCard(card, Rating.Again);

			expect(result.state).toBe(State.Relearning);
			expect(result.lapses).toBe(initialLapses + 1);
		});

		it("should handle Easy rating on New card", () => {
			const card = createNewCard("test-card");
			const result = service.scheduleCard(card, Rating.Easy);

			// Easy on new card should fast-track to Learning or Review
			expect([State.Learning, State.Review]).toContain(result.state);
		});

		it("should handle Hard rating", () => {
			const card = createLearningCard("test-card");
			const result = service.scheduleCard(card, Rating.Hard);

			expect(result.reps).toBe(card.reps + 1);
		});

		it("should preserve card ID through scheduling", () => {
			const card = createNewCard("my-special-id");
			const result = service.scheduleCard(card, Rating.Good);

			expect(result.id).toBe("my-special-id");
		});
	});

	describe("getSchedulingPreview", () => {
		it("should return preview for all 4 ratings", () => {
			const card = createNewCard("test-card");
			const preview = service.getSchedulingPreview(card);

			expect(preview.again).toBeDefined();
			expect(preview.hard).toBeDefined();
			expect(preview.good).toBeDefined();
			expect(preview.easy).toBeDefined();
		});

		it("should have due dates in future", () => {
			const card = createNewCard("test-card");
			const preview = service.getSchedulingPreview(card);
			const now = Date.now();

			expect(preview.again.due.getTime()).toBeGreaterThanOrEqual(now);
			expect(preview.hard.due.getTime()).toBeGreaterThanOrEqual(now);
			expect(preview.good.due.getTime()).toBeGreaterThanOrEqual(now);
			expect(preview.easy.due.getTime()).toBeGreaterThanOrEqual(now);
		});

		it("should have formatted interval strings", () => {
			const card = createNewCard("test-card");
			const preview = service.getSchedulingPreview(card);

			expect(typeof preview.again.interval).toBe("string");
			expect(preview.again.interval.length).toBeGreaterThan(0);
		});
	});

	describe("isDue", () => {
		it("should return true for past due dates", () => {
			const pastDue = new Date(Date.now() - 86400000); // 1 day ago
			const card = createMockCard({
				due: pastDue.toISOString(),
			});

			expect(service.isDue(card)).toBe(true);
		});

		it("should return false for future due dates", () => {
			const futureDue = new Date(Date.now() + 86400000); // 1 day from now
			const card = createMockCard({
				due: futureDue.toISOString(),
			});

			expect(service.isDue(card)).toBe(false);
		});

		it("should return true for exact now", () => {
			const card = createMockCard({
				due: new Date().toISOString(),
			});

			expect(service.isDue(card)).toBe(true);
		});

		it("should use custom 'now' parameter", () => {
			const cardDue = new Date("2024-01-15T12:00:00Z");
			const card = createMockCard({
				due: cardDue.toISOString(),
			});

			// Before due time
			const beforeTime = new Date("2024-01-15T10:00:00Z");
			expect(service.isDue(card, beforeTime)).toBe(false);

			// After due time
			const afterTime = new Date("2024-01-15T14:00:00Z");
			expect(service.isDue(card, afterTime)).toBe(true);
		});
	});

	describe("getDueCards", () => {
		it("should filter cards that are due", () => {
			const cards = createMixedCardQueue();
			const dueCards = service.getDueCards(cards);

			// Should include cards with due date <= now
			expect(dueCards.length).toBeGreaterThan(0);
			dueCards.forEach((card) => {
				expect(new Date(card.fsrs.due).getTime()).toBeLessThanOrEqual(
					Date.now()
				);
			});
		});

		it("should return empty array when no cards are due", () => {
			const futureDue = new Date(Date.now() + 86400000 * 7);
			const cards = [
				createMockFlashcard({
					id: "future-1",
					fsrs: { due: futureDue.toISOString() },
				}),
				createMockFlashcard({
					id: "future-2",
					fsrs: { due: futureDue.toISOString() },
				}),
			];

			const dueCards = service.getDueCards(cards);
			expect(dueCards).toEqual([]);
		});

		it("should handle empty array", () => {
			const dueCards = service.getDueCards([]);
			expect(dueCards).toEqual([]);
		});
	});

	describe("getNewCards", () => {
		it("should filter cards with New state", () => {
			const cards = createMixedCardQueue();
			const newCards = service.getNewCards(cards);

			expect(newCards.length).toBe(2); // Based on createMixedCardQueue
			newCards.forEach((card) => {
				expect(card.fsrs.state).toBe(State.New);
			});
		});

		it("should respect limit parameter", () => {
			const cards = createMixedCardQueue();
			const newCards = service.getNewCards(cards, 1);

			expect(newCards.length).toBe(1);
		});

		it("should return all when limit exceeds count", () => {
			const cards = createMixedCardQueue();
			const newCards = service.getNewCards(cards, 100);

			expect(newCards.length).toBe(2);
		});

		it("should handle empty array", () => {
			const newCards = service.getNewCards([]);
			expect(newCards).toEqual([]);
		});

		it("should return empty when no new cards exist", () => {
			const cards = [
				createMockFlashcard({
					id: "review-1",
					fsrs: { state: State.Review },
				}),
				createMockFlashcard({
					id: "learning-1",
					fsrs: { state: State.Learning },
				}),
			];

			const newCards = service.getNewCards(cards);
			expect(newCards).toEqual([]);
		});
	});

	describe("getLearningCards", () => {
		it("should include Learning state cards", () => {
			const cards = createMixedCardQueue();
			const learningCards = service.getLearningCards(cards);

			const hasLearning = learningCards.some(
				(c) => c.fsrs.state === State.Learning
			);
			expect(hasLearning).toBe(true);
		});

		it("should include Relearning state cards", () => {
			const cards = [
				createMockFlashcard({
					id: "relearning-1",
					fsrs: { state: State.Relearning },
				}),
			];

			const learningCards = service.getLearningCards(cards);
			expect(learningCards.length).toBe(1);
			expect(learningCards[0].fsrs.state).toBe(State.Relearning);
		});

		it("should not include New or Review cards", () => {
			const cards = createMixedCardQueue();
			const learningCards = service.getLearningCards(cards);

			learningCards.forEach((card) => {
				expect(card.fsrs.state).not.toBe(State.New);
				expect(card.fsrs.state).not.toBe(State.Review);
			});
		});

		it("should handle empty array", () => {
			const learningCards = service.getLearningCards([]);
			expect(learningCards).toEqual([]);
		});
	});

	describe("getReviewCards", () => {
		it("should filter Review state cards that are due", () => {
			const pastDue = new Date("2024-01-14T10:00:00Z"); // 1 day ago
			const cards = [
				createMockFlashcard({
					id: "review-due",
					fsrs: {
						state: State.Review,
						due: pastDue.toISOString(),
					},
				}),
			];

			const reviewCards = service.getReviewCards(cards);
			expect(reviewCards.length).toBe(1);
		});

		it("should not include Review cards due in future", () => {
			const futureDue = new Date("2024-01-20T10:00:00Z");
			const cards = [
				createMockFlashcard({
					id: "review-future",
					fsrs: {
						state: State.Review,
						due: futureDue.toISOString(),
					},
				}),
			];

			const reviewCards = service.getReviewCards(cards);
			expect(reviewCards.length).toBe(0);
		});

		it("should not include Learning cards even if due", () => {
			const pastDue = new Date("2024-01-14T10:00:00Z");
			const cards = [
				createMockFlashcard({
					id: "learning-due",
					fsrs: {
						state: State.Learning,
						due: pastDue.toISOString(),
					},
				}),
			];

			const reviewCards = service.getReviewCards(cards);
			expect(reviewCards.length).toBe(0);
		});

		it("should use dayStartHour parameter", () => {
			// Test that dayStartHour is used in calculation
			// Card due in the past should always be included regardless of dayStartHour
			const pastDue = new Date("2024-01-10T10:00:00Z");
			const cards = [
				createMockFlashcard({
					id: "review-1",
					fsrs: {
						state: State.Review,
						due: pastDue.toISOString(),
					},
				}),
			];

			// Past due cards should be included regardless of dayStartHour
			const reviewCards = service.getReviewCards(cards, undefined, 4);
			expect(reviewCards.length).toBe(1);
		});

		it("should handle empty array", () => {
			const reviewCards = service.getReviewCards([]);
			expect(reviewCards).toEqual([]);
		});
	});

	describe("sortByDue", () => {
		it("should sort cards by due date (earliest first)", () => {
			const cards = [
				createMockFlashcard({
					id: "later",
					fsrs: { due: new Date("2024-01-20").toISOString() },
				}),
				createMockFlashcard({
					id: "earliest",
					fsrs: { due: new Date("2024-01-10").toISOString() },
				}),
				createMockFlashcard({
					id: "middle",
					fsrs: { due: new Date("2024-01-15").toISOString() },
				}),
			];

			const sorted = service.sortByDue(cards);

			expect(sorted[0].id).toBe("earliest");
			expect(sorted[1].id).toBe("middle");
			expect(sorted[2].id).toBe("later");
		});

		it("should not mutate original array", () => {
			const cards = [
				createMockFlashcard({
					id: "later",
					fsrs: { due: new Date("2024-01-20").toISOString() },
				}),
				createMockFlashcard({
					id: "earlier",
					fsrs: { due: new Date("2024-01-10").toISOString() },
				}),
			];

			const originalFirst = cards[0].id;
			service.sortByDue(cards);

			expect(cards[0].id).toBe(originalFirst);
		});

		it("should handle empty array", () => {
			const sorted = service.sortByDue([]);
			expect(sorted).toEqual([]);
		});

		it("should handle single card", () => {
			const cards = [createMockFlashcard({ id: "only-one" })];
			const sorted = service.sortByDue(cards);

			expect(sorted.length).toBe(1);
			expect(sorted[0].id).toBe("only-one");
		});
	});

	describe("getRetrievability", () => {
		it("should return 0 for New cards", () => {
			const card = createNewCard("test-card");
			const retrievability = service.getRetrievability(card);

			expect(retrievability).toBe(0);
		});

		it("should return value between 0 and 1 for Review cards", () => {
			const card = createReviewCard("test-card");
			const retrievability = service.getRetrievability(card);

			expect(retrievability).toBeGreaterThanOrEqual(0);
			expect(retrievability).toBeLessThanOrEqual(1);
		});

		it("should decrease over time for same card", () => {
			const card = createReviewCard("test-card", 0);

			const nowRetrievability = service.getRetrievability(card);

			// 7 days later
			const laterDate = new Date(Date.now() + 7 * 86400000);
			const laterRetrievability = service.getRetrievability(
				card,
				laterDate
			);

			expect(laterRetrievability).toBeLessThan(nowRetrievability);
		});

		it("should handle Learning cards", () => {
			const card = createLearningCard("test-card");
			const retrievability = service.getRetrievability(card);

			// Learning cards should have some retrievability
			expect(typeof retrievability).toBe("number");
		});
	});

	describe("getStats", () => {
		it("should count total cards correctly", () => {
			const cards = createMixedCardQueue();
			const stats = service.getStats(cards);

			expect(stats.total).toBe(cards.length);
		});

		it("should count new cards correctly", () => {
			const cards = createMixedCardQueue();
			const stats = service.getStats(cards);

			expect(stats.new).toBe(2); // Based on createMixedCardQueue
		});

		it("should count learning cards correctly", () => {
			const cards = createMixedCardQueue();
			const stats = service.getStats(cards);

			expect(stats.learning).toBe(1);
		});

		it("should count review cards correctly", () => {
			const cards = createMixedCardQueue();
			const stats = service.getStats(cards);

			expect(stats.review).toBe(2);
		});

		it("should count relearning cards correctly", () => {
			const cards = [
				createMockFlashcard({
					id: "relearning-1",
					fsrs: { state: State.Relearning },
				}),
			];
			const stats = service.getStats(cards);

			expect(stats.relearning).toBe(1);
		});

		it("should count due today correctly", () => {
			const cards = createMixedCardQueue();
			const stats = service.getStats(cards);

			// Due today includes new cards (due now) and past due review cards
			expect(stats.dueToday).toBeGreaterThan(0);
		});

		it("should handle empty array", () => {
			const stats = service.getStats([]);

			expect(stats.total).toBe(0);
			expect(stats.new).toBe(0);
			expect(stats.learning).toBe(0);
			expect(stats.review).toBe(0);
			expect(stats.relearning).toBe(0);
			expect(stats.dueToday).toBe(0);
		});
	});

	describe("updateSettings", () => {
		it("should update FSRS instance with new settings", () => {
			const newSettings = createDefaultFSRSSettings();
			newSettings.requestRetention = 0.8;

			service.updateSettings(newSettings);

			// Create a card and check scheduling reflects new settings
			const card = createNewCard("test-card");
			const preview = service.getSchedulingPreview(card);

			// Should not throw and should return valid preview
			expect(preview.good.interval).toBeDefined();
		});
	});
});
