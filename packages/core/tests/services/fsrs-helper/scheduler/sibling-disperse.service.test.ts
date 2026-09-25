/**
 * Sibling Disperse Service Tests
 */
import { State } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SchedulerCardData } from "../../../../src/metrics/fsrs-tools/scheduler/scheduler.types";
import { SiblingDisperseService } from "../../../../src/metrics/fsrs-tools/scheduler/sibling-disperse.service";
import {
	createMockCardStore,
	createSiblingCards,
} from "../mocks/scheduler.mocks";

describe("SiblingDisperseService", () => {
	let service: SiblingDisperseService;
	let mockStore: ReturnType<typeof createMockCardStore>;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
		mockStore = createMockCardStore();
		service = new SiblingDisperseService(mockStore);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("disperse", () => {
		it("spaces siblings by minInterval days", async () => {
			// 3 siblings all due on same day
			const siblings = createSiblingCards("note-1", [
				"2026-02-01",
				"2026-02-01",
				"2026-02-01",
			]);
			mockStore = createMockCardStore(siblings);
			mockStore.getCards.mockReturnValue(
				siblings.map((c) => ({ ...c, suspended: false, state: 2 })),
			);
			service = new SiblingDisperseService(mockStore);

			const result = await service.disperse({
				minInterval: 3,
				dryRun: true,
			});

			// First card stays, second moves +3 days, third moves +6 days
			expect(result.affectedCount).toBe(2);

			const changes = result.changes.sort(
				(a, b) => a.daysChanged - b.daysChanged,
			);
			expect(changes[0]?.daysChanged).toBe(3);
			expect(changes[1]?.daysChanged).toBe(6);
		});

		it("only affects groups with 2+ cards", async () => {
			// Single card - should not be affected
			const singleCard = createSiblingCards("note-1", ["2026-02-01"]);
			mockStore = createMockCardStore(singleCard);
			mockStore.getCards.mockReturnValue(
				singleCard.map((c) => ({ ...c, suspended: false, state: 2 })),
			);
			service = new SiblingDisperseService(mockStore);

			const result = await service.disperse({
				minInterval: 3,
				dryRun: true,
			});

			expect(result.affectedCount).toBe(0);
		});

		it("pushes later cards forward", async () => {
			// Siblings 1 day apart, minInterval 3
			const siblings = createSiblingCards("note-1", [
				"2026-02-01",
				"2026-02-02",
			]);
			mockStore = createMockCardStore(siblings);
			mockStore.getCards.mockReturnValue(
				siblings.map((c) => ({ ...c, suspended: false, state: 2 })),
			);
			service = new SiblingDisperseService(mockStore);

			const result = await service.disperse({
				minInterval: 3,
				dryRun: true,
			});

			// Second card should move from Feb 2 to Feb 4 (3 days after Feb 1)
			expect(result.affectedCount).toBe(1);
			expect(result.changes[0]?.newDue).toContain("2026-02-04");
		});

		it("works for specific sourceUid", async () => {
			const group1 = createSiblingCards("note-1", ["2026-02-01", "2026-02-01"]);
			const group2 = createSiblingCards("note-2", ["2026-02-01", "2026-02-01"]);
			const allCards = [...group1, ...group2];

			mockStore = createMockCardStore(allCards);
			mockStore.getCards.mockReturnValue(
				allCards.map((c) => ({ ...c, suspended: false, state: 2 })),
			);
			service = new SiblingDisperseService(mockStore);

			const result = await service.disperse({
				minInterval: 3,
				sourceUid: "note-1",
				dryRun: true,
			});

			// Only note-1 siblings should be affected
			expect(result.affectedCount).toBe(1);
			expect(result.changes[0]?.cardId).toContain("note-1");
		});

		it("works for all sources when no sourceUid provided", async () => {
			const group1 = createSiblingCards("note-1", ["2026-02-01", "2026-02-01"]);
			const group2 = createSiblingCards("note-2", ["2026-02-01", "2026-02-01"]);
			const allCards = [...group1, ...group2];

			mockStore = createMockCardStore(allCards);
			mockStore.getCards.mockReturnValue(
				allCards.map((c) => ({ ...c, suspended: false, state: 2 })),
			);
			service = new SiblingDisperseService(mockStore);

			const result = await service.disperse({
				minInterval: 3,
				dryRun: true,
			});

			// Both groups should have 1 card moved
			expect(result.affectedCount).toBe(2);
		});

		it("does not move cards already spaced correctly", async () => {
			// Siblings 5 days apart, minInterval 3
			const siblings = createSiblingCards("note-1", [
				"2026-02-01",
				"2026-02-06",
			]);
			mockStore = createMockCardStore(siblings);
			mockStore.getCards.mockReturnValue(
				siblings.map((c) => ({ ...c, suspended: false, state: 2 })),
			);
			service = new SiblingDisperseService(mockStore);

			const result = await service.disperse({
				minInterval: 3,
				dryRun: true,
			});

			expect(result.affectedCount).toBe(0);
		});

		it("applies changes when dryRun is false", async () => {
			const siblings = createSiblingCards("note-1", [
				"2026-02-01",
				"2026-02-01",
			]);
			mockStore = createMockCardStore(siblings);
			mockStore.getCards.mockReturnValue(
				siblings.map((c) => ({ ...c, suspended: false, state: 2 })),
			);
			service = new SiblingDisperseService(mockStore);

			await service.disperse({
				minInterval: 3,
				dryRun: false,
			});

			expect(mockStore.updateCardDue).toHaveBeenCalledTimes(1);
		});

		it("does not apply changes when dryRun is true", async () => {
			const siblings = createSiblingCards("note-1", [
				"2026-02-01",
				"2026-02-01",
			]);
			mockStore = createMockCardStore(siblings);
			mockStore.getCards.mockReturnValue(
				siblings.map((c) => ({ ...c, suspended: false, state: 2 })),
			);
			service = new SiblingDisperseService(mockStore);

			await service.disperse({
				minInterval: 3,
				dryRun: true,
			});

			expect(mockStore.updateCardDue).not.toHaveBeenCalled();
		});

		it("handles multiple siblings in chain", async () => {
			// 5 siblings all on same day, minInterval 2
			const siblings = createSiblingCards("note-1", [
				"2026-02-01",
				"2026-02-01",
				"2026-02-01",
				"2026-02-01",
				"2026-02-01",
			]);
			mockStore = createMockCardStore(siblings);
			mockStore.getCards.mockReturnValue(
				siblings.map((c) => ({ ...c, suspended: false, state: 2 })),
			);
			service = new SiblingDisperseService(mockStore);

			const result = await service.disperse({
				minInterval: 2,
				dryRun: true,
			});

			// 4 cards should move (first stays)
			expect(result.affectedCount).toBe(4);

			// Cards should be spaced: Feb 1, Feb 3, Feb 5, Feb 7, Feb 9
			const sortedChanges = result.changes.sort(
				(a, b) => a.daysChanged - b.daysChanged,
			);
			expect(sortedChanges[0]?.daysChanged).toBe(2);
			expect(sortedChanges[1]?.daysChanged).toBe(4);
			expect(sortedChanges[2]?.daysChanged).toBe(6);
			expect(sortedChanges[3]?.daysChanged).toBe(8);
		});
	});

	describe("findViolations", () => {
		it("identifies siblings closer than minInterval", () => {
			const siblings = createSiblingCards("note-1", [
				"2026-02-01",
				"2026-02-02", // 1 day apart - violation
			]);
			mockStore = createMockCardStore(siblings);
			mockStore.getCards.mockReturnValue(
				siblings.map((c) => ({ ...c, suspended: false, state: 2 })),
			);
			service = new SiblingDisperseService(mockStore);

			const violations = service.findViolations(3);

			expect(violations).toHaveLength(1);
			expect(violations[0]?.sourceUid).toBe("note-1");
			expect(violations[0]?.violations).toBe(1);
		});

		it("returns sourceUid and violation count", () => {
			// 3 siblings all on same day = 2 violations
			const siblings = createSiblingCards("note-1", [
				"2026-02-01",
				"2026-02-01",
				"2026-02-01",
			]);
			mockStore = createMockCardStore(siblings);
			mockStore.getCards.mockReturnValue(
				siblings.map((c) => ({ ...c, suspended: false, state: 2 })),
			);
			service = new SiblingDisperseService(mockStore);

			const violations = service.findViolations(3);

			expect(violations[0]?.violations).toBe(2);
			expect(violations[0]?.cardCount).toBe(3);
		});

		it("returns empty when no violations", () => {
			const siblings = createSiblingCards("note-1", [
				"2026-02-01",
				"2026-02-05", // 4 days apart - no violation with minInterval 3
			]);
			mockStore = createMockCardStore(siblings);
			mockStore.getCards.mockReturnValue(
				siblings.map((c) => ({ ...c, suspended: false, state: 2 })),
			);
			service = new SiblingDisperseService(mockStore);

			const violations = service.findViolations(3);

			expect(violations).toHaveLength(0);
		});

		it("handles multiple groups", () => {
			const group1 = createSiblingCards("note-1", ["2026-02-01", "2026-02-01"]);
			const group2 = createSiblingCards("note-2", [
				"2026-02-01",
				"2026-02-05", // No violation
			]);
			const allCards = [...group1, ...group2];

			mockStore = createMockCardStore(allCards);
			mockStore.getCards.mockReturnValue(
				allCards.map((c) => ({ ...c, suspended: false, state: 2 })),
			);
			service = new SiblingDisperseService(mockStore);

			const violations = service.findViolations(3);

			// Only note-1 has violations
			expect(violations).toHaveLength(1);
			expect(violations[0]?.sourceUid).toBe("note-1");
		});
	});

	describe("disperseAround", () => {
		function reviewCards(
			sourceUid: string,
			dates: string[],
			overrides: Partial<SchedulerCardData> = {},
		): SchedulerCardData[] {
			return createSiblingCards(sourceUid, dates).map((c) => ({
				...c,
				state: State.Review,
				stability: 10,
				lastReview: null,
				suspended: false,
				...overrides,
			}));
		}

		function serviceFor(cards: SchedulerCardData[]) {
			mockStore = createMockCardStore(cards);
			mockStore.getCards.mockReturnValue(cards);
			return new SiblingDisperseService(mockStore);
		}

		it("pushes siblings away from the reviewed card's new due, never earlier", () => {
			// Reviewed card lands on Feb 10; siblings on Feb 9 and Feb 11 are too close
			const siblings = reviewCards("note-1", ["2026-02-09", "2026-02-11"]);
			const result = serviceFor(siblings).disperseAround({
				cardId: "reviewed",
				sourceUid: "note-1",
				anchorDue: "2026-02-10T10:00:00.000Z",
				minInterval: 3,
			});

			const byId = new Map(result.changes.map((c) => [c.cardId, c]));
			expect(byId.get("sibling-note-1-0")?.newDue).toBe(
				"2026-02-13T10:00:00.000Z",
			);
			expect(byId.get("sibling-note-1-1")?.newDue).toBe(
				"2026-02-16T10:00:00.000Z",
			);
			for (const change of result.changes) {
				expect(change.daysChanged).toBeGreaterThan(0);
			}
		});

		it("leaves siblings that are already far enough apart", () => {
			const siblings = reviewCards("note-1", ["2026-02-20", "2026-02-25"]);
			const result = serviceFor(siblings).disperseAround({
				cardId: "reviewed",
				sourceUid: "note-1",
				anchorDue: "2026-02-10T10:00:00.000Z",
				minInterval: 3,
			});

			expect(result.affectedCount).toBe(0);
		});

		it.each([
			["due within a day", reviewCards("note-1", ["2026-02-02"])],
			[
				"learning",
				reviewCards("note-1", ["2026-02-11"], { state: State.Learning }),
			],
			["new", reviewCards("note-1", ["2026-02-11"], { state: State.New })],
			["suspended", reviewCards("note-1", ["2026-02-11"], { suspended: true })],
			["another note", reviewCards("note-2", ["2026-02-11"])],
		])("does not move a sibling that is %s", (_label, cards) => {
			const result = serviceFor(cards).disperseAround({
				cardId: "reviewed",
				sourceUid: "note-1",
				anchorDue: "2026-02-10T10:00:00.000Z",
				minInterval: 3,
			});

			expect(result.affectedCount).toBe(0);
		});

		it("reads only the note's cards when the store supports it", () => {
			const siblings = reviewCards("note-1", ["2026-02-11"]);
			const store = createMockCardStore(siblings);
			const getCardsBySourceUid = vi.fn(() => siblings);
			const service = new SiblingDisperseService({
				...store,
				getCardsBySourceUid,
			});

			const result = service.disperseAround({
				cardId: "reviewed",
				sourceUid: "note-1",
				anchorDue: "2026-02-10T10:00:00.000Z",
				minInterval: 3,
				dryRun: false,
			});

			expect(getCardsBySourceUid).toHaveBeenCalledWith("note-1");
			expect(store.getCards).not.toHaveBeenCalled();
			expect(result.affectedCount).toBe(1);
			expect(store.updateCardDue).toHaveBeenCalledWith(
				"sibling-note-1-0",
				"2026-02-13T10:00:00.000Z",
			);
		});
	});
});
