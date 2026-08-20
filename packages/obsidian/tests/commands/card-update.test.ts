import { describe, expect, it, vi } from "vitest";

import type { FSRSCardData } from "@true-recall/core/types";

import type { CommandContext } from "@true-recall/obsidian/commands/command.types";
import { DeleteCardCommand } from "@true-recall/obsidian/commands/commands/card-delete.cmd";
import {
	UpdateCardCommand,
	UpdateClozeTemplateCommand,
} from "@true-recall/obsidian/commands/commands/card-update.cmd";

const OLD_TEMPLATE = "The {{c1::sun}} is a {{c2::star}}";
const NEW_TEMPLATE = "The {{c1::sun}} is {{c2::hot}} and {{c3::bright}}";

function makeClozeCtx(siblingsByTemplate: Record<string, { id: string }[]>) {
	const cards = {
		softDeleteWithCascade: vi.fn(),
		restoreWithCascade: vi.fn(),
		updateClozeCardContent: vi.fn(),
	};
	const ctx = {
		flashcardManager: {
			updateClozeTemplate: vi.fn(),
			restoreClozeTemplate: vi.fn(),
		} as unknown as CommandContext["flashcardManager"],
		cardStore: {
			getClozeSiblings: vi.fn(
				(_uid: string, template: string) => siblingsByTemplate[template] ?? [],
			),
			cards,
		} as unknown as CommandContext["cardStore"],
		sessionPersistence: {} as unknown as CommandContext["sessionPersistence"],
	};
	return { ctx: ctx as CommandContext, cards };
}

describe("UpdateCardCommand", () => {
	it("restores content through the manager so subscribers are notified", () => {
		const updateCardContent = vi.fn();
		const ctx = {
			flashcardManager: { updateCardContent },
		} as unknown as CommandContext;
		const cmd = new UpdateCardCommand("card-1", "Old question", "Old answer");

		cmd.undo(ctx);

		expect(updateCardContent).toHaveBeenCalledWith(
			"card-1",
			"Old question",
			"Old answer",
			{ skipDuplicateCheck: true },
		);
	});
});

describe("UpdateClozeTemplateCommand", () => {
	it("snapshots the previous siblings and applies the new template", () => {
		const { ctx } = makeClozeCtx({
			[OLD_TEMPLATE]: [{ id: "a" }, { id: "b" }],
		});
		const cmd = new UpdateClozeTemplateCommand(
			"src-1",
			OLD_TEMPLATE,
			NEW_TEMPLATE,
			"Note",
		);

		cmd.execute(ctx);

		expect(ctx.cardStore.getClozeSiblings).toHaveBeenCalledWith(
			"src-1",
			OLD_TEMPLATE,
		);
		expect(ctx.flashcardManager.updateClozeTemplate).toHaveBeenCalledWith(
			"src-1",
			OLD_TEMPLATE,
			NEW_TEMPLATE,
			"Note",
		);
	});

	it("undo removes added cards, revives removed ones, and restores the template", () => {
		// The edit kept "a", soft-deleted "b" (index removed), created "c".
		const { ctx } = makeClozeCtx({
			[OLD_TEMPLATE]: [{ id: "a" }, { id: "b" }],
			[NEW_TEMPLATE]: [{ id: "a" }, { id: "c" }],
		});
		const cmd = new UpdateClozeTemplateCommand(
			"src-1",
			OLD_TEMPLATE,
			NEW_TEMPLATE,
		);

		cmd.execute(ctx);
		cmd.undo(ctx);

		expect(ctx.flashcardManager.restoreClozeTemplate).toHaveBeenCalledWith(
			"src-1",
			NEW_TEMPLATE,
			OLD_TEMPLATE,
			["a", "b"],
		);
	});

	it("undo of a pure text edit only restores the template", () => {
		const kept = [{ id: "a" }, { id: "b" }];
		const { ctx } = makeClozeCtx({
			[OLD_TEMPLATE]: kept,
			[NEW_TEMPLATE]: kept,
		});
		const cmd = new UpdateClozeTemplateCommand(
			"src-1",
			OLD_TEMPLATE,
			NEW_TEMPLATE,
		);

		cmd.execute(ctx);
		cmd.undo(ctx);

		expect(ctx.flashcardManager.restoreClozeTemplate).toHaveBeenCalledWith(
			"src-1",
			NEW_TEMPLATE,
			OLD_TEMPLATE,
			["a", "b"],
		);
	});
});

describe("DeleteCardCommand undo", () => {
	it("writes the snapshot back and clears the soft-delete tombstone", () => {
		const deleted = [{ id: "a" }, { id: "b" }] as FSRSCardData[];
		const set = vi.fn();
		const restoreWithCascade = vi.fn();
		const ctx = {
			flashcardManager: {
				removeFlashcardsByIdsWithDetails: vi.fn(() => ({
					affectedCount: deleted.length,
					deletedCardsData: deleted,
				})),
			} as unknown as CommandContext["flashcardManager"],
			cardStore: {
				set,
				cards: { restoreWithCascade },
			} as unknown as CommandContext["cardStore"],
			sessionPersistence: {} as unknown as CommandContext["sessionPersistence"],
		} as CommandContext;

		const cmd = new DeleteCardCommand(["a", "b"]);
		cmd.execute(ctx);
		cmd.undo(ctx);

		expect(set).toHaveBeenCalledTimes(2);
		expect(restoreWithCascade).toHaveBeenCalledWith("a");
		expect(restoreWithCascade).toHaveBeenCalledWith("b");
	});
});
