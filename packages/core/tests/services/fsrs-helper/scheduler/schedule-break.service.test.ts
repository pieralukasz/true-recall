/**
 * Schedule Break Service Tests
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScheduleBreakService } from "../../../../src/metrics/fsrs-tools/scheduler/schedule-break.service";
import {
	createCardsInRange,
	createCardsOnDate,
	createMockCardStore,
} from "../mocks/scheduler.mocks";

describe("ScheduleBreakService", () => {
	let service: ScheduleBreakService;
	let mockStore: ReturnType<typeof createMockCardStore>;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
		mockStore = createMockCardStore();
		service = new ScheduleBreakService(mockStore);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("scheduleBreak", () => {
		it("returns empty when no cards during break", async () => {
			mockStore = createMockCardStore([]);
			mockStore.getDueCardsByDateRange.mockReturnValue([]);
			service = new ScheduleBreakService(mockStore);

			const result = await service.scheduleBreak({
				startDate: "2026-02-10",
				endDate: "2026-02-17",
				dryRun: true,
			});

			expect(result.affectedCount).toBe(0);
		});

		it("redistributes cards before break", async () => {
			// 8 cards during 4-day break (Feb 10-13)
			const breakCards = createCardsInRange("2026-02-10", "2026-02-13", 2);
			mockStore = createMockCardStore(breakCards);
			mockStore.getDueCardsByDateRange.mockReturnValue(breakCards);
			service = new ScheduleBreakService(mockStore);

			const result = await service.scheduleBreak({
				startDate: "2026-02-10",
				endDate: "2026-02-13",
				redistributeBefore: true,
				redistributeAfter: false,
				dryRun: true,
			});

			expect(result.affectedCount).toBe(8);
			// All cards should be moved to dates before Feb 10
			result.changes.forEach((change) => {
				const newDue = new Date(change.newDue);
				expect(newDue.getTime()).toBeLessThan(new Date("2026-02-10").getTime());
			});
		});

		it("redistributes cards after break", async () => {
			const breakCards = createCardsInRange("2026-02-10", "2026-02-13", 2);
			mockStore = createMockCardStore(breakCards);
			mockStore.getDueCardsByDateRange.mockReturnValue(breakCards);
			service = new ScheduleBreakService(mockStore);

			const result = await service.scheduleBreak({
				startDate: "2026-02-10",
				endDate: "2026-02-13",
				redistributeBefore: false,
				redistributeAfter: true,
				dryRun: true,
			});

			expect(result.affectedCount).toBe(8);
			// All cards should be moved to dates after Feb 13
			result.changes.forEach((change) => {
				const newDue = new Date(change.newDue);
				expect(newDue.getTime()).toBeGreaterThan(
					new Date("2026-02-13").getTime(),
				);
			});
		});

		it("redistributes both before and after", async () => {
			const breakCards = createCardsOnDate("2026-02-12", 10);
			mockStore = createMockCardStore(breakCards);
			mockStore.getDueCardsByDateRange.mockReturnValue(breakCards);
			service = new ScheduleBreakService(mockStore);

			const result = await service.scheduleBreak({
				startDate: "2026-02-10",
				endDate: "2026-02-14",
				redistributeBefore: true,
				redistributeAfter: true,
				dryRun: true,
			});

			expect(result.affectedCount).toBe(10);

			// Cards should be split between before and after
			const beforeBreak = result.changes.filter(
				(c) => new Date(c.newDue) < new Date("2026-02-10"),
			);
			const afterBreak = result.changes.filter(
				(c) => new Date(c.newDue) > new Date("2026-02-14"),
			);

			expect(beforeBreak.length).toBeGreaterThan(0);
			expect(afterBreak.length).toBeGreaterThan(0);
		});

		it("postpones to after break if no redistribution", async () => {
			const breakCards = createCardsOnDate("2026-02-12", 5);
			mockStore = createMockCardStore(breakCards);
			mockStore.getDueCardsByDateRange.mockReturnValue(breakCards);
			service = new ScheduleBreakService(mockStore);

			const result = await service.scheduleBreak({
				startDate: "2026-02-10",
				endDate: "2026-02-14",
				redistributeBefore: false,
				redistributeAfter: false,
				dryRun: true,
			});

			expect(result.affectedCount).toBe(5);
			// All cards should go to day after break (Feb 15)
			result.changes.forEach((change) => {
				expect(change.newDue).toContain("2026-02-15");
			});
		});

		it("handles single-day break", async () => {
			const breakCards = createCardsOnDate("2026-02-10", 5);
			mockStore = createMockCardStore(breakCards);
			mockStore.getDueCardsByDateRange.mockReturnValue(breakCards);
			service = new ScheduleBreakService(mockStore);

			const result = await service.scheduleBreak({
				startDate: "2026-02-10",
				endDate: "2026-02-10",
				redistributeBefore: true,
				redistributeAfter: true,
				dryRun: true,
			});

			expect(result.affectedCount).toBe(5);
		});

		it("handles multi-week break", async () => {
			// 14-day break with 28 cards
			const breakCards = createCardsInRange("2026-02-10", "2026-02-23", 2);
			mockStore = createMockCardStore(breakCards);
			mockStore.getDueCardsByDateRange.mockReturnValue(breakCards);
			service = new ScheduleBreakService(mockStore);

			const result = await service.scheduleBreak({
				startDate: "2026-02-10",
				endDate: "2026-02-23",
				redistributeBefore: true,
				redistributeAfter: true,
				dryRun: true,
			});

			expect(result.affectedCount).toBe(28);
		});

		it("applies changes when dryRun is false", async () => {
			const breakCards = createCardsOnDate("2026-02-12", 5);
			mockStore = createMockCardStore(breakCards);
			mockStore.getDueCardsByDateRange.mockReturnValue(breakCards);
			service = new ScheduleBreakService(mockStore);

			await service.scheduleBreak({
				startDate: "2026-02-10",
				endDate: "2026-02-14",
				dryRun: false,
			});

			expect(mockStore.updateCardDue).toHaveBeenCalledTimes(5);
		});

		it("does not apply changes when dryRun is true", async () => {
			const breakCards = createCardsOnDate("2026-02-12", 5);
			mockStore = createMockCardStore(breakCards);
			mockStore.getDueCardsByDateRange.mockReturnValue(breakCards);
			service = new ScheduleBreakService(mockStore);

			await service.scheduleBreak({
				startDate: "2026-02-10",
				endDate: "2026-02-14",
				dryRun: true,
			});

			expect(mockStore.updateCardDue).not.toHaveBeenCalled();
		});

		it("distributes cards evenly across redistribution days", async () => {
			// 12 cards, 4-day break = 2 days before, 2 days after
			// Should be ~3 cards per day
			const breakCards = createCardsOnDate("2026-02-12", 12);
			mockStore = createMockCardStore(breakCards);
			mockStore.getDueCardsByDateRange.mockReturnValue(breakCards);
			service = new ScheduleBreakService(mockStore);

			const result = await service.scheduleBreak({
				startDate: "2026-02-10",
				endDate: "2026-02-13",
				redistributeBefore: true,
				redistributeAfter: true,
				dryRun: true,
			});

			// Check distribution is somewhat even
			const distribution = new Map<string, number>();
			for (const change of result.changes) {
				const [date] = change.newDue.split("T");
				if (!date) continue;
				distribution.set(date, (distribution.get(date) ?? 0) + 1);
			}

			// Each day should have roughly similar counts
			const counts = Array.from(distribution.values());
			const maxCount = Math.max(...counts);
			const minCount = Math.min(...counts);
			expect(maxCount - minCount).toBeLessThanOrEqual(2); // Allow some variance
		});
	});

	describe("previewBreak", () => {
		it("returns correct cardsAffected count", () => {
			const breakCards = createCardsOnDate("2026-02-12", 10);
			mockStore = createMockCardStore(breakCards);
			mockStore.getDueCardsByDateRange.mockReturnValue(breakCards);
			service = new ScheduleBreakService(mockStore);

			const preview = service.previewBreak("2026-02-10", "2026-02-14");

			expect(preview.cardsAffected).toBe(10);
		});

		it("calculates breakDays correctly", () => {
			mockStore = createMockCardStore([]);
			mockStore.getDueCardsByDateRange.mockReturnValue([]);
			service = new ScheduleBreakService(mockStore);

			const preview = service.previewBreak("2026-02-10", "2026-02-14");

			// Feb 10-14 inclusive = 5 days
			expect(preview.breakDays).toBe(5);
		});

		it("handles single-day break preview", () => {
			mockStore = createMockCardStore([]);
			mockStore.getDueCardsByDateRange.mockReturnValue([]);
			service = new ScheduleBreakService(mockStore);

			const preview = service.previewBreak("2026-02-10", "2026-02-10");

			expect(preview.breakDays).toBe(1);
		});

		it("only counts cards in cardIds when provided", () => {
			const cards = createCardsOnDate("2026-02-10", 10);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new ScheduleBreakService(mockStore);

			const allowed = cards.slice(0, 3).map((c) => c.id);
			const preview = service.previewBreak("2026-02-10", "2026-02-14", allowed);

			expect(preview.cardsAffected).toBe(3);
		});
	});

	describe("cardIds scoping", () => {
		it("only redistributes cards in cardIds", async () => {
			const cards = createCardsOnDate("2026-02-10", 10);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			service = new ScheduleBreakService(mockStore);

			const allowed = cards.slice(0, 4).map((c) => c.id);
			const result = await service.scheduleBreak({
				startDate: "2026-02-10",
				endDate: "2026-02-14",
				cardIds: allowed,
				dryRun: true,
			});

			expect(result.affectedCount).toBe(4);
			for (const change of result.changes) {
				expect(allowed).toContain(change.cardId);
			}
		});
	});
});
