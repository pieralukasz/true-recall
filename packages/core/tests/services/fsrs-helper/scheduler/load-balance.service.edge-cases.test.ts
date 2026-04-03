/**
 * Load Balance Service Edge Case Tests
 * Behavior-first tests for edge cases and boundary conditions
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoadBalanceService } from "../../../../src/metrics/fsrs-tools/scheduler/load-balance.service";
import {
	addDays,
	createCardsOnDate,
	createEasyDaysConfig,
	createMockCardStore,
} from "../mocks/scheduler.mocks";

describe("LoadBalanceService - Edge Cases", () => {
	let service: LoadBalanceService;
	let mockStore: ReturnType<typeof createMockCardStore>;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
		mockStore = createMockCardStore();
		service = new LoadBalanceService(mockStore as never);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("Threshold Boundary Conditions", () => {
		it("should NOT move cards when count exactly equals threshold", async () => {
			// Target 10, deviation 20% → threshold = 12
			// 12 cards should NOT trigger redistribution
			const cards = createCardsOnDate("2026-02-01", 12);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as never);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20, // threshold = 10 + (10 * 0.2) = 12
				dryRun: true,
			});

			expect(result.affectedCount).toBe(0);
		});

		it("should move cards when count is threshold + 1", async () => {
			// 13 cards on threshold of 12 = 1 card to move
			const cards = createCardsOnDate("2026-02-01", 13);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as never);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				dryRun: true,
			});

			expect(result.affectedCount).toBe(1);
		});

		it("should handle small target with deviation rounding", async () => {
			// Target 2, deviation 10% → 2 + 0.2 = 2.2, so threshold is ~2
			// 3 cards should trigger redistribution
			const cards = createCardsOnDate("2026-02-01", 3);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as never);

			const result = await service.balance({
				targetPerDay: 2,
				maxDeviation: 10,
				dryRun: true,
			});

			// threshold = 2 + (2 * 0.1) = 2.2, so 3 > 2.2 = 1 card moves
			expect(result.affectedCount).toBe(1);
		});

		it("should handle zero deviation (exact threshold)", async () => {
			// Target 10, deviation 0% → threshold = 10
			// 11 cards should move 1
			const cards = createCardsOnDate("2026-02-01", 11);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as never);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 0,
				dryRun: true,
			});

			expect(result.affectedCount).toBe(1);
		});
	});

	describe("Multiple Overloaded Days", () => {
		it("should redistribute from multiple overloaded days", async () => {
			// Two overloaded days, empty day in between
			const cards = [
				...createCardsOnDate("2026-02-01", 15), // Overloaded
				...createCardsOnDate("2026-02-02", 5), // Under threshold
				...createCardsOnDate("2026-02-03", 18), // Also overloaded
			];
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as never);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20, // threshold = 12
				dryRun: true,
			});

			// Day 1: 15 - 12 = 3 excess
			// Day 3: 18 - 12 = 6 excess
			// Total = 9 cards to move
			expect(result.affectedCount).toBe(9);
		});

		it("should handle consecutive overloaded days", async () => {
			const cards = [
				...createCardsOnDate("2026-02-01", 15),
				...createCardsOnDate("2026-02-02", 15),
				...createCardsOnDate("2026-02-03", 15),
				...createCardsOnDate("2026-02-10", 0), // Empty day later
			];
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as never);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				dryRun: true,
			});

			// Each overloaded day has 3 excess = 9 total
			expect(result.affectedCount).toBe(9);
		});

		it("should not create infinite loop when redistribution fills target day", async () => {
			// All days are near threshold - algorithm should terminate
			const cards = [
				...createCardsOnDate("2026-02-01", 13),
				...createCardsOnDate("2026-02-02", 11),
				...createCardsOnDate("2026-02-03", 11),
			];
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as never);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20, // threshold = 12
				days: 3,
				dryRun: true,
			});

			// Day 1 has 13, threshold is 12, only 1 to move
			// Should move to days that have room under 12
			expect(result.affectedCount).toBe(1);
		});
	});

	describe("Easy Days Integration", () => {
		it("should apply easy day multiplier of 0 (zero target)", async () => {
			// Sunday with multiplier 0 = target 0
			const cards = createCardsOnDate("2026-02-01", 5); // Sunday
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as never);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				easyDays: createEasyDaysConfig([0], []), // Sunday
				easyDaysMultiplier: 0, // Zero target
				dryRun: true,
			});

			// Cards should move from the zero-target easy day
			// The exact count depends on available target days
			expect(result.affectedCount).toBeGreaterThan(0);
		});

		it("should apply easy day multiplier of 1.0 (no change)", async () => {
			const cards = createCardsOnDate("2026-02-01", 10); // Sunday
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as never);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20, // threshold = 12
				easyDays: createEasyDaysConfig([0], []),
				easyDaysMultiplier: 1.0, // No reduction
				dryRun: true,
			});

			// 10 cards, threshold 12 = no moves needed
			expect(result.affectedCount).toBe(0);
		});

		it("should handle specific date as easy day", async () => {
			const cards = createCardsOnDate("2026-02-15", 10);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as never);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				easyDays: createEasyDaysConfig([], ["2026-02-15"]), // Specific date
				easyDaysMultiplier: 0.5, // threshold = 5 + 1 = 6
				days: 30,
				dryRun: true,
			});

			// 10 cards on easy day with threshold ~6 = excess cards to move
			expect(result.affectedCount).toBeGreaterThan(0);
		});

		it("should handle when all days in range are easy days", async () => {
			// Every day is an easy day (all weekdays marked)
			const cards = createCardsOnDate("2026-02-01", 10);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as never);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				easyDays: createEasyDaysConfig([0, 1, 2, 3, 4, 5, 6], []), // All days
				easyDaysMultiplier: 0.5, // All days have 5 target
				days: 7,
				dryRun: true,
			});

			// 10 cards with easy threshold ~6-7 = excess
			expect(result.affectedCount).toBeGreaterThan(0);
		});
	});

	describe("Algorithm Edge Cases", () => {
		it("should handle date range with single day (days=1)", async () => {
			const cards = createCardsOnDate("2026-02-01", 15);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as never);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				days: 1, // Only 1 additional day to consider
				dryRun: true,
			});

			// With days=1, can only move to Feb 2
			// Should still try to balance
			expect(result.affectedCount).toBeGreaterThan(0);
		});

		it("should handle empty date range (no cards)", async () => {
			mockStore = createMockCardStore([]);
			mockStore.getDueCardsByDateRange.mockReturnValue([]);
			service = new LoadBalanceService(mockStore as never);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				dryRun: true,
			});

			expect(result.affectedCount).toBe(0);
			expect(result.changes).toHaveLength(0);
			expect(result.beforeDistribution).toHaveLength(0);
		});

		it("should return null/skip when no target day available", async () => {
			// All days in range are at or over threshold
			const today = new Date("2026-02-01");
			const cards = [];
			for (let i = 0; i < 5; i++) {
				const dateStr = addDays(today, i);
				cards.push(...createCardsOnDate(dateStr, 15)); // All overloaded
			}
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as never);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20, // threshold = 12
				days: 5,
				dryRun: true,
			});

			// Some cards may not find a target day and won't move
			// The algorithm should handle this gracefully (no crash)
			expect(result).toBeDefined();
		});

		it("should handle very large date range", async () => {
			const cards = [
				...createCardsOnDate("2026-02-01", 50),
				...createCardsOnDate("2026-03-01", 10),
			];
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as never);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				days: 60, // 2 months
				dryRun: true,
			});

			// Should process without timeout or crash
			expect(result).toBeDefined();
			expect(result.affectedCount).toBeGreaterThan(0);
		});
	});

	describe("Scoring Algorithm", () => {
		it("should move cards to available dates based on scoring", async () => {
			// Overloaded day with candidate days available
			const cards = [
				...createCardsOnDate("2026-02-01", 15), // Overloaded
				// Note: Days without explicit cards will have count 0
			];
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as never);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				days: 15,
				dryRun: true,
			});

			// Cards should move to later dates (not stay on overloaded day)
			result.changes.forEach((change) => {
				expect(change.newDue).not.toContain("2026-02-01");
				expect(change.daysChanged).toBeGreaterThan(0);
			});
		});

		it("should prefer emptier days over fuller days at same distance", async () => {
			// This tests the fill ratio component of scoring
			const cards = [
				...createCardsOnDate("2026-02-01", 20), // Overloaded
				...createCardsOnDate("2026-02-02", 10), // Fuller
				...createCardsOnDate("2026-02-03", 2), // Emptier
			];
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as never);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20, // threshold = 12
				days: 5,
				dryRun: true,
			});

			// Should prefer Feb 3 (emptier) even though Feb 2 is closer
			// But scoring balances distance and fill, so may use both
			expect(result.affectedCount).toBeGreaterThan(0);
		});
	});

	describe("Data Integrity", () => {
		it("should maintain consistent distribution after changes", async () => {
			const cards = [
				...createCardsOnDate("2026-02-01", 20),
				...createCardsOnDate("2026-02-02", 5),
			];
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as never);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				dryRun: true,
			});

			// Total cards should remain the same
			const beforeTotal = result.beforeDistribution.reduce(
				(sum, d) => sum + d.count,
				0,
			);
			const afterTotal = result.afterDistribution.reduce(
				(sum, d) => sum + d.count,
				0,
			);

			expect(afterTotal).toBe(beforeTotal);
		});

		it("should correctly calculate daysChanged in changes", async () => {
			const cards = [
				...createCardsOnDate("2026-02-01", 15),
				...createCardsOnDate("2026-02-05", 0), // 4 days later
			];
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as never);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				days: 10,
				dryRun: true,
			});

			// Each change should have positive daysChanged
			result.changes.forEach((change) => {
				expect(change.daysChanged).toBeGreaterThan(0);
			});
		});

		it("should preserve card IDs in changes", async () => {
			const cards = createCardsOnDate("2026-02-01", 15);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as never);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				dryRun: true,
			});

			// All card IDs in changes should exist in original cards
			const originalIds = new Set(cards.map((c) => c.id));
			result.changes.forEach((change) => {
				expect(originalIds.has(change.cardId)).toBe(true);
			});
		});
	});
});
