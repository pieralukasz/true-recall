import { State } from "ts-fsrs";
import { describe, expect, it, vi } from "vitest";

import type { FSRSCardData } from "@true-recall/core/types";

import type { CommandContext } from "@true-recall/obsidian/commands/command.types";
import {
	ReviewBuryCommand,
	ReviewForgetCommand,
	ReviewSuspendCommand,
} from "@true-recall/obsidian/commands/commands/review-actions.cmd";

import { createMockCard, createTestStore } from "../store/test-helpers";

vi.mock("@true-recall/obsidian/data", () => ({
	mutate: vi.fn(),
	mutateReviewGrade: vi.fn(),
}));

function makeCtx(overrides?: Partial<CommandContext>): CommandContext & {
	flashcardManager: { updateCardFSRS: ReturnType<typeof vi.fn> };
	cardStore: {
		get: ReturnType<typeof vi.fn>;
		cards: { bulkForget: ReturnType<typeof vi.fn> };
		stats: {
			getReviewedCardIds: ReturnType<typeof vi.fn>;
			recordReviewedCard: ReturnType<typeof vi.fn>;
		};
	};
	sessionPersistence: {
		getTodayKey: ReturnType<typeof vi.fn>;
		removeReviewedCards: ReturnType<typeof vi.fn>;
	};
} {
	const fsrsByCard = new Map<string, FSRSCardData>();

	return {
		flashcardManager: {
			updateCardFSRS: vi.fn((id: string, fsrs: FSRSCardData) => {
				fsrsByCard.set(id, fsrs);
				return true;
			}),
		} as unknown as CommandContext["flashcardManager"],
		cardStore: {
			get: vi.fn((id: string) => fsrsByCard.get(id)),
			cards: {
				bulkForget: vi.fn(),
			},
			stats: {
				getReviewedCardIds: vi.fn(() => []),
				recordReviewedCard: vi.fn(),
			},
		} as unknown as CommandContext["cardStore"],
		sessionPersistence: {
			getTodayKey: vi.fn(() => "2026-05-02"),
			removeReviewedCards: vi.fn(),
		} as unknown as CommandContext["sessionPersistence"],
		...overrides,
	} as ReturnType<typeof makeCtx>;
}

describe("ReviewSuspendCommand — undo restores all siblings", () => {
	it("restores badge count and queue when card has a sibling after current", () => {
		const store = createTestStore();
		const primary = createMockCard({ id: "primary" });
		const filler = createMockCard({ id: "filler" });
		const sibling = createMockCard({ id: "sibling" });
		store
			.getState()
			.review.startSession([primary, filler, sibling, createMockCard()]);

		const beforeBadge = store.getState().review.getBadgeCounts().new;
		const beforeQueueLen = store.getState().review.queue.length;

		const cmd = new ReviewSuspendCommand({
			card: { ...primary },
			originalFsrs: { ...primary.fsrs },
			previousIndex: 0,
			siblingIds: [primary.id, sibling.id],
			getReview: () => store.getState().review,
		});

		cmd.execute(makeCtx());

		// Both primary AND sibling removed — badge dropped by 2
		expect(store.getState().review.queue).toHaveLength(beforeQueueLen - 2);
		expect(store.getState().review.getBadgeCounts().new).toBe(beforeBadge - 2);

		cmd.undo(makeCtx());

		// Both restored — badge and queue back to original state
		expect(store.getState().review.queue).toHaveLength(beforeQueueLen);
		expect(store.getState().review.getBadgeCounts().new).toBe(beforeBadge);
		expect(store.getState().review.queue[0]?.id).toBe(primary.id);
		expect(store.getState().review.queue[2]?.id).toBe(sibling.id);
	});

	it("preserves currentIndex when sibling is before current card", () => {
		const store = createTestStore();
		const filler = createMockCard({ id: "filler-0" });
		const sibling = createMockCard({ id: "sibling-before" });
		const filler2 = createMockCard({ id: "filler-2" });
		const primary = createMockCard({ id: "primary" });
		store.getState().review.startSession([filler, sibling, filler2, primary]);
		store.getState().review.nextCard();
		store.getState().review.nextCard();
		store.getState().review.nextCard();
		expect(store.getState().review.currentIndex).toBe(3);
		expect(store.getState().review.getCurrentCard()?.id).toBe(primary.id);

		const cmd = new ReviewSuspendCommand({
			card: { ...primary },
			originalFsrs: { ...primary.fsrs },
			previousIndex: 3,
			siblingIds: [primary.id, sibling.id],
			getReview: () => store.getState().review,
		});

		cmd.execute(makeCtx());
		cmd.undo(makeCtx());

		expect(store.getState().review.queue).toHaveLength(4);
		expect(store.getState().review.currentIndex).toBe(3);
		expect(store.getState().review.getCurrentCard()?.id).toBe(primary.id);
		expect(store.getState().review.queue[1]?.id).toBe(sibling.id);
	});

	it("ignores sibling ids that are not in the queue", () => {
		const store = createTestStore();
		const primary = createMockCard({ id: "primary" });
		store.getState().review.startSession([primary, createMockCard()]);

		const cmd = new ReviewSuspendCommand({
			card: { ...primary },
			originalFsrs: { ...primary.fsrs },
			previousIndex: 0,
			siblingIds: [primary.id, "missing-sibling"],
			getReview: () => store.getState().review,
		});

		cmd.execute(makeCtx());
		expect(store.getState().review.queue).toHaveLength(1);

		cmd.undo(makeCtx());
		expect(store.getState().review.queue).toHaveLength(2);
		expect(store.getState().review.queue[0]?.id).toBe(primary.id);
	});
});

