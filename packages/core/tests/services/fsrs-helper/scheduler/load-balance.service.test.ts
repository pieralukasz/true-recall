/**
 * Load Balance Service Tests
 *
 * NOTE: Learning and Relearning cards are excluded from load balancing at the
 * database query level (getDueCardsByDateRange excludes state IN (1, 3)).
 * This ensures learning cards with short intervals (minutes) are not moved to
 * days in the future, which would break FSRS's learning algorithm.
 * New-state cards pass the query but are filtered inside the service — they
 * are introduced by the daily new-card limit, not by due-date scheduling.
 *
 * The tests below use mock data that represents the filtered result (only
 * Review and New cards), as that's what the service receives in production.
 */
import { State } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoadBalanceService } from "../../../../src/metrics/fsrs-tools/scheduler/load-balance.service";
import {
	createCardsOnDate,
	createEasyDaysConfig,
	createMockCardStore,
} from "../mocks/scheduler.mocks";

describe("LoadBalanceService", () => {
	let service: LoadBalanceService;
	let mockStore: ReturnType<typeof createMockCardStore>;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
		mockStore = createMockCardStore();
		service = new LoadBalanceService(mockStore);
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
			service = new LoadBalanceService(mockStore);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				dryRun: true,
			});

			expect(result.affectedCount).toBe(0);
			expect(result.changes).toHaveLength(0);
		});

		it("moves cards from overloaded days down to the target", async () => {
			// Day 1 has 15 cards, target 10, deviation 20% (threshold = 12).
			// 15 > 12 triggers balancing, which trims to the target: 5 moves.
			const cards = [
				...createCardsOnDate("2026-02-01", 15),
				...createCardsOnDate("2026-02-02", 5),
			];
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				dryRun: true,
			});

			expect(result.affectedCount).toBe(5);
			expect(result.changes).toHaveLength(5);
		});

		it("respects maxDeviation threshold", async () => {
			// Target 10, deviation 50% = threshold 15
			// 14 cards should NOT trigger redistribution
			const cards = createCardsOnDate("2026-02-01", 14);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore);

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
			service = new LoadBalanceService(mockStore);

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
			service = new LoadBalanceService(mockStore);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20, // Normal threshold = 12, easy threshold = 7
				easyDays: createEasyDaysConfig([0], []), // Sunday
				easyDaysMultiplier: 0.5,
				dryRun: true,
			});

			// 10 cards on easy day: threshold 7 triggers, trims to easy target 5
			expect(result.affectedCount).toBe(5);
		});

		it("applies changes when dryRun is false", async () => {
			const cards = createCardsOnDate("2026-02-01", 20);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore);

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
			service = new LoadBalanceService(mockStore);

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
			service = new LoadBalanceService(mockStore);

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
			service = new LoadBalanceService(mockStore);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				dryRun: true,
			});

			// Before should show original distribution
			const beforeDay1 = result.beforeDistribution.find(
				(d) => d.date === "2026-02-01",
			);
			expect(beforeDay1?.count).toBe(20);

			// After should show balanced distribution
			const afterDay1 = result.afterDistribution.find(
				(d) => d.date === "2026-02-01",
			);
			expect(afterDay1?.count).toBeLessThan(20);
		});
	});

	describe("balance with overdue backlog", () => {
		it("buckets overdue cards as today and spreads the excess forward", async () => {
			// 20 cards a week overdue, target 10, deviation 20% (threshold = 12)
			const cards = createCardsOnDate("2026-01-25", 20);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				dryRun: true,
			});

			expect(result.affectedCount).toBe(10);
			result.changes.forEach((change) => {
				const newDate = change.newDue.split("T")[0] ?? "";
				expect(newDate > "2026-02-01").toBe(true);
			});
		});

		it("counts overdue and today's cards as one bucket", async () => {
			const cards = [
				...createCardsOnDate("2026-01-28", 8), // overdue
				...createCardsOnDate("2026-02-01", 8), // due today
			];
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20, // threshold 12 triggers; bucket 16 trims to 10
				dryRun: true,
			});

			expect(result.affectedCount).toBe(6);
		});

		it("queries the full past range by default", async () => {
			mockStore.getDueCardsByDateRange.mockReturnValue([]);

			await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				dryRun: true,
			});

			expect(mockStore.getDueCardsByDateRange).toHaveBeenCalledWith(
				"1970-01-01",
				"2026-03-03",
			);
		});

		it("queries from today when includeOverdue is false", async () => {
			mockStore.getDueCardsByDateRange.mockReturnValue([]);

			await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				includeOverdue: false,
				dryRun: true,
			});

			expect(mockStore.getDueCardsByDateRange).toHaveBeenCalledWith(
				"2026-02-01",
				"2026-03-03",
			);
		});

		it("subtracts reviews already done today from today's capacity", async () => {
			// 10 due today at target 10 (threshold 12) would normally stay put,
			// but 8 reviews already done leave capacity 2 (threshold 2+2=4):
			// 10 > 4 triggers and the day trims down to the remaining 2.
			const cards = createCardsOnDate("2026-02-01", 10);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				completedToday: 8,
				dryRun: true,
			});

			expect(result.affectedCount).toBe(8);
		});

		it("ignores New-state cards when counting and moving", async () => {
			// 10 review cards + 5 new cards on today; effective count 10 <= 12
			const reviewCards = createCardsOnDate("2026-02-01", 10);
			const newCards = createCardsOnDate("2026-02-01", 5).map((card, i) => ({
				...card,
				id: `new-${i}`,
				state: State.New,
			}));
			const cards = [...reviewCards, ...newCards];
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				dryRun: true,
			});

			expect(result.affectedCount).toBe(0);
		});

		it("moves the longest-interval cards out of an overloaded day", async () => {
			// scheduledDays run 7..21; trims to target 10 → the 5 longest move
			const cards = createCardsOnDate("2026-02-01", 15);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				dryRun: true,
			});

			const movedIds = result.changes.map((c) => c.cardId).sort();
			expect(movedIds).toEqual([
				"card-2026-02-01-10",
				"card-2026-02-01-11",
				"card-2026-02-01-12",
				"card-2026-02-01-13",
				"card-2026-02-01-14",
			]);
		});
	});

	describe("auto target", () => {
		it("computes the auto target as the average daily workload", () => {
			// 62 cards over a 31-day window (today + 30) → 2/day
			const cards = [
				...createCardsOnDate("2026-01-20", 31),
				...createCardsOnDate("2026-02-05", 31),
			];
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);

			expect(service.computeAutoTarget()).toBe(2);
		});

		it("weights easy days as a fraction of a normal day", () => {
			const cards = createCardsOnDate("2026-02-05", 62);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);

			// All days easy at 0.5 → 15.5 weighted days → 62 / 15.5 = 4
			expect(
				service.computeAutoTarget(
					createEasyDaysConfig([0, 1, 2, 3, 4, 5, 6], []),
					0.5,
				),
			).toBe(4);
		});

		it("balances against the derived target when none is given", async () => {
			// 20 cards today, auto target = round(20/31) = 1 → threshold 1.2
			const cards = createCardsOnDate("2026-02-01", 20);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore);

			const result = await service.balance({
				maxDeviation: 20,
				dryRun: true,
			});

			expect(result.affectedCount).toBe(19);
			result.changes.forEach((change) => {
				expect(change.newDue).not.toContain("2026-02-01");
			});
		});
	});

	describe("cardIds scoping", () => {
		it("moves only cards from the given subset", async () => {
			// 15 cards today, threshold 12 → 3 excess, but only 2 movable
			const cards = createCardsOnDate("2026-02-01", 15);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20,
				cardIds: ["card-2026-02-01-0", "card-2026-02-01-5"],
				dryRun: true,
			});

			expect(result.affectedCount).toBe(2);
			expect(result.changes.map((c) => c.cardId).sort()).toEqual([
				"card-2026-02-01-0",
				"card-2026-02-01-5",
			]);
		});

		it("still counts non-movable cards toward day capacity", async () => {
			// Day is within threshold only because all 15 cards count; the
			// movable pair must not be moved when the day is not overloaded.
			const cards = createCardsOnDate("2026-02-01", 12);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new LoadBalanceService(mockStore);

			const result = await service.balance({
				targetPerDay: 10,
				maxDeviation: 20, // threshold 12, day exactly at limit
				cardIds: ["card-2026-02-01-0", "card-2026-02-01-5"],
				dryRun: true,
			});

			expect(result.affectedCount).toBe(0);
		});
	});

	describe("balanceDue hot path", () => {
		it("builds its distribution from aggregated counts, not full card rows", () => {
			mockStore.getDueCountsByDateRange.mockReturnValue([
				{ day: "2026-02-05", count: 12 },
			]);

			const result = service.balanceDue({
				cardId: "current-card",
				originalDue: "2026-02-05T10:00:00.000Z",
				maxShiftDays: 3,
			});

			expect(result.balanced).toBe(true);
			expect(mockStore.getDueCountsByDateRange).toHaveBeenCalled();
			expect(mockStore.getDueCardsByDateRange).not.toHaveBeenCalled();
		});

		it("excludes the balanced card itself from the counts", () => {
			mockStore.getDueCountsByDateRange.mockReturnValue([]);

			service.balanceDue({
				cardId: "current-card",
				originalDue: "2026-02-05T10:00:00.000Z",
				maxShiftDays: 3,
			});

			expect(mockStore.getDueCountsByDateRange).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(String),
				"current-card",
			);
		});

		it("derives the auto target from aggregated counts when no target is given", () => {
			// 62 cards over the 31-day window → target 2/day
			mockStore.getDueCountsByDateRange.mockReturnValue([
				{ day: "2026-02-05", count: 62 },
			]);

			expect(service.computeAutoTarget()).toBe(2);
			expect(mockStore.getDueCardsByDateRange).not.toHaveBeenCalled();
		});
	});

	describe("balanceDue (Anki-style fuzz balancing)", () => {
		it("keeps the original day when it is the least loaded in the fuzz range", () => {
			// interval 4 → candidates days 3-5; neighbors loaded, target day empty
			mockStore.getDueCountsByDateRange.mockReturnValue([
				{ day: "2026-02-04", count: 50 },
				{ day: "2026-02-06", count: 50 },
			]);

			const result = service.balanceDue({
				cardId: "current-card",
				originalDue: "2026-02-05T10:00:00.000Z",
				maxShiftDays: 3,
			});

			expect(result.balanced).toBe(false);
			expect(result.newDue).toBe("2026-02-05T10:00:00.000Z");
		});

		it("moves off a loaded day within the fuzz range, keeping time-of-day", () => {
			mockStore.getDueCountsByDateRange.mockReturnValue([
				{ day: "2026-02-05", count: 12 },
			]);

			const result = service.balanceDue({
				cardId: "current-card",
				originalDue: "2026-02-05T10:00:00.000Z",
				maxShiftDays: 3,
			});

			expect(result.balanced).toBe(true);
			expect(Math.abs(result.daysChanged)).toBeLessThanOrEqual(3);
			expect(result.newDue.endsWith("T10:00:00.000Z")).toBe(true);
			expect(["2026-02-04", "2026-02-06"]).toContain(
				result.newDue.split("T")[0],
			);
		});

		it("skips intervals under 2.5 days like Anki", () => {
			const result = service.balanceDue({
				cardId: "current-card",
				originalDue: "2026-02-03T10:00:00.000Z",
				maxShiftDays: 3,
			});

			expect(result.balanced).toBe(false);
			expect(mockStore.getDueCountsByDateRange).not.toHaveBeenCalled();
		});

		it("skips intervals beyond the 90-day balancing horizon", () => {
			const result = service.balanceDue({
				cardId: "current-card",
				originalDue: "2026-06-01T10:00:00.000Z",
				maxShiftDays: 14,
			});

			expect(result.balanced).toBe(false);
			expect(mockStore.getDueCountsByDateRange).not.toHaveBeenCalled();
		});

		it("caps the shift at maxShiftDays even when the fuzz range is wider", () => {
			// interval 30 → fuzz range ~27-33, but maxShiftDays 1 → days 29-31
			mockStore.getDueCountsByDateRange.mockReturnValue([
				{ day: "2026-03-03", count: 40 },
			]);

			const result = service.balanceDue({
				cardId: "current-card",
				originalDue: "2026-03-03T10:00:00.000Z",
				maxShiftDays: 1,
			});

			expect(result.balanced).toBe(true);
			expect(Math.abs(result.daysChanged)).toBeLessThanOrEqual(1);
		});

		it("is deterministic for the same card and target day", () => {
			mockStore.getDueCountsByDateRange.mockReturnValue([
				{ day: "2026-02-05", count: 12 },
			]);

			const first = service.balanceDue({
				cardId: "current-card",
				originalDue: "2026-02-05T10:00:00.000Z",
				maxShiftDays: 3,
			});
			const second = service.balanceDue({
				cardId: "current-card",
				originalDue: "2026-02-05T10:00:00.000Z",
				maxShiftDays: 3,
			});

			expect(second.newDue).toBe(first.newDue);
			expect(second.balanced).toBe(first.balanced);
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
			service = new LoadBalanceService(mockStore);

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
			service = new LoadBalanceService(mockStore);

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
			service = new LoadBalanceService(mockStore);

			const distribution = service.getDistribution(7);

			expect(distribution.length).toBe(8); // 7 days + today
			distribution.forEach((d) => {
				expect(d.count).toBe(0);
			});
		});
	});
});
