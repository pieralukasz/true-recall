import { State } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionFilters } from "@true-recall/obsidian/features/study/ui/review/review.types";

import { ReviewSessionOrchestrator } from "../../../src/views/review/ReviewSessionOrchestrator";
import { createMockCard, createTestStore } from "../../store/test-helpers";

function createOrchestrator() {
	const store = createTestStore();
	let filters: SessionFilters = { schedulingMode: "retrievability" };
	const topUpCard = createMockCard({ id: "top-up" });
	const buildSession = vi.fn(() => ({ queue: [topUpCard] }));
	const buildTopUpSession = vi.fn(() => ({ queue: [topUpCard] }));
	const clearByType = vi.fn();
	const flush = vi.fn().mockResolvedValue(undefined);
	const onCardChanged = vi.fn();
	const onSessionStarted = vi.fn();
	const orchestrator = new ReviewSessionOrchestrator({
		plugin: {
			settings: {},
			cardStore: { getAllSchedulingMeta: () => [], flush },
		} as never,
		controller: {
			buildSession,
			buildTopUpSession,
			getTopUpAvailability: () => ({ new: 2, review: 3 }),
		} as never,
		fsrsService: { updateSettings: vi.fn() } as never,
		commandService: { clearByType } as never,
		getReview: () => store.getState().review,
		getFilters: () => filters,
		setFilters: (next) => {
			filters = next;
		},
		cachePresets: vi.fn(),
		onCardChanged,
		onSessionStarted,
	});
	return {
		orchestrator,
		store,
		buildSession,
		buildTopUpSession,
		clearByType,
		flush,
		onCardChanged,
		onSessionStarted,
		topUpCard,
	};
}
describe("ReviewSessionOrchestrator", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-14T10:00:00Z"));
	});
	afterEach(() => vi.useRealTimers());
	it("starts the prepared queue with its session filters and callbacks", () => {
		const f = createOrchestrator();
		const prepared = f.orchestrator.prepare();
		f.orchestrator.start(prepared.queue);
		expect(f.store.getState().review.getCurrentCard()?.id).toBe("top-up");
		expect(f.store.getState().review.getSessionFilters().schedulingMode).toBe(
			"retrievability",
		);
		expect(f.onSessionStarted).toHaveBeenCalledOnce();
		expect(f.onCardChanged).toHaveBeenCalledOnce();
	});
	it("adds top-up cards while preserving pending learning cards", async () => {
		const f = createOrchestrator();
		const waiting = createMockCard({ id: "learning" });
		waiting.fsrs.state = State.Learning;
		waiting.fsrs.due = new Date(Date.now() + 60000).toISOString();
		f.store.getState().review.startSession([waiting]);
		expect(f.store.getState().review.getPhase().type).toBe("waiting");
		await expect(
			f.orchestrator.handleTopUp({ kind: "new", count: 2.8 }),
		).resolves.toBe(true);
		expect(f.buildTopUpSession).toHaveBeenCalledWith(expect.anything(), {
			kind: "new",
			count: 2,
		});
		expect(f.store.getState().review.queue.map((card) => card.id)).toEqual([
			"top-up",
			"learning",
		]);
		expect(f.clearByType).toHaveBeenCalledOnce();
		expect(f.onCardChanged).toHaveBeenCalledOnce();
	});
	it.each([
		0,
		-1,
		Number.NaN,
		Number.POSITIVE_INFINITY,
	])("does not build a top-up for invalid count %s", async (count) => {
		const f = createOrchestrator();
		await expect(
			f.orchestrator.handleTopUp({ kind: "new", count }),
		).resolves.toBe(false);
		expect(f.buildTopUpSession).not.toHaveBeenCalled();
	});
	it("flushes the card store and clears session commands on finish", async () => {
		const f = createOrchestrator();
		await f.orchestrator.finish();
		expect(f.flush).toHaveBeenCalledOnce();
		expect(f.clearByType).toHaveBeenCalledWith(
			"review:answer",
			"review:bury",
			"review:suspend",
			"review:forget",
		);
	});
});
