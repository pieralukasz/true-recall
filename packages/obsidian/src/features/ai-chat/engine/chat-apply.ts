import type { NoteType } from "@true-recall/core/types";
import { BUILTIN_BASIC_ID } from "@true-recall/core/types/note.types";

import { BatchCreateCommand } from "../../../commands/commands/card-create.cmd";
import { UpdateNoteFieldsCommand } from "../../../commands/commands/card-update.cmd";
import type TrueRecallPlugin from "../../../main";
import { mergeFields, type ProposedCard } from "./proposals";

/** Same event the review view listens to, so an open card re-renders. */
const CARD_UPDATED_EVENT = "true-recall:assistant-card-updated";

function emitCardUpdated(cardId: string): void {
	activeWindow.dispatchEvent(
		new CustomEvent(CARD_UPDATED_EVENT, { detail: { cardId } }),
	);
}

async function sourceUidFor(
	plugin: TrueRecallPlugin,
	notePath: string | undefined,
): Promise<string | undefined> {
	if (!notePath) return undefined;
	const fm = plugin.flashcardManager.getFrontmatterService();
	const existing = await fm.getSourceNoteUid(notePath);
	if (existing) return existing;
	if (!plugin.app.vault.getAbstractFileByPath(notePath)) return undefined;
	const uid = fm.generateUid();
	await fm.setSourceNoteUid(notePath, uid);
	return uid;
}

/** Question/answer to note fields: the first two fields of the note type. */
export function toNoteFields(
	card: ProposedCard,
	noteType: Pick<NoteType, "fields"> | null | undefined,
): Record<string, string> {
	const [first = "Front", second = "Back"] = noteType?.fields ?? [];
	return { [first]: card.question, [second]: card.answer };
}

/** Writes the picked cards. Duplicates of existing questions are skipped. */
export async function addProposedCards(
	plugin: TrueRecallPlugin,
	cards: readonly ProposedCard[],
	options: { notePath?: string; sourceText?: string },
): Promise<string[]> {
	if (cards.length === 0) return [];
	const noteType = plugin.cardStore?.noteTypes.getById(BUILTIN_BASIC_ID);
	const sourceUid = await sourceUidFor(plugin, options.notePath);
	const { cards: created } = plugin.flashcardManager.createNoteBatch(
		cards.map((card) => ({
			noteTypeId: BUILTIN_BASIC_ID,
			fields: toNoteFields(card, noteType),
			sourceUid,
			sourceText: options.sourceText,
			createdVia: "ai",
			skipDuplicates: true,
		})),
	);
	const ids = created.map((c) => c.id);
	if (ids.length > 0) {
		void plugin.commandService?.execute(new BatchCreateCommand(ids));
	}
	return ids;
}

/** Removes cards the chat added (the "Undo" in the proposal). */
export function removeAddedCards(
	plugin: TrueRecallPlugin,
	cardIds: readonly string[],
): number {
	return plugin.flashcardManager.removeFlashcardsByIds([...cardIds]);
}

export type ApplyEditResult =
	| {
			ok: true;
			noteId: string;
			before: Record<string, string>;
			after: Record<string, string>;
	  }
	| { ok: false; error: "missing" | "changed" };

/**
 * Applies an edit. `expected` is the card as the model saw it: when the user
 * changed the card since, applying would overwrite their edit, so it fails.
 */
export function applyCardEdit(
	plugin: TrueRecallPlugin,
	cardId: string,
	changes: Readonly<Record<string, string>>,
	expected: Readonly<Record<string, string>>,
): ApplyEditResult {
	const store = plugin.cardStore;
	const card = store?.cards.get(cardId);
	const note = card?.noteId ? store?.notes.getById(card.noteId) : null;
	if (!store || !card?.noteId || !note) return { ok: false, error: "missing" };
	const current = { ...(note.fields ?? {}) };
	for (const [name, value] of Object.entries(expected)) {
		if ((current[name] ?? "") !== value) return { ok: false, error: "changed" };
	}
	const after = mergeFields(current, changes);
	plugin.flashcardManager.updateNoteFields(card.noteId, after, "ai");
	void plugin.commandService?.execute(
		new UpdateNoteFieldsCommand(card.noteId, current, after, "AI chat edit"),
	);
	emitCardUpdated(cardId);
	return { ok: true, noteId: card.noteId, before: current, after };
}

/** Puts the fields back as they were before "Apply". */
export function revertCardEdit(
	plugin: TrueRecallPlugin,
	cardId: string,
	noteId: string,
	before: Readonly<Record<string, string>>,
): boolean {
	const note = plugin.cardStore?.notes.getById(noteId);
	if (!note) return false;
	const current = { ...(note.fields ?? {}) };
	plugin.flashcardManager.updateNoteFields(noteId, { ...before }, "ai");
	void plugin.commandService?.execute(
		new UpdateNoteFieldsCommand(
			noteId,
			current,
			{ ...before },
			"Undo AI chat edit",
		),
	);
	emitCardUpdated(cardId);
	return true;
}
