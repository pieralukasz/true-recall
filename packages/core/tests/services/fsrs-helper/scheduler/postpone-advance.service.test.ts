/**
 * Postpone/Advance Service Tests
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { PostponeAdvanceService } from "../../../../src/metrics/fsrs-tools/scheduler/postpone-advance.service";
import { createMockCardStore, createCardsOnDate } from "../mocks/scheduler.mocks";

describe("PostponeAdvanceService", () => {
	let service: PostponeAdvanceService;
	let mockStore: ReturnType<typeof createMockCardStore>;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
		mockStore = createMockCardStore();
		service = new PostponeAdvanceService(mockStore );
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("shift with action=postpone", () => {
		it("postpones cards by N days", async () => {
			const cards = createCardsOnDate("2026-02-01", 5);
			mockStore = createMockCardStore(cards);
			mockStore.getDueCardsByDateRange.mockReturnValue(cards);
			mockStore.getCards.mockReturnValue(
				cards.map((c) => ({ ...c, suspended: false, state: 2 }))
			);
			service = new PostponeAdvanceService(mockStore );

			const result = await service.shift({
				action: "postpone",
				days: 7,
				scope: "all",
				dryRun: true,
			});

			expect(result.affectedCount).toBe(5);
			result.changes.forEach((change) => {
				expect(change.daysChanged).toBe(7);
				expect(change.newDue).toContain("2026-02-08");
			});
		});

		it("scope due_today only affects cards due today", async () => {
			const todayCards = createCardsOnDate("2026-02-01", 3);
			const futureCards = createCardsOnDate("2026-02-05", 2);
			const allCards = [...todayCards, ...futureCards];

			mockStore = createMockCardStore(allCards);
			mockStore.getDueCardsByDateRange.mockReturnValue(todayCards);
			service = new PostponeAdvanceService(mockStore );

			const result = await service.shift({
				action: "postpone",
				days: 7,
				scope: "due_today",
				dryRun: true,
			});

			expect(result.affectedCount).toBe(3);
		});

		it("scope overdue only affects past-due cards", async () => {
			const overdueCards = [
				{ id: "overdue-1", due: "2026-01-25T10:00:00.000Z", scheduledDays: 7, suspended: false, state: 2 },
				{ id: "overdue-2", due: "2026-01-28T10:00:00.000Z", scheduledDays: 7, suspended: false, state: 2 },
			];
			const todayCards = createCardsOnDate("2026-02-01", 3).map((c) => ({
				...c,
				suspended: false,
				state: 2,
			}));
			const allCards = [...overdueCards, ...todayCards];

			mockStore = createMockCardStore(allCards);
			mockStore.getCards.mockReturnValue(allCards);
			service = new PostponeAdvanceService(mockStore );

			const result = await service.shift({
				action: "postpone",
				days: 7,
				scope: "overdue",
				dryRun: true,
			});

			expect(result.affectedCount).toBe(2);
		});

		it("scope selected uses provided cardIds", async () => {
			const cards = createCardsOnDate("2026-02-01", 5);
			mockStore = createMockCardStore(cards);
			mockStore.get.mockImplementation((id: string) => cards.find((c) => c.id === id));
			service = new PostponeAdvanceService(mockStore );

			const result = await service.shift({
				action: "postpone",
				days: 7,
				scope: "selected",
				cardIds: [cards[0]!.id, cards[1]!.id],
				dryRun: true,
			});

			expect(result.affectedCount).toBe(2);
		});

		it("scope all excludes new and suspended cards", async () => {
			const cards = [
				{ id: "review", due: "2026-02-01T10:00:00.000Z", scheduledDays: 7, suspended: false, state: 2 },
				{ id: "new", due: "2026-02-01T10:00:00.000Z", scheduledDays: 0, suspended: false, state: 0 },
				{ id: "suspended", due: "2026-02-01T10:00:00.000Z", scheduledDays: 7, suspended: true, state: 2 },
			];

			mockStore = createMockCardStore(cards);
			mockStore.getCards.mockReturnValue(cards);
			service = new PostponeAdvanceService(mockStore );

			const result = await service.shift({
				action: "postpone",
				days: 7,
				scope: "all",
				dryRun: true,
			});

			// Only the review card should be affected
			expect(result.affectedCount).toBe(1);
			expect(result.changes[0]!.cardId).toBe("review");
		});
	});

	describe("shift with action=advance", () => {
		it("advances cards by N days", async () => {
			const cards = createCardsOnDate("2026-02-10", 5);
			mockStore = createMockCardStore(cards);
			mockStore.getCards.mockReturnValue(
				cards.map((c) => ({ ...c, suspended: false, state: 2 }))
			);
			service = new PostponeAdvanceService(mockStore );

			const result = await service.shift({
				action: "advance",
				days: 5,
				scope: "all",
				dryRun: true,
			});

			expect(result.affectedCount).toBe(5);
			result.changes.forEach((change) => {
				expect(change.daysChanged).toBe(-5);
				expect(change.newDue).toContain("2026-02-05");
			});
		});

		it("cannot advance past today", async () => {
			// Cards due on Feb 5, trying to advance 10 days (would be Jan 26)
			const cards = createCardsOnDate("2026-02-05", 3);
			mockStore = createMockCardStore(cards);
			mockStore.getCards.mockReturnValue(
				cards.map((c) => ({ ...c, suspended: false, state: 2 }))
			);
			service = new PostponeAdvanceService(mockStore );

			const result = await service.shift({
				action: "advance",
				days: 10, // Would go to Jan 26, but should stop at today (Feb 1)
				scope: "all",
				dryRun: true,
			});

			// All cards should be set to today, not past
			result.changes.forEach((change) => {
				const newDate = new Date(change.newDue);
				const today = new Date("2026-02-01");
				today.setHours(0, 0, 0, 0);
				expect(newDate.getTime()).toBeGreaterThanOrEqual(today.getTime());
			});
		});
	});

	describe("dry run behavior", () => {
		it("applies changes when dryRun is false", async () => {
			const cards = createCardsOnDate("2026-02-01", 3);
			mockStore = createMockCardStore(cards);
			mockStore.getCards.mockReturnValue(
				cards.map((c) => ({ ...c, suspended: false, state: 2 }))
			);
			service = new PostponeAdvanceService(mockStore );

			await service.shift({
				action: "postpone",
				days: 7,
				scope: "all",
				dryRun: false,
			});

			expect(mockStore.updateCardDue).toHaveBeenCalledTimes(3);
		});

		it("does not apply changes when dryRun is true", async () => {
			const cards = createCardsOnDate("2026-02-01", 3);
			mockStore = createMockCardStore(cards);
			mockStore.getCards.mockReturnValue(
				cards.map((c) => ({ ...c, suspended: false, state: 2 }))
			);
			service = new PostponeAdvanceService(mockStore );

			await service.shift({
				action: "postpone",
				days: 7,
				scope: "all",
				dryRun: true,
			});

			expect(mockStore.updateCardDue).not.toHaveBeenCalled();
		});
	});

	describe("preserves time-of-day", () => {
		it("keeps original time when postponing", async () => {
			const cards = [
				{ id: "card-1", due: "2026-02-01T14:30:45.123Z", scheduledDays: 7, suspended: false, state: 2 },
			];
			mockStore = createMockCardStore(cards);
			mockStore.getCards.mockReturnValue(cards);
			service = new PostponeAdvanceService(mockStore );

			const result = await service.shift({
				action: "postpone",
				days: 7,
				scope: "all",
				dryRun: true,
			});

			expect(result.changes[0]!.newDue).toContain("T14:30:45");
		});
	});

	describe("returns correct distributions", () => {
		it("tracks before and after distributions", async () => {
			const cards = createCardsOnDate("2026-02-01", 5);
			mockStore = createMockCardStore(cards);
			mockStore.getCards.mockReturnValue(
				cards.map((c) => ({ ...c, suspended: false, state: 2 }))
			);
			service = new PostponeAdvanceService(mockStore );

			const result = await service.shift({
				action: "postpone",
				days: 7,
				scope: "all",
				dryRun: true,
			});

			// Before should show original date
			const beforeDay = result.beforeDistribution.find(
				(d) => d.date === "2026-02-01"
			);
			expect(beforeDay?.count).toBe(5);

			// After should show new date
			const afterDay = result.afterDistribution.find(
				(d) => d.date === "2026-02-08"
			);
			expect(afterDay?.count).toBe(5);
		});
	});
});
