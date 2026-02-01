/**
 * Load Balance Service Tests
 *
 * NOTE: Learning and Relearning cards are excluded from load balancing at the
 * database query level (getDueCardsByDateRange excludes state IN (1, 3)).
 * This ensures learning cards with short intervals (minutes) are not moved to
 * days in the future, which would break FSRS's learning algorithm.
 *
 * The tests below use mock data that represents the filtered result (only
 * Review and New cards), as that's what the service receives in production.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { LoadBalanceService } from "../../../../src/services/fsrs-helper/scheduler/load-balance.service";
import {
	createMockCardStore,
	createCardsOnDate,
	createEasyDaysConfig,
} from "../mocks/scheduler.mocks";

describe("LoadBalanceService", () => {
	let service: LoadBalanceService;
	let mockStore: ReturnType<typeof createMockCardStore>;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
		mockStore = createMockCardStore();
		service = new LoadBalanceService(mockStore as any);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("balance", () => {
		it("returns empty when no days are overloaded", async () => {
			// All days have 5 cards, target is 10, deviation 20% (threshold = 12)
			const cards = [
				...createCardsOnDate("2026-02-01", 5),
				...createCardsOnDate("2026-02-02", 5),
				...createCardsOnDate("2026-02-03", 5),
			];
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as any);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				dryRun: true,
			});

			expect(result.affectedCount).toBe(0);
			expect(result.changes).toHaveLength(0);
		});

		it("moves cards from overloaded days", async () => {
			// Day 1 has 15 cards, target 10, deviation 20% (threshold = 12)
			// Should move 3 cards (15 - 12 = 3)
			const cards = [
				...createCardsOnDate("2026-02-01", 15),
				...createCardsOnDate("2026-02-02", 5),
			];
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as any);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				dryRun: true,
			});

			expect(result.affectedCount).toBe(3);
			expect(result.changes).toHaveLength(3);
		});

		it("respects maxDeviation threshold", async () => {
			// Target 10, deviation 50% = threshold 15
			// 14 cards should NOT trigger redistribution
			const cards = createCardsOnDate("2026-02-01", 14);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as any);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 50, // threshold = 15
				dryRun: true,
			});

			expect(result.affectedCount).toBe(0);
		});

		it("prefers closer dates with lower fill ratio", async () => {
			// Overloaded day, two candidate days
			const cards = [
				...createCardsOnDate("2026-02-01", 20), // Overloaded
				...createCardsOnDate("2026-02-02", 8), // Some room
				...createCardsOnDate("2026-02-03", 2), // More room
			];
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as any);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20, // threshold = 12
				dryRun: true,
			});

			// Algorithm balances distance vs fill ratio
			// Cards should move to days with room under threshold
			expect(result.affectedCount).toBeGreaterThan(0);
			result.changes.forEach((change) => {
				// Should not stay on same day
				expect(change.newDue).not.toContain("2026-02-01");
			});
		});

		it("respects easy days configuration", async () => {
			// Sunday is easy day with 50% multiplier
			// Target 10, easy day target = 5
			const cards = [
				...createCardsOnDate("2026-02-01", 10), // Sunday - easy day, max 5+deviation
			];
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as any);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20, // Normal threshold = 12, easy threshold = 7
				easyDays: createEasyDaysConfig([0], []), // Sunday
				easyDaysMultiplier: 0.5,
				dryRun: true,
			});

			// 10 cards on easy day with threshold 7 = 3 excess
			expect(result.affectedCount).toBe(3);
		});

		it("applies changes when dryRun is false", async () => {
			const cards = createCardsOnDate("2026-02-01", 20);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as any);

			await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				dryRun: false,
			});

			expect(mockStore.updateCardDue).toHaveBeenCalled();
		});

		it("does not apply changes when dryRun is true", async () => {
			const cards = createCardsOnDate("2026-02-01", 20);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as any);

			await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				dryRun: true,
			});

			expect(mockStore.updateCardDue).not.toHaveBeenCalled();
		});

		it("preserves time-of-day in moved cards", async () => {
			const cards = [
				{
					id: "card-1",
					due: "2026-02-01T14:30:45.000Z",
					scheduledDays: 7,
				},
				...createCardsOnDate("2026-02-01", 19), // 20 total
			];
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as any);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				dryRun: true,
			});

			// Find the change for our specific card if it was moved
			const ourCardChange = result.changes.find((c) => c.cardId === "card-1");
			if (ourCardChange) {
				expect(ourCardChange.newDue).toContain("T14:30:45.000Z");
			}
		});

		it("returns correct before and after distributions", async () => {
			const cards = [
				...createCardsOnDate("2026-02-01", 20),
				...createCardsOnDate("2026-02-02", 5),
			];
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as any);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				dryRun: true,
			});

			// Before should show original distribution
			const beforeDay1 = result.beforeDistribution.find(
				(d) => d.date === "2026-02-01"
			);
			expect(beforeDay1?.count).toBe(20);

			// After should show balanced distribution
			const afterDay1 = result.afterDistribution.find(
				(d) => d.date === "2026-02-01"
			);
			expect(afterDay1?.count).toBeLessThan(20);
		});
	});

	describe("getDistribution", () => {
		it("returns correct card counts per day", () => {
			const cards = [
				...createCardsOnDate("2026-02-01", 10),
				...createCardsOnDate("2026-02-02", 5),
				...createCardsOnDate("2026-02-03", 15),
			];
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as any);

			const distribution = service.getDistribution(7);

			const day1 = distribution.find((d) => d.date === "2026-02-01");
			const day2 = distribution.find((d) => d.date === "2026-02-02");
			const day3 = distribution.find((d) => d.date === "2026-02-03");

			expect(day1?.count).toBe(10);
			expect(day2?.count).toBe(5);
			expect(day3?.count).toBe(15);
		});

		it("includes all days in range even without cards", () => {
			const cards = createCardsOnDate("2026-02-01", 5);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore as any);

			const distribution = service.getDistribution(3);

			// Should have 4 days (today + 3)
			expect(distribution.length).toBe(4);

			// Day without cards should have count 0
			const day2 = distribution.find((d) => d.date === "2026-02-02");
			expect(day2?.count).toBe(0);
		});

		it("handles empty date range", () => {
			mockStore = createMockCardStore([]);
			mockStore.getDueCardsByDateRange.mockReturnValue([]);
			service = new LoadBalanceService(mockStore as any);

			const distribution = service.getDistribution(7);

			expect(distribution.length).toBe(8); // 7 days + today
			distribution.forEach((d) => {
				expect(d.count).toBe(0);
			});
		});
	});
});
