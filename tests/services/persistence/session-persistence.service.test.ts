/**
 * Tests for SessionPersistenceService
 * Specifically tests recordReview() calling addReviewLog() correctly
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { State, Rating } from "ts-fsrs";
import { SessionPersistenceService } from "../../../src/services/persistence/session-persistence.service";
import type { SqliteStoreService } from "../../../src/services/persistence/sqlite";
import type { DayBoundaryService } from "../../../src/services/core/day-boundary.service";
import type { App } from "obsidian";

describe("SessionPersistenceService", () => {
	let service: SessionPersistenceService;
	let mockStats: {
		recordReviewedCard: ReturnType<typeof vi.fn>;
		updateDailyStats: ReturnType<typeof vi.fn>;
		addReviewLog: ReturnType<typeof vi.fn>;
		getDailyStats: ReturnType<typeof vi.fn>;
		getReviewedCardIds: ReturnType<typeof vi.fn>;
	};
	let mockStore: {
		stats: typeof mockStats;
	};
	let mockApp: Partial<App>;
	let mockDayBoundaryService: {
		getTodayKey: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		mockStats = {
			recordReviewedCard: vi.fn(),
			updateDailyStats: vi.fn(),
			addReviewLog: vi.fn(),
			getDailyStats: vi.fn().mockReturnValue(null),
			getReviewedCardIds: vi.fn().mockReturnValue([]),
		};

		mockStore = {
			stats: mockStats,
		};

		mockApp = {};

		mockDayBoundaryService = {
			getTodayKey: vi.fn().mockReturnValue("2024-01-15"),
		};

		service = new SessionPersistenceService(
			mockApp as App,
			mockStore as unknown as SqliteStoreService,
			mockDayBoundaryService as unknown as DayBoundaryService
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
				7 // elapsedDays
			);

			expect(mockStats.addReviewLog).toHaveBeenCalledWith(
				"card-1",
				Rating.Good,
				14,
				7,
				State.New,
				5000
			);
		});

		it("should default scheduledDays and elapsedDays to 0 when undefined", () => {
			service.recordReview(
				"card-1",
				false, // isNewCard
				3000, // durationMs
				Rating.Good,
				State.Review // previousState
				// scheduledDays and elapsedDays not provided
			);

			expect(mockStats.addReviewLog).toHaveBeenCalledWith(
				"card-1",
				Rating.Good,
				0, // defaults to 0
				0, // defaults to 0
				State.Review,
				3000
			);
		});

		it("should not call addReviewLog when rating is undefined", () => {
			service.recordReview(
				"card-1",
				true, // isNewCard
				1000 // durationMs
				// No rating provided
			);

			expect(mockStats.addReviewLog).not.toHaveBeenCalled();
		});

		it("should still update daily stats when addReviewLog is called", () => {
			service.recordReview(
				"card-1",
				true,
				5000,
				Rating.Good,
				State.New,
				14,
				7
			);

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
					5
				);

				expect(mockStats.addReviewLog).toHaveBeenCalledWith(
					"card-1",
					expected,
					10,
					5,
					State.Review,
					1000
				);
			});
		});

		it("should handle previousState being undefined", () => {
			service.recordReview(
				"card-1",
				true,
				2000,
				Rating.Good
				// previousState undefined
			);

			expect(mockStats.addReviewLog).toHaveBeenCalledWith(
				"card-1",
				Rating.Good,
				0,
				0,
				0, // defaults to 0 when undefined
				2000
			);
		});
	});
});
