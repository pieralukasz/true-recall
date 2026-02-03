/**
 * Flatten Service Tests
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { FlattenService } from "../../../../src/services/fsrs-helper/scheduler/flatten.service";
import { createMockCardStore, createCardsOnDate } from "../mocks/scheduler.mocks";

describe("FlattenService", () => {
	let service: FlattenService;
	let mockStore: ReturnType<typeof createMockCardStore>;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
		mockStore = createMockCardStore();
		service = new FlattenService(mockStore );
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("flatten", () => {
		it("returns empty when cards under limit", async () => {
			const cards = createCardsOnDate("2026-02-01", 5);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new FlattenService(mockStore );

			const result = await service.flatten({
				date: "2026-02-01",
				maxCards: 10,
				dryRun: true,
			});

			expect(result.affectedCount).toBe(0);
			expect(result.changes).toHaveLength(0);
		});

		it("keeps N cards with longest intervals", async () => {
			// Cards with different intervals
			const cards = [
				{ id: "card-30", due: "2026-02-01T10:00:00.000Z", scheduledDays: 30 },
				{ id: "card-20", due: "2026-02-01T10:00:00.000Z", scheduledDays: 20 },
				{ id: "card-10", due: "2026-02-01T10:00:00.000Z", scheduledDays: 10 },
				{ id: "card-5", due: "2026-02-01T10:00:00.000Z", scheduledDays: 5 },
				{ id: "card-1", due: "2026-02-01T10:00:00.000Z", scheduledDays: 1 },
			];
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new FlattenService(mockStore );

			const result = await service.flatten({
				date: "2026-02-01",
				maxCards: 3,
				dryRun: true,
			});

			// Should move cards with shortest intervals (5, 1)
			expect(result.affectedCount).toBe(2);
			const movedIds = result.changes.map((c) => c.cardId);
			expect(movedIds).toContain("card-5");
			expect(movedIds).toContain("card-1");
			expect(movedIds).not.toContain("card-30");
			expect(movedIds).not.toContain("card-20");
			expect(movedIds).not.toContain("card-10");
		});

		it("moves excess to consecutive days", async () => {
			const cards = createCardsOnDate("2026-02-01", 10);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new FlattenService(mockStore );

			const result = await service.flatten({
				date: "2026-02-01",
				maxCards: 5,
				dryRun: true,
			});

			expect(result.affectedCount).toBe(5);
			// All moved cards should go to day + 1
			result.changes.forEach((change) => {
				expect(change.newDue).toContain("2026-02-02");
				expect(change.daysChanged).toBe(1);
			});
		});

		it("fills each overflow day to maxCards before moving to next", async () => {
			// 15 cards, max 5 per day
			// Day 1: keep 5, move 10
			// Day 2: 5 cards
			// Day 3: 5 cards
			const cards = createCardsOnDate("2026-02-01", 15);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new FlattenService(mockStore );

			const result = await service.flatten({
				date: "2026-02-01",
				maxCards: 5,
				dryRun: true,
			});

			expect(result.affectedCount).toBe(10);

			// Check distribution after
			const day2Count = result.afterDistribution.find(
				(d) => d.date === "2026-02-02"
			);
			expect(day2Count?.count).toBe(5);
		});

		it("applies changes when dryRun is false", async () => {
			const cards = createCardsOnDate("2026-02-01", 10);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new FlattenService(mockStore );

			await service.flatten({
				date: "2026-02-01",
				maxCards: 5,
				dryRun: false,
			});

			expect(mockStore.updateCardDue).toHaveBeenCalledTimes(5);
		});

		it("does not apply changes when dryRun is true", async () => {
			const cards = createCardsOnDate("2026-02-01", 10);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new FlattenService(mockStore );

			await service.flatten({
				date: "2026-02-01",
				maxCards: 5,
				dryRun: true,
			});

			expect(mockStore.updateCardDue).not.toHaveBeenCalled();
		});

		it("returns correct before and after distributions", async () => {
			const cards = createCardsOnDate("2026-02-01", 10);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new FlattenService(mockStore );

			const result = await service.flatten({
				date: "2026-02-01",
				maxCards: 5,
				dryRun: true,
			});

			// Before should show 10 on target date
			const before = result.beforeDistribution.find(
				(d) => d.date === "2026-02-01"
			);
			expect(before?.count).toBe(10);

			// After should show 5 on target date
			const after = result.afterDistribution.find(
				(d) => d.date === "2026-02-01"
			);
			expect(after?.count).toBe(5);
		});
	});

	describe("findOverloadedDays", () => {
		it("identifies days exceeding maxCards", () => {
			const cards = [
				...createCardsOnDate("2026-02-01", 15), // Overloaded
				...createCardsOnDate("2026-02-02", 5), // Normal
				...createCardsOnDate("2026-02-03", 12), // Overloaded
			];
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new FlattenService(mockStore );

			const overloaded = service.findOverloadedDays(10, 7);

			expect(overloaded).toHaveLength(2);
			expect(overloaded.find((d) => d.date === "2026-02-01")?.excess).toBe(5);
			expect(overloaded.find((d) => d.date === "2026-02-03")?.excess).toBe(2);
		});

		it("returns correct excess counts", () => {
			const cards = createCardsOnDate("2026-02-01", 25);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new FlattenService(mockStore );

			const overloaded = service.findOverloadedDays(10, 7);

			expect(overloaded).toHaveLength(1);
			expect(overloaded[0]!.count).toBe(25);
			expect(overloaded[0]!.excess).toBe(15);
		});

		it("returns empty when no days overloaded", () => {
			const cards = [
				...createCardsOnDate("2026-02-01", 5),
				...createCardsOnDate("2026-02-02", 8),
			];
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new FlattenService(mockStore );

			const overloaded = service.findOverloadedDays(10, 7);

			expect(overloaded).toHaveLength(0);
		});

		it("sorts overloaded days by date", () => {
			const cards = [
				...createCardsOnDate("2026-02-05", 15),
				...createCardsOnDate("2026-02-01", 15),
				...createCardsOnDate("2026-02-03", 15),
			];
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new FlattenService(mockStore );

			const overloaded = service.findOverloadedDays(10, 7);

			expect(overloaded[0]!.date).toBe("2026-02-01");
			expect(overloaded[1]!.date).toBe("2026-02-03");
			expect(overloaded[2]!.date).toBe("2026-02-05");
		});
	});
});
