/**
 * Easy Days Service Tests
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	EasyDaysService,
	isEasyDay,
} from "../../../../src/metrics/fsrs-tools/scheduler/easy-days.service";
import {
	createCardsOnDate,
	createEasyDaysConfig,
	createMockCardStore,
} from "../mocks/scheduler.mocks";

describe("Easy Days Service", () => {
	describe("isEasyDay helper function", () => {
		it("returns true for recurring weekday match (Sunday = 0)", () => {
			const date = new Date("2026-02-01"); // Sunday
			const config = createEasyDaysConfig([0], []);
			expect(isEasyDay(date, config)).toBe(true);
		});

		it("returns true for recurring weekday match (Saturday = 6)", () => {
			const date = new Date("2026-02-07"); // Saturday
			const config = createEasyDaysConfig([6], []);
			expect(isEasyDay(date, config)).toBe(true);
		});

		it("returns true for specific date match", () => {
			const date = new Date("2026-02-15");
			const config = createEasyDaysConfig([], ["2026-02-15"]);
			expect(isEasyDay(date, config)).toBe(true);
		});

		it("returns false for non-easy day", () => {
			const date = new Date("2026-02-02"); // Monday
			const config = createEasyDaysConfig([0, 6], []); // Only Sun, Sat
			expect(isEasyDay(date, config)).toBe(false);
		});

		it("handles empty config", () => {
			const date = new Date("2026-02-01");
			const config = createEasyDaysConfig([], []);
			expect(isEasyDay(date, config)).toBe(false);
		});

		it("matches both recurring and specific", () => {
			const date = new Date("2026-02-01"); // Sunday
			const config = createEasyDaysConfig([0], ["2026-02-01"]);
			expect(isEasyDay(date, config)).toBe(true);
		});
	});

	describe("EasyDaysService", () => {
		let service: EasyDaysService;
		let mockStore: ReturnType<typeof createMockCardStore>;

		beforeEach(() => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-02-01T10:00:00Z")); // Sunday
			mockStore = createMockCardStore();
			service = new EasyDaysService(mockStore);
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		describe("applyEasyDays", () => {
			it("returns empty result when no easy days configured", async () => {
				const result = await service.applyEasyDays({
					easyDays: createEasyDaysConfig([], []),
					multiplier: 0.5,
					targetPerDay: 100,
					dryRun: true,
				});

				expect(result.affectedCount).toBe(0);
				expect(result.changes).toHaveLength(0);
			});

			it("moves excess cards from easy day to next non-easy day", async () => {
				// Setup: 10 cards on Sunday (easy day), multiplier 50%, target 10
				// Max cards = 10 * 0.5 = 5, so 5 should move to Monday
				const sundayCards = createCardsOnDate("2026-02-01", 10);
				mockStore = createMockCardStore(sundayCards);
				mockStore.getDueCardsByDateRange.mockReturnValue(sundayCards);
				service = new EasyDaysService(mockStore);

				const result = await service.applyEasyDays({
					easyDays: createEasyDaysConfig([0], []), // Sunday
					multiplier: 0.5,
					targetPerDay: 10,
					dryRun: true,
				});

				expect(result.affectedCount).toBe(5);
				expect(result.changes).toHaveLength(5);
				// All moved cards should go to Monday (2026-02-02)
				result.changes.forEach((change) => {
					expect(change.newDue).toContain("2026-02-02");
					expect(change.daysChanged).toBe(1);
				});
			});

			it("respects multiplier (0% = move all cards)", async () => {
				const sundayCards = createCardsOnDate("2026-02-01", 5);
				mockStore = createMockCardStore(sundayCards);
				mockStore.getDueCardsByDateRange.mockReturnValue(sundayCards);
				service = new EasyDaysService(mockStore);

				const result = await service.applyEasyDays({
					easyDays: createEasyDaysConfig([0], []),
					multiplier: 0, // 0% = no cards allowed
					targetPerDay: 100,
					dryRun: true,
				});

				expect(result.affectedCount).toBe(5);
			});

			it("respects multiplier (100% = move no cards)", async () => {
				const sundayCards = createCardsOnDate("2026-02-01", 5);
				mockStore = createMockCardStore(sundayCards);
				mockStore.getDueCardsByDateRange.mockReturnValue(sundayCards);
				service = new EasyDaysService(mockStore);

				const result = await service.applyEasyDays({
					easyDays: createEasyDaysConfig([0], []),
					multiplier: 1.0, // 100% = all cards allowed
					targetPerDay: 100, // max = 100, we have 5
					dryRun: true,
				});

				expect(result.affectedCount).toBe(0);
			});

			it("handles consecutive easy days (finds next available)", async () => {
				// Sunday and Monday are easy days
				// Cards on Sunday should move to Tuesday
				const sundayCards = createCardsOnDate("2026-02-01", 5);
				mockStore = createMockCardStore(sundayCards);
				mockStore.getDueCardsByDateRange.mockReturnValue(sundayCards);
				service = new EasyDaysService(mockStore);

				const result = await service.applyEasyDays({
					easyDays: createEasyDaysConfig([0, 1], []), // Sun, Mon
					multiplier: 0, // Move all
					targetPerDay: 100,
					dryRun: true,
				});

				expect(result.affectedCount).toBe(5);
				// Should move to Tuesday (2026-02-03)
				result.changes.forEach((change) => {
					expect(change.newDue).toContain("2026-02-03");
					expect(change.daysChanged).toBe(2);
				});
			});

			it("applies changes when dryRun is false", async () => {
				const sundayCards = createCardsOnDate("2026-02-01", 3);
				mockStore = createMockCardStore(sundayCards);
				mockStore.getDueCardsByDateRange.mockReturnValue(sundayCards);
				service = new EasyDaysService(mockStore);

				await service.applyEasyDays({
					easyDays: createEasyDaysConfig([0], []),
					multiplier: 0,
					targetPerDay: 100,
					dryRun: false,
				});

				// Should have called updateCardDue 3 times
				expect(mockStore.updateCardDue).toHaveBeenCalledTimes(3);
			});

			it("does not apply changes when dryRun is true", async () => {
				const sundayCards = createCardsOnDate("2026-02-01", 3);
				mockStore = createMockCardStore(sundayCards);
				mockStore.getDueCardsByDateRange.mockReturnValue(sundayCards);
				service = new EasyDaysService(mockStore);

				await service.applyEasyDays({
					easyDays: createEasyDaysConfig([0], []),
					multiplier: 0,
					targetPerDay: 100,
					dryRun: true,
				});

				expect(mockStore.updateCardDue).not.toHaveBeenCalled();
			});

			it("handles specific dates correctly", async () => {
				const holidayCards = createCardsOnDate("2026-02-15", 8);
				mockStore = createMockCardStore(holidayCards);
				mockStore.getDueCardsByDateRange.mockReturnValue(holidayCards);
				service = new EasyDaysService(mockStore);

				const result = await service.applyEasyDays({
					easyDays: createEasyDaysConfig([], ["2026-02-15"]),
					multiplier: 0.5,
					targetPerDay: 10, // max = 5
					dryRun: true,
				});

				expect(result.affectedCount).toBe(3); // 8 - 5 = 3
				result.changes.forEach((change) => {
					expect(change.newDue).toContain("2026-02-16");
				});
			});

			it("preserves time-of-day in moved cards", async () => {
				const cards = [
					{
						id: "card-1",
						due: "2026-02-01T14:30:00.000Z",
						scheduledDays: 7,
					},
				];
				mockStore = createMockCardStore(cards);
				mockStore.getDueCardsByDateRange.mockReturnValue(cards);
				service = new EasyDaysService(mockStore);

				const result = await service.applyEasyDays({
					easyDays: createEasyDaysConfig([0], []),
					multiplier: 0,
					targetPerDay: 100,
					dryRun: true,
				});

				// Time should be preserved (14:30)
				expect(result.changes[0]?.newDue).toContain("T14:30:00");
			});
		});

		describe("previewImpact", () => {
			it("calculates total cards to be moved", () => {
				// 10 cards each on 4 Sundays in February
				const cards = [
					...createCardsOnDate("2026-02-01", 10),
					...createCardsOnDate("2026-02-08", 10),
					...createCardsOnDate("2026-02-15", 10),
					...createCardsOnDate("2026-02-22", 10),
				];
				mockStore = createMockCardStore(cards);
				mockStore.getDueCardsByDateRange.mockReturnValue(cards);
				service = new EasyDaysService(mockStore);

				const result = service.previewImpact(
					createEasyDaysConfig([0], []), // Sundays
					0.5, // 50%
					10, // target 10, max 5
				);

				// Each Sunday has 10 cards, max 5, so 5 excess each
				// 4 Sundays * 5 excess = 20 total
				expect(result.totalMoved).toBe(20);
				expect(result.byDay).toHaveLength(1);
				expect(result.byDay[0]?.day).toBe("Sun");
				expect(result.byDay[0]?.moved).toBe(20);
			});

			it("groups by recurring day correctly", () => {
				const cards = [
					...createCardsOnDate("2026-02-01", 10), // Sun
					...createCardsOnDate("2026-02-07", 10), // Sat
				];
				mockStore = createMockCardStore(cards);
				mockStore.getDueCardsByDateRange.mockReturnValue(cards);
				service = new EasyDaysService(mockStore);

				const result = service.previewImpact(
					createEasyDaysConfig([0, 6], []), // Sun, Sat
					0,
					10,
				);

				expect(result.byDay).toHaveLength(2);
				expect(result.byDay.find((d) => d.day === "Sun")?.moved).toBe(10);
				expect(result.byDay.find((d) => d.day === "Sat")?.moved).toBe(10);
			});

			it("includes specific dates in preview", () => {
				const cards = createCardsOnDate("2026-02-15", 8);
				mockStore = createMockCardStore(cards);
				mockStore.getDueCardsByDateRange.mockReturnValue(cards);
				service = new EasyDaysService(mockStore);

				const result = service.previewImpact(
					createEasyDaysConfig([], ["2026-02-15"]),
					0.5,
					10, // max 5
				);

				expect(result.totalMoved).toBe(3); // 8 - 5
				expect(result.byDay).toHaveLength(1);
				expect(result.byDay[0]?.day).toBe("2026-02-15");
			});
		});
	});
});
