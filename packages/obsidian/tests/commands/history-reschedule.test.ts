import { State } from "ts-fsrs";
import { describe, expect, it, vi } from "vitest";

import type { FSRSCardData } from "@true-recall/core/types";

import type { CommandContext } from "@true-recall/obsidian/commands/command.types";
import { HistoryRescheduleCommand } from "@true-recall/obsidian/commands/commands/history-reschedule.cmd";

function card(overrides: Partial<FSRSCardData> = {}): FSRSCardData {
	return {
		id: "c1",
		due: "2026-10-05T08:00:00.000Z",
		stability: 5,
		difficulty: 9.8,
		reps: 6,
		lapses: 0,
		state: State.Review,
		lastReview: "2026-09-28T08:00:00.000Z",
		scheduledDays: 7,
		learningStep: 0,
		...overrides,
	};
}

function makeCtx(rows: Map<string, FSRSCardData>) {
	const applyReplayedScheduling = vi.fn((id: string, data: FSRSCardData) => {
		rows.set(id, data);
	});
	const ctx = {
		flashcardManager: {},
		sessionPersistence: {},
		cardStore: {
			transaction: <T>(fn: () => T) => fn(),
			cards: { get: (id: string) => rows.get(id), applyReplayedScheduling },
		},
	} as unknown as CommandContext;
	return { ctx, applyReplayedScheduling };
}

describe("HistoryRescheduleCommand", () => {
	const before = card();
	const after = card({
		due: "2027-02-01T08:00:00.000Z",
		stability: 120,
		difficulty: 4,
		scheduledDays: 126,
	});

	it("restores the full previous memory state on undo", () => {
		const rows = new Map([["c1", { ...after }]]);
		const { ctx } = makeCtx(rows);
		new HistoryRescheduleCommand("x", [{ cardId: "c1", before, after }]).undo(
			ctx,
		);
		expect(rows.get("c1")).toEqual(before);
	});

	it("leaves a card answered after the reschedule alone", () => {
		const answered = { ...after, lastReview: "2026-10-02T08:00:00.000Z" };
		const rows = new Map([["c1", answered]]);
		const { ctx, applyReplayedScheduling } = makeCtx(rows);
		new HistoryRescheduleCommand("x", [{ cardId: "c1", before, after }]).undo(
			ctx,
		);
		expect(applyReplayedScheduling).not.toHaveBeenCalled();
		expect(rows.get("c1")).toBe(answered);
	});

	it("execute is a no-op (the service already wrote)", () => {
		const rows = new Map([["c1", { ...after }]]);
		const { ctx, applyReplayedScheduling } = makeCtx(rows);
		new HistoryRescheduleCommand("x", [
			{ cardId: "c1", before, after },
		]).execute(ctx);
		expect(applyReplayedScheduling).not.toHaveBeenCalled();
	});
});
