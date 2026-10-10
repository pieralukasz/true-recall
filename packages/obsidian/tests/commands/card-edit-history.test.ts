import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CardRepository } from "../../../core/src/flashcard/data/card-repository.service";
import type { SqliteStoreService } from "../../../core/src/persistence/sqlite/SqliteStoreService";
import type { NoteEditSource } from "../../../core/src/types/note.types";
import {
	createTestCard,
	createTestContext,
	type TestContext,
} from "../../../core/tests/persistence/sqlite/__setup__/test-database";
import type { CommandContext } from "../../src/commands/command.types";
import { UpdateClozeTemplateCommand } from "../../src/commands/commands/card-update.cmd";
import {
	applyCardEdit,
	revertCardEdit,
} from "../../src/features/ai-chat/engine/chat-apply";
import type TrueRecallPlugin from "../../src/main";

const old = "{{c1::Paris}} in {{c2::France}}",
	next = "{{c1::Berlin}} in {{c2::Germany}}";
describe("edit history attribution through command/apply paths", () => {
	let ctx: TestContext,
		repository: CardRepository,
		commandContext: CommandContext;
	beforeEach(async () => {
		vi.stubGlobal("activeWindow", new EventTarget());
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-10-10T10:00:00Z"));
		ctx = await createTestContext();
		ctx.notes.create({
			id: "note",
			noteTypeId: "builtin-cloze",
			fields: { Text: old, Extra: "" },
			tags: [],
			sourceUid: "source",
		});
		for (const index of [1, 2])
			ctx.cards.set(`card-${index}`, {
				...createTestCard({ id: `card-${index}`, sourceUid: "source" }),
				noteId: "note",
				cardType: "cloze",
				clozeIndex: index,
			});
		const store = {
			cards: ctx.cards,
			get: ctx.cards.get.bind(ctx.cards),
			set: ctx.cards.set.bind(ctx.cards),
			getClozeSiblings: ctx.cards.getClozeSiblings.bind(ctx.cards),
		} as unknown as SqliteStoreService;
		repository = new CardRepository(store);
		repository.setEventBus({ emit: vi.fn(), on: vi.fn() } as never);
		commandContext = {
			cardStore: store,
			flashcardManager: {
				updateClozeTemplate: repository.updateClozeTemplate.bind(repository),
				restoreClozeTemplate: repository.restoreClozeTemplate.bind(repository),
			},
		} as unknown as CommandContext;
	});
	afterEach(() => {
		ctx.close();
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});
	it("attributes cloze undo and redo to system, without another author counter", () => {
		const command = new UpdateClozeTemplateCommand("source", old, next);
		command.execute(commandContext);
		command.undo(commandContext);
		command.execute(commandContext);
		expect(
			ctx.db.query("SELECT source FROM card_edit_history ORDER BY sequence"),
		).toEqual([
			{ source: "manual" },
			{ source: "system" },
			{ source: "system" },
		]);
		expect(ctx.notes.getById("note")?.editCount).toBe(1);
	});
	it("records a cloze edit even when every old index is replaced", () => {
		const replacement = "{{c3::Berlin}} in {{c4::Germany}}";
		repository.updateClozeTemplate("source", old, replacement);
		expect(ctx.notes.getById("note")?.fields.Text).toBe(replacement);
		expect(ctx.db.query("SELECT source FROM card_edit_history")).toEqual([
			{ source: "manual" },
		]);
	});
	it("attributes AI Apply to ai and proposal Undo to system", () => {
		const plugin = {
			cardStore: ctx,
			flashcardManager: {
				updateNoteFields: (
					id: string,
					fields: Record<string, string>,
					source: NoteEditSource,
				) => ctx.notes.update(id, { fields }, source),
			},
		} as unknown as TrueRecallPlugin;
		const result = applyCardEdit(
			plugin,
			"card-1",
			{ Text: next },
			{ Text: old },
		);
		if (!result.ok) throw new Error("Apply failed");
		expect(
			revertCardEdit(
				plugin,
				"card-1",
				result.noteId,
				result.before,
				result.after,
			),
		).toEqual({ ok: true });
		expect(
			ctx.db.query("SELECT source FROM card_edit_history ORDER BY sequence"),
		).toEqual([{ source: "ai" }, { source: "system" }]);
		expect(ctx.notes.getById("note")).toMatchObject({
			editCount: 0,
			aiEditCount: 1,
		});
	});
});