describe("ReviewBuryCommand — undo restores all siblings", () => {
	it("restores both primary and sibling to queue", () => {
		const store = createTestStore();
		const primary = createMockCard({ id: "primary" });
		const sibling = createMockCard({ id: "sibling" });
		store.getState().review.startSession([primary, sibling]);

		const cmd = new ReviewBuryCommand(
			{
				card: { ...primary },
				originalFsrs: { ...primary.fsrs },
				previousIndex: 0,
				siblingIds: [primary.id, sibling.id],
				getReview: () => store.getState().review,
			},
			"2026-05-03T04:00:00Z",
		);

		cmd.execute(makeCtx());
		expect(store.getState().review.queue).toHaveLength(0);
		expect(store.getState().review.getBadgeCounts().new).toBe(0);

		cmd.undo(makeCtx());
		expect(store.getState().review.queue).toHaveLength(2);
		expect(store.getState().review.queue[0]?.id).toBe(primary.id);
		expect(store.getState().review.queue[1]?.id).toBe(sibling.id);
		expect(store.getState().review.getBadgeCounts().new).toBe(2);
	});
});

describe("doWrite uses skipNotification: true", () => {
	// Lock in the contract: every command-driven FSRS write MUST use
	// skipNotification, otherwise card:updated fires through the bus and
	// ReviewView's signal effect runs rebuildActiveSession against stale
	// Q.ALL_META — clobbering the queue this command just managed manually.

	it("ReviewSuspendCommand.doWrite skipNotification on every sibling", async () => {
		const store = createTestStore();
		const primary = createMockCard({ id: "primary" });
		const sibling = createMockCard({ id: "sibling" });
		store.getState().review.startSession([primary, sibling]);

		const ctx = makeCtx();
		// Seed cardStore.get so doWrite finds the rows it expects.
		(ctx.cardStore.get as ReturnType<typeof vi.fn>).mockImplementation(
			(id: string) =>
				id === primary.id
					? primary.fsrs
					: id === sibling.id
						? sibling.fsrs
						: undefined,
		);

		const cmd = new ReviewSuspendCommand({
			card: { ...primary },
			originalFsrs: { ...primary.fsrs },
			previousIndex: 0,
			siblingIds: [primary.id, sibling.id],
			getReview: () => store.getState().review,
		});

		cmd.execute(ctx);
		await new Promise((r) => setTimeout(r, 5));

		const calls = (
			ctx.flashcardManager.updateCardFSRS as ReturnType<typeof vi.fn>
		).mock.calls;
		expect(calls.length).toBe(2);
		for (const call of calls) {
			expect(call[3]).toEqual({ skipNotification: true });
		}
	});

	it("ReviewBuryCommand.doWrite skipNotification on every sibling", async () => {
		const store = createTestStore();
		const primary = createMockCard({ id: "primary" });
		const sibling = createMockCard({ id: "sibling" });
		store.getState().review.startSession([primary, sibling]);

		const ctx = makeCtx();
		(ctx.cardStore.get as ReturnType<typeof vi.fn>).mockImplementation(
			(id: string) =>
				id === primary.id
					? primary.fsrs
					: id === sibling.id
						? sibling.fsrs
						: undefined,
		);

		const cmd = new ReviewBuryCommand(
			{
				card: { ...primary },
				originalFsrs: { ...primary.fsrs },
				previousIndex: 0,
				siblingIds: [primary.id, sibling.id],
				getReview: () => store.getState().review,
			},
			"2026-05-03T04:00:00Z",
		);

		cmd.execute(ctx);
		await new Promise((r) => setTimeout(r, 5));

		const calls = (
			ctx.flashcardManager.updateCardFSRS as ReturnType<typeof vi.fn>
		).mock.calls;
		expect(calls.length).toBe(2);
		for (const call of calls) {
			expect(call[3]).toEqual({ skipNotification: true });
		}
	});
});

