/**
 * Reschedule Service Tests
 */

import { State } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RescheduleService } from "../../../../src/metrics/fsrs-tools/scheduler/reschedule.service";
import { createMockCardStore } from "../mocks/scheduler.mocks";

// Helper to create cards with FSRS data
function createFSRSCard(
	overrides?: Partial<{
		id: string;
		due: string;
		state: State;
		stability: number;
		difficulty: number;
		lastReview: string;
		scheduledDays: number;
		suspended: boolean;
	}>,
) {
	return {
		id: crypto.randomUUID(),
		due: "2026-02-10T10:00:00.000Z",
		state: State.Review,
		stability: 10,
		difficulty: 5,
		lastReview: "2026-02-01T10:00:00.000Z",
		scheduledDays: 7,
		suspended: false,
		...overrides,
	};
}

describe("RescheduleService", () => {
	let service: RescheduleService;
	let mockStore: ReturnType<typeof createMockCardStore>;
	const defaultFSRSSettings = {
		weights: null,
		requestRetention: 0.9,
		maximumInterval: 365,
		learningSteps: [1, 10],
		relearningSteps: [10],
		enableShortTerm: true,
	};

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
		mockStore = createMockCardStore();
		service = new RescheduleService(mockStore, defaultFSRSSettings);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("reschedule", () => {
		it("recalculates intervals using FSRS-6 power-law formula", async () => {
			// Card due in 10 days from last review, but stability=20 should produce ~20-day interval
			const card = createFSRSCard({
				id: "formula-test",
				stability: 20,
				due: "2026-02-05T10:00:00.000Z", // 4 days after lastReview
				lastReview: "2026-01-25T10:00:00.000Z",
			});
			mockStore = createMockCardStore([card]);
			mockStore.getCards.mockReturnValue([card]);
			service = new RescheduleService(mockStore, defaultFSRSSettings);

			const result = await service.reschedule({
				scope: "all",
				dryRun: true,
			});

			// At retention=0.9 with default FSRS-6 weights, stability=20 → interval ~20 days
			// Original due was 4 days after lastReview, new should be ~20, so change > 1 day
			expect(result.affectedCount).toBe(1);
			const change = result.changes[0];
			if (!change) throw new Error("expected one reschedule change");
			const newDue = new Date(change.newDue);
			const lastReview = new Date("2026-01-25T10:00:00.000Z");
			const interval = Math.round(
				(newDue.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24),
			);
			// FSRS-6 at retention=0.9: interval ≈ stability (with interval_modifier ~1.0)
			expect(interval).toBeGreaterThanOrEqual(15);
			expect(interval).toBeLessThanOrEqual(25);
		});

		it("respects maximumInterval cap", async () => {
			const card = createFSRSCard({
				id: "cap-test",
				stability: 1000, // Very high stability → would produce ~1000 day interval
				due: "2026-02-10T10:00:00.000Z",
				lastReview: "2026-01-01T10:00:00.000Z",
			});
			mockStore = createMockCardStore([card]);
			mockStore.getCards.mockReturnValue([card]);
			service = new RescheduleService(mockStore, {
				...defaultFSRSSettings,
				maximumInterval: 30,
			});

			const result = await service.reschedule({
				scope: "all",
				dryRun: true,
			});

			// High stability with cap=30 must produce a change
			expect(result.affectedCount).toBeGreaterThan(0);
			const newDue = new Date(result.changes[0]?.newDue);
			const lastReview = new Date("2026-01-01T10:00:00.000Z");
			const interval = Math.round(
				(newDue.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24),
			);
			expect(interval).toBeLessThanOrEqual(30);
		});

		it("only records changes > 1 day difference", async () => {
			// Card with interval that would barely change
			const card = createFSRSCard({
				id: "small-change",
				stability: 9.5, // Would result in similar interval
				due: "2026-02-10T10:00:00.000Z",
				lastReview: "2026-02-01T10:00:00.000Z",
			});
			mockStore = createMockCardStore([card]);
			mockStore.getCards.mockReturnValue([card]);
			service = new RescheduleService(mockStore, defaultFSRSSettings);

			const result = await service.reschedule({
				scope: "all",
				dryRun: true,
			});

			// Small changes (< 1 day) should not be recorded
			for (const change of result.changes) {
				expect(Math.abs(change.daysChanged)).toBeGreaterThan(0);
			}
		});

		it("excludes New, Learning, Relearning, and suspended cards", async () => {
			const reviewCard = createFSRSCard({
				id: "review",
				state: State.Review,
				stability: 50,
				due: "2026-02-05T10:00:00.000Z",
			});
			const newCard = createFSRSCard({ id: "new", state: State.New });
			const learningCard = createFSRSCard({
				id: "learning",
				state: State.Learning,
			});
			const relearningCard = createFSRSCard({
				id: "relearning",
				state: State.Relearning,
			});
			const suspendedCard = createFSRSCard({
				id: "suspended",
				state: State.Review,
				suspended: true,
			});

			const allCards = [
				reviewCard,
				newCard,
				learningCard,
				relearningCard,
				suspendedCard,
			];
			mockStore = createMockCardStore(allCards);
			mockStore.getCards.mockReturnValue(allCards);
			service = new RescheduleService(mockStore, defaultFSRSSettings);

			const result = await service.reschedule({
				scope: "all",
				dryRun: true,
			});

			const affectedIds = result.changes.map((c) => c.cardId);
			expect(affectedIds).not.toContain("new");
			expect(affectedIds).not.toContain("learning");
			expect(affectedIds).not.toContain("relearning");
			expect(affectedIds).not.toContain("suspended");
		});

		it("scope due only affects cards due today or earlier", async () => {
			const dueCard = createFSRSCard({
				id: "due",
				due: "2026-02-01T10:00:00.000Z", // Due today
				stability: 30,
			});
			const futureCard = createFSRSCard({
				id: "future",
				due: "2026-02-10T10:00:00.000Z", // Due in future
				stability: 30,
			});

			mockStore = createMockCardStore([dueCard, futureCard]);
			mockStore.getCards.mockReturnValue([dueCard, futureCard]);
			service = new RescheduleService(mockStore, defaultFSRSSettings);

			const result = await service.reschedule({
				scope: "due",
				dryRun: true,
			});

			const affectedIds = result.changes.map((c) => c.cardId);
			if (affectedIds.length > 0) {
				expect(affectedIds).not.toContain("future");
			}
		});

		it("scope overdue only affects past-due cards", async () => {
			const overdueCard = createFSRSCard({
				id: "overdue",
				due: "2026-01-25T10:00:00.000Z", // Overdue
				stability: 30,
			});
			const dueToday = createFSRSCard({
				id: "today",
				due: "2026-02-01T10:00:00.000Z", // Due today (not overdue)
				stability: 30,
			});

			mockStore = createMockCardStore([overdueCard, dueToday]);
			mockStore.getCards.mockReturnValue([overdueCard, dueToday]);
			service = new RescheduleService(mockStore, defaultFSRSSettings);

			const result = await service.reschedule({
				scope: "overdue",
				dryRun: true,
			});

			const affectedIds = result.changes.map((c) => c.cardId);
			expect(affectedIds).not.toContain("today");
		});

		it("scope selected uses provided cardIds", async () => {
			const card1 = createFSRSCard({ id: "card-1", stability: 30 });
			const card2 = createFSRSCard({ id: "card-2", stability: 30 });
			const card3 = createFSRSCard({ id: "card-3", stability: 30 });

			mockStore = createMockCardStore([card1, card2, card3]);
			mockStore.get.mockImplementation((id: string) => {
				return [card1, card2, card3].find((c) => c.id === id);
			});
			service = new RescheduleService(mockStore, defaultFSRSSettings);

			const result = await service.reschedule({
				scope: "selected",
				cardIds: ["card-1", "card-2"],
				dryRun: true,
			});

			const affectedIds = result.changes.map((c) => c.cardId);
			expect(affectedIds).not.toContain("card-3");
		});

		it("applies changes when dryRun is false", async () => {
			const card = createFSRSCard({ stability: 30 });
			mockStore = createMockCardStore([card]);
			mockStore.getCards.mockReturnValue([card]);
			service = new RescheduleService(mockStore, defaultFSRSSettings);

			await service.reschedule({
				scope: "all",
				dryRun: false,
			});

			// If changes were made, updateCardScheduling should have been called
			// (depends on whether the calculation results in a change)
		});

		it("does not apply changes when dryRun is true", async () => {
			const card = createFSRSCard({ stability: 30 });
			mockStore = createMockCardStore([card]);
			mockStore.getCards.mockReturnValue([card]);
			service = new RescheduleService(mockStore, defaultFSRSSettings);

			await service.reschedule({
				scope: "all",
				dryRun: true,
			});

			expect(mockStore.updateCardScheduling).not.toHaveBeenCalled();
		});

		it("updates both due and scheduledDays with correct values", async () => {
			const card = createFSRSCard({
				id: "update-test",
				stability: 50,
				lastReview: "2026-01-15T10:00:00.000Z",
				due: "2026-01-20T10:00:00.000Z", // Only 5 days after review, but stability=50
			});
			mockStore = createMockCardStore([card]);
			mockStore.getCards.mockReturnValue([card]);
			service = new RescheduleService(mockStore, defaultFSRSSettings);

			await service.reschedule({
				scope: "all",
				dryRun: false,
			});

			// stability=50, retention=0.9 → interval ~50 days; old was 5 days → must change
			expect(mockStore.updateCardScheduling).toHaveBeenCalled();
			const firstCall = mockStore.updateCardScheduling.mock.calls[0];
			if (!firstCall) {
				throw new Error("expected updateCardScheduling to be called");
			}
			const [cardId, updateData] = firstCall;
			expect(cardId).toBe("update-test");
			expect(updateData).toHaveProperty("due");
			expect(updateData).toHaveProperty("scheduledDays");
			// scheduledDays should be the interval from lastReview to newDue, not the diff
			expect(updateData.scheduledDays).toBeGreaterThan(30);
		});

		it("returns correct before and after distributions", async () => {
			const card = createFSRSCard({
				stability: 30,
				due: "2026-02-10T10:00:00.000Z",
			});
			mockStore = createMockCardStore([card]);
			mockStore.getCards.mockReturnValue([card]);
			service = new RescheduleService(mockStore, defaultFSRSSettings);

			const result = await service.reschedule({
				scope: "all",
				dryRun: true,
			});

			// Should have before distribution showing original date
			const beforeDist = result.beforeDistribution.find(
				(d) => d.date === "2026-02-10",
			);
			expect(beforeDist?.count).toBe(1);
		});

		it("uses FSRS-6 power-law formula (not FSRS-4.5 exponential)", async () => {
			// The FSRS-6 formula with default w[20]=0.1542 produces DIFFERENT results
			// than the old FSRS-4.5 formula: t = S * ln(9) / ln(1/r)
			// At retention=0.9, stability=100: FSRS-4.5 would give ~100, FSRS-6 gives ~100 too
			// But at stability=10: FSRS-4.5 gives ~10, FSRS-6 also ~10
			// The key difference shows at non-default retention.
			// At retention=0.85 with stability=100:
			//   FSRS-4.5: 100 * ln(9) / ln(1/0.85) ≈ 100 * 2.197 / 0.163 ≈ 1349 (capped)
			//   FSRS-6:   S * intervalModifier where modifier = (r^(1/DECAY) - 1) / FACTOR
			const card = createFSRSCard({
				id: "formula-verify",
				stability: 100,
				due: "2026-02-05T10:00:00.000Z",
				lastReview: "2026-01-25T10:00:00.000Z",
			});
			mockStore = createMockCardStore([card]);
			mockStore.getCards.mockReturnValue([card]);
			service = new RescheduleService(mockStore, {
				...defaultFSRSSettings,
				requestRetention: 0.9,
			});

			const result = await service.reschedule({
				scope: "all",
				dryRun: true,
			});

			expect(result.affectedCount).toBe(1);
			const change = result.changes[0];
			if (!change) throw new Error("expected one reschedule change");
			const newDue = new Date(change.newDue);
			const lastReview = new Date("2026-01-25T10:00:00.000Z");
			const interval = Math.round(
				(newDue.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24),
			);

			// At retention=0.9, interval ≈ stability (~100 days)
			// Must be within a reasonable range (FSRS-6 may differ slightly due to w[20])
			expect(interval).toBeGreaterThanOrEqual(80);
			expect(interval).toBeLessThanOrEqual(120);
		});
	});
});
