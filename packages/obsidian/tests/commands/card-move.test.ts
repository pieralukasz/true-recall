import { describe, expect, it, vi } from "vitest";

import type { CommandContext } from "@true-recall/obsidian/commands/command.types";
import {
	MoveCardCommand,
	MoveCardsCommand,
} from "@true-recall/obsidian/commands/commands/card-move.cmd";

function makeCtx(
	sourceUids: Record<string, string | undefined>,
	moveResult: (cardId: string) => boolean = () => true,
) {
	const moveCard = vi.fn(async (cardId: string) => moveResult(cardId));
	const updateCardSourceUid = vi.fn();
	const ctx = {
		flashcardManager: { moveCard },
		cardStore: {
			get: vi.fn((id: string) =>
				id in sourceUids ? { id, sourceUid: sourceUids[id] } : undefined,
			),
			cards: { updateCardSourceUid },
		},
		sessionPersistence: {},
	} as unknown as CommandContext;
	return { ctx, moveCard, updateCardSourceUid };
}

describe("MoveCardCommand", () => {
	it("reports whether the manager moved the card", async () => {
		const { ctx } = makeCtx({ a: "uid-a" }, () => false);
		const cmd = new MoveCardCommand("a", "Target.md");

		await cmd.execute(ctx);

		expect(cmd.moved).toBe(false);
	});

	it("restores the original source on undo", async () => {
		const { ctx, updateCardSourceUid } = makeCtx({ a: "uid-a" });
		const cmd = new MoveCardCommand("a", "Target.md");

		await cmd.execute(ctx);
		cmd.undo(ctx);

		expect(cmd.moved).toBe(true);
		expect(updateCardSourceUid).toHaveBeenCalledWith("a", "uid-a");
	});
});

describe("MoveCardsCommand", () => {
	it("moves every card and counts only successful moves", async () => {
		const { ctx, moveCard } = makeCtx(
			{ a: "uid-a", b: "uid-b", c: "uid-c" },
			(id) => id !== "b",
		);
		const cmd = new MoveCardsCommand(["a", "b", "c"], "Target.md");

		await cmd.execute(ctx);

		expect(moveCard).toHaveBeenCalledTimes(3);
		expect(moveCard).toHaveBeenCalledWith("a", "Target.md");
		expect(cmd.movedCount).toBe(2);
		expect(cmd.description).toBe("Move 3 cards");
	});

	it("undoes all moved cards in one step, skipping failed ones", async () => {
		const { ctx, updateCardSourceUid } = makeCtx(
			{ a: "uid-a", b: "uid-b", c: undefined },
			(id) => id !== "b",
		);
		const cmd = new MoveCardsCommand(["a", "b", "c"], "Target.md");

		await cmd.execute(ctx);
		cmd.undo(ctx);

		expect(updateCardSourceUid).toHaveBeenCalledTimes(1);
		expect(updateCardSourceUid).toHaveBeenCalledWith("a", "uid-a");
	});

	it("records fresh originals when redone", async () => {
		const sources: Record<string, string> = { a: "uid-a" };
		const { ctx, updateCardSourceUid } = makeCtx(sources);
		const cmd = new MoveCardsCommand(["a"], "Target.md");

		await cmd.execute(ctx);
		sources.a = "uid-other";
		await cmd.execute(ctx);
		cmd.undo(ctx);

		expect(cmd.movedCount).toBe(1);
		expect(updateCardSourceUid).toHaveBeenLastCalledWith("a", "uid-other");
	});
});