describe("ReviewForgetCommand — undo restores all siblings + daily stats", () => {
	it("re-records daily_reviewed_cards only for ids that were marked reviewed", async () => {
		const store = createTestStore();
		// Forget acts on non-New cards only, so use Review state
		const primary = createMockCard({
			id: "primary",
			fsrs: {
				due: new Date().toISOString(),
				stability: 1,
				difficulty: 5,
				elapsedDays: 0,
				scheduledDays: 1,
				reps: 1,
				lapses: 0,
				state: State.Review,
				lastReview: new Date().toISOString(),
				suspended: false,
				buriedUntil: null,
			},
		});
		const sibling = createMockCard({
			id: "sibling",
			fsrs: {
				...primary.fsrs,
			},
		});
		store.getState().review.startSession([primary, sibling]);

		const ctx = makeCtx();
		// Pretend only primary has been reviewed today; sibling has not.
		(
			ctx.cardStore.stats.getReviewedCardIds as ReturnType<typeof vi.fn>
		).mockReturnValue([primary.id]);

		const cmd = new ReviewForgetCommand({
			card: { ...primary },
			originalFsrs: { ...primary.fsrs },
			previousIndex: 0,
			siblingIds: [primary.id, sibling.id],
			getReview: () => store.getState().review,
		});

		cmd.execute(ctx);
		// Wait for deferred doWrite
		await new Promise((r) => setTimeout(r, 5));

		expect(ctx.cardStore.cards.bulkForget).toHaveBeenCalledWith([
			primary.id,
			sibling.id,
		]);
		expect(ctx.sessionPersistence.removeReviewedCards).toHaveBeenCalledWith([
			primary.id,
			sibling.id,
		]);

		cmd.undo(ctx);

		// Queue restored for both
		expect(store.getState().review.queue).toHaveLength(2);

		// Daily reviewed entry restored ONLY for primary, not for sibling
		const recordCalls = (
			ctx.cardStore.stats.recordReviewedCard as ReturnType<typeof vi.fn>
		).mock.calls;
		const recordedIds = recordCalls.map((c) => c[1]);
		expect(recordedIds).toContain(primary.id);
		expect(recordedIds).not.toContain(sibling.id);
	});
});

describe("undo restores siblings that were NOT in the queue", () => {
	// doWrite touches every id in siblingIds, including siblings that are
	// not currently queued (e.g. cloze siblings not due today) — undo must
	// restore those from their pre-write DB state, not leave them suspended.
	it("ReviewSuspendCommand.undo restores an out-of-queue sibling", async () => {
		const store = createTestStore();
		const primary = createMockCard({ id: "primary" });
		const offQueueSibling = createMockCard({ id: "off-queue" });
		// Session contains ONLY the primary card.
		store.getState().review.startSession([primary]);

		const ctx = makeCtx();
		const originalSiblingFsrs = { ...offQueueSibling.fsrs, suspended: false };
		(ctx.cardStore.get as ReturnType<typeof vi.fn>).mockImplementation(
			(id: string) =>
				id === primary.id
					? primary.fsrs
					: id === offQueueSibling.id
						? originalSiblingFsrs
						: undefined,
		);

		const cmd = new ReviewSuspendCommand({
			card: { ...primary },
			originalFsrs: { ...primary.fsrs },
			previousIndex: 0,
			siblingIds: [primary.id, offQueueSibling.id],
			getReview: () => store.getState().review,
		});

		cmd.execute(ctx);
		await new Promise((r) => setTimeout(r, 5));

		cmd.undo(ctx);

		const undoCalls = (
			ctx.flashcardManager.updateCardFSRS as ReturnType<typeof vi.fn>
		).mock.calls.slice(2); // first two calls are doWrite's
		const restoredIds = undoCalls.map((c) => c[0] as string);
		expect(restoredIds).toContain(primary.id);
		expect(restoredIds).toContain(offQueueSibling.id);

		const siblingRestore = undoCalls.find(
			(c) => c[0] === offQueueSibling.id,
		);
		expect(siblingRestore?.[1]).toEqual(originalSiblingFsrs);
	});
});
