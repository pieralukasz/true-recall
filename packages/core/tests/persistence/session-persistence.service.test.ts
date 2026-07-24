/**
 * Tests for SessionPersistenceService
 * Specifically tests recordReview() calling addReviewLog() correctly
 */

import type { App } from "obsidian";
import { Rating, State } from "ts-fsrs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionPersistenceService } from "../../src/persistence/session/session-persistence.service";
import type { SqliteStoreService } from "../../src/persistence/sqlite";
import type { DayBoundaryService } from "../../src/services/review/day-boundary.service";

describe("SessionPersistenceService", () => {
	let service: SessionPersistenceService;
	let mockStats: {
		recordReviewedCard: ReturnType<typeof vi.fn>;
		updateDailyStats: ReturnType<typeof vi.fn>;
		addReviewLog: ReturnType<typeof vi.fn>;
		getDailyStats: ReturnType<typeof vi.fn>;
		getReviewedCardIds: ReturnType<typeof vi.fn>;
		getPresetProgressInRange: ReturnType<typeof vi.fn>;
		getCardIdsRatedInRange: ReturnType<typeof vi.fn>;
	};
	let mockStore: {
		stats: typeof mockStats;
	};
	let mockApp: Partial<App>;
	let mockDayBoundaryService: {
		getTodayKey: ReturnType<typeof vi.fn>;
		getTodayBoundary: ReturnType<typeof vi.fn>;
		getTomorrowBoundary: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		mockStats = {
			recordReviewedCard: vi.fn(),
			updateDailyStats: vi.fn(),
			addReviewLog: vi.fn(),
			getDailyStats: vi.fn().mockReturnValue(null) as ReturnType<typeof vi.fn>,
			getReviewedCardIds: vi.fn().mockReturnValue([]) as ReturnType<
				typeof vi.fn
			>,
			getPresetProgressInRange: vi.fn().mockReturnValue([]) as ReturnType<
				typeof vi.fn
			>,
			getCardIdsRatedInRange: vi.fn().mockReturnValue([]) as ReturnType<
				typeof vi.fn
			>,
		};

		mockStore = {
			stats: mockStats,
		};

		mockApp = {};

		mockDayBoundaryService = {
			getTodayKey: vi.fn().mockReturnValue("2024-01-15") as ReturnType<
				typeof vi.fn
			>,
			getTodayBoundary: vi
				.fn()
				.mockReturnValue(new Date("2024-01-15T04:00:00.000Z")) as ReturnType<
				typeof vi.fn
			>,
			getTomorrowBoundary: vi
				.fn()
				.mockReturnValue(new Date("2024-01-16T04:00:00.000Z")) as ReturnType<
				typeof vi.fn
			>,
		};

		service = new SessionPersistenceService(
			mockApp as App,
			mockStore as unknown as SqliteStoreService,
			mockDayBoundaryService as unknown as DayBoundaryService,
		);
	});

	describe("recordReview - addReviewLog integration", () => {
		it("should call store.addReviewLog with correct parameters", () => {
			service.recordReview(
				"card-1",
				true, // isNewCard
				5000, // durationMs
				Rating.Good,
				State.New, // previousState
				14, // scheduledDays
				7, // elapsedDays
			);

			expect(mockStats.addReviewLog).toHaveBeenCalledWith(
				"card-1",
				Rating.Good,
				14,
				7,
				State.New,
				5000,
				undefined,
			);
		});

		it("should default scheduledDays and elapsedDays to 0 when undefined", () => {
			service.recordReview(
				"card-1",
				false, // isNewCard
				3000, // durationMs
				Rating.Good,
				State.Review, // previousState
				// scheduledDays and elapsedDays not provided
			);

			expect(mockStats.addReviewLog).toHaveBeenCalledWith(
				"card-1",
				Rating.Good,
				0, // defaults to 0
				0, // defaults to 0
				State.Review,
				3000,
				undefined,
			);
		});

		it("should not call addReviewLog when rating is undefined", () => {
			service.recordReview(
				"card-1",
				true, // isNewCard
				1000, // durationMs
				// No rating provided
			);

			expect(mockStats.addReviewLog).not.toHaveBeenCalled();
		});

		it("should still update daily stats when addReviewLog is called", () => {
			service.recordReview("card-1", true, 5000, Rating.Good, State.New, 14, 7);

			// Both should be called
			expect(mockStats.updateDailyStats).toHaveBeenCalled();
			expect(mockStats.addReviewLog).toHaveBeenCalled();
		});

		it("should call addReviewLog with correct rating values", () => {
			const testCases = [
				{ rating: Rating.Again, expected: Rating.Again },
				{ rating: Rating.Hard, expected: Rating.Hard },
				{ rating: Rating.Good, expected: Rating.Good },
				{ rating: Rating.Easy, expected: Rating.Easy },
			];

			testCases.forEach(({ rating, expected }) => {
				mockStats.addReviewLog.mockClear();

				service.recordReview(
					"card-1",
					false,
					1000,
					rating,
					State.Review,
					10,
					5,
				);

				expect(mockStats.addReviewLog).toHaveBeenCalledWith(
					"card-1",
					expected,
					10,
					5,
					State.Review,
					1000,
					undefined,
				);
			});
		});

		it("should handle previousState being undefined", () => {
			service.recordReview(
				"card-1",
				true,
				2000,
				Rating.Good,
				// previousState undefined
			);

			expect(mockStats.addReviewLog).toHaveBeenCalledWith(
				"card-1",
				Rating.Good,
				0,
				0,
				0, // defaults to 0 when undefined
				2000,
				undefined,
			);
		});
	});

	describe("getTodayProgressByPreset", () => {
		it("queries stats with day-boundary range and maps rows by preset name", () => {
			mockStats.getPresetProgressInRange.mockReturnValue([
				{ presetName: "Default", newStudied: 2, reviewsCompleted: 3 },
				{ presetName: "Medical", newStudied: 1, reviewsCompleted: 5 },
			]);

			const result = service.getTodayProgressByPreset();

			expect(mockStats.getPresetProgressInRange).toHaveBeenCalledWith(
				"2024-01-15T04:00:00.000Z",
				"2024-01-16T04:00:00.000Z",
			);
			expect(result.get("Default")).toEqual({
				newStudied: 2,
				reviewsCompleted: 3,
			});
			expect(result.get("Medical")).toEqual({
				newStudied: 1,
				reviewsCompleted: 5,
			});
		});

		it("returns an empty map when no rows are returned", () => {
			mockStats.getPresetProgressInRange.mockReturnValue([]);

			const result = service.getTodayProgressByPreset();

			expect(result.size).toBe(0);
		});
	});

	describe("custom-study review history", () => {
		it("records preview answers without changing daily progress", () => {
			service.recordPreviewReview(
				"card-1",
				2500,
				Rating.Again,
				State.Review,
				"Default",
			);

			expect(mockStats.addReviewLog).toHaveBeenCalledWith(
				"card-1",
				Rating.Again,
				0,
				0,
				State.Review,
				2500,
				"Default",
			);
			expect(mockStats.recordReviewedCard).not.toHaveBeenCalled();
			expect(mockStats.updateDailyStats).not.toHaveBeenCalled();
		});

		it("queries Again answers using rollover-aware day boundaries", () => {
			mockStats.getCardIdsRatedInRange.mockReturnValue(["card-1", "card-2"]);

			const result = service.getCardsRatedAgainWithinDays(3);

			expect(mockStats.getCardIdsRatedInRange).toHaveBeenCalledWith(
				Rating.Again,
				"2024-01-13T04:00:00.000Z",
				"2024-01-16T04:00:00.000Z",
			);
			expect(result).toEqual(new Set(["card-1", "card-2"]));
		});
	});
});
