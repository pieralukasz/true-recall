/**
 * Flatten Service Tests
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FlattenService } from "../../../../src/metrics/fsrs-tools/scheduler/flatten.service";
import {
	createCardsOnDate,
	createMockCardStore,
} from "../mocks/scheduler.mocks";

describe("FlattenService", () => {
	let service: FlattenService;
	let mockStore: ReturnType<typeof createMockCardStore>;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
		mockStore = createMockCardStore();
		service = new FlattenService(mockStore);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("flatten", () => {
		it("returns empty when cards under limit", async () => {
			const cards = createCardsOnDate("2026-02-01", 5);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new FlattenService(mockStore);

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
			service = new FlattenService(mockStore);

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
			service = new FlattenService(mockStore);

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
			service = new FlattenService(mockStore);

			const result = await service.flatten({
				date: "2026-02-01",
				maxCards: 5,
				dryRun: true,
			});

			expect(result.affectedCount).toBe(10);

			// Check distribution after
			const day2Count = result.afterDistribution.find(
				(d) => d.date === "2026-02-02",
			);
			expect(day2Count?.count).toBe(5);
		});

		it("applies changes when dryRun is false", async () => {
			const cards = createCardsOnDate("2026-02-01", 10);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new FlattenService(mockStore);

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
			service = new FlattenService(mockStore);

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
			service = new FlattenService(mockStore);

			const result = await service.flatten({
				date: "2026-02-01",
				maxCards: 5,
				dryRun: true,
			});

			// Before should show 10 on target date
			const before = result.beforeDistribution.find(
				(d) => d.date === "2026-02-01",
			);
			expect(before?.count).toBe(10);

			// After should show 5 on target date
			const after = result.afterDistribution.find(
				(d) => d.date === "2026-02-01",
			);
			expect(after?.count).toBe(5);
		});

		it("only considers cards in cardIds when provided", async () => {
			const cards = createCardsOnDate("2026-02-01", 10);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new FlattenService(mockStore);

			const allowed = cards.slice(0, 4).map((c) => c.id);
			const result = await service.flatten({
				date: "2026-02-01",
				maxCards: 5,
				cardIds: allowed,
				dryRun: true,
			});

			// Only 4 cards in scope, under the limit of 5
			expect(result.affectedCount).toBe(0);
		});
	});

	describe("flattenFuture", () => {
		it("cascades overflow across consecutive days", () => {
			const cards = createCardsOnDate("2026-02-01", 12);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new FlattenService(mockStore);

			const result = service.flattenFuture({ maxCards: 5, dryRun: true });

			// 12 cards, 5/day: 5 stay, 5 -> Feb 2, 2 -> Feb 3
			expect(result.affectedCount).toBe(7);
			const after = new Map(
				result.afterDistribution.map((d) => [d.date, d.count]),
			);
			expect(after.get("2026-02-01")).toBe(5);
			expect(after.get("2026-02-02")).toBe(5);
			expect(after.get("2026-02-03")).toBe(2);
		});

		it("keeps longest intervals on their original day", () => {
			const cards = createCardsOnDate("2026-02-01", 6); // scheduledDays 7..12
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new FlattenService(mockStore);

			const result = service.flattenFuture({ maxCards: 4, dryRun: true });

			// Two shortest intervals (indices 0 and 1) move
			const movedIds = result.changes.map((c) => c.cardId);
			expect(movedIds).toContain("card-2026-02-01-0");
			expect(movedIds).toContain("card-2026-02-01-1");
			expect(movedIds).toHaveLength(2);
		});

		it("accounts for existing load on following days", () => {
			const cards = [
				...createCardsOnDate("2026-02-01", 8),
				...createCardsOnDate("2026-02-02", 4),
			];
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new FlattenService(mockStore);

			const result = service.flattenFuture({ maxCards: 5, dryRun: true });

			const after = new Map(
				result.afterDistribution.map((d) => [d.date, d.count]),
			);
			for (const count of after.values()) {
				expect(count).toBeLessThanOrEqual(5);
			}
			// 12 cards total: 5 + 5 + 2
			expect(after.get("2026-02-01")).toBe(5);
			expect(after.get("2026-02-02")).toBe(5);
			expect(after.get("2026-02-03")).toBe(2);
		});

		it("returns empty when all days under limit", () => {
			const cards = [
				...createCardsOnDate("2026-02-01", 3),
				...createCardsOnDate("2026-02-02", 4),
			];
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new FlattenService(mockStore);

			const result = service.flattenFuture({ maxCards: 5, dryRun: true });

			expect(result.affectedCount).toBe(0);
		});

		it("returns empty for maxCards below 1", () => {
			const cards = createCardsOnDate("2026-02-01", 5);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new FlattenService(mockStore);

			const result = service.flattenFuture({ maxCards: 0, dryRun: true });

			expect(result.affectedCount).toBe(0);
		});

		it("only considers cards in cardIds when provided", () => {
			const cards = createCardsOnDate("2026-02-01", 10);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new FlattenService(mockStore);

			const allowed = cards.slice(0, 6).map((c) => c.id);
			const result = service.flattenFuture({
				maxCards: 5,
				cardIds: allowed,
				dryRun: true,
			});

			// 6 cards in scope: 5 stay, 1 moves
			expect(result.affectedCount).toBe(1);
			expect(allowed).toContain(result.changes[0]?.cardId);
		});

		it("applies changes when dryRun is false", () => {
			const cards = createCardsOnDate("2026-02-01", 7);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new FlattenService(mockStore);

			const result = service.flattenFuture({ maxCards: 5, dryRun: false });

			expect(result.affectedCount).toBe(2);
			expect(mockStore.updateCardDue).toHaveBeenCalledTimes(2);
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
			service = new FlattenService(mockStore);

			const overloaded = service.findOverloadedDays(10, 7);

			expect(overloaded).toHaveLength(2);
			expect(overloaded.find((d) => d.date === "2026-02-01")?.excess).toBe(5);
			expect(overloaded.find((d) => d.date === "2026-02-03")?.excess).toBe(2);
		});

		it("returns correct excess counts", () => {
			const cards = createCardsOnDate("2026-02-01", 25);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new FlattenService(mockStore);

			const overloaded = service.findOverloadedDays(10, 7);

			expect(overloaded).toHaveLength(1);
			expect(overloaded[0]?.count).toBe(25);
			expect(overloaded[0]?.excess).toBe(15);
		});

		it("returns empty when no days overloaded", () => {
			const cards = [
				...createCardsOnDate("2026-02-01", 5),
				...createCardsOnDate("2026-02-02", 8),
			];
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new FlattenService(mockStore);

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
			service = new FlattenService(mockStore);

			const overloaded = service.findOverloadedDays(10, 7);

			expect(overloaded[0]?.date).toBe("2026-02-01");
			expect(overloaded[1]?.date).toBe("2026-02-03");
			expect(overloaded[2]?.date).toBe("2026-02-05");
		});
	});
});
