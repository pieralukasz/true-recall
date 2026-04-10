import type { App, TFile } from "obsidian";

import { resolveSlug } from "@true-recall/core/flashcard/note-types/note-type-slug";
import {
	blockToText,
	type ParsedBlock,
} from "@true-recall/core/flashcard/parsing/block-parser.service";
import type { FlashcardInfo, FlashcardItem } from "@true-recall/core/types";

import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { notify } from "@true-recall/obsidian/services/notification.service";

interface DuplicateErrorLike {
	existingSourceUid?: string;
}

export async function getSourceNoteNameFromFile(
	app: App,
	currentFile: TFile | null,
	flashcardInfo: FlashcardInfo | null,
): Promise<string | undefined> {
	if (!currentFile || !flashcardInfo) return undefined;
	try {
		const content = await app.vault.read(currentFile);
		const match = content.match(/source_link:\s*"\[\[(.+?)\]\]"/);
		return match?.[1];
	} catch (error) {
		console.error("[panel-helpers] Failed to read source note:", error);
		return undefined;
	}
}

export function notifyDuplicateError(
	plugin: TrueRecallPlugin,
	error: DuplicateErrorLike,
	question: string,
): void {
	const sourceNoteService = plugin.flashcardManager.getSourceNoteService();
	const sourceInfo = error.existingSourceUid
		? sourceNoteService.resolveSourceNote(error.existingSourceUid)
		: {};
	notify().duplicateFound(question, sourceInfo.noteName);
}

export function cardToBlockText(
	card: FlashcardItem,
	plugin: TrueRecallPlugin,
): string {
	if (!card.noteId) {
		return `Q: ${card.question}\nA: ${card.answer}`;
	}

	const note = plugin.cardStore.notes.getById(card.noteId);
	if (!note) {
		return `Q: ${card.question}\nA: ${card.answer}`;
	}

	const noteType = plugin.cardStore.noteTypes.getById(note.noteTypeId);
	if (!noteType) {
		return `Q: ${card.question}\nA: ${card.answer}`;
	}

	const block: ParsedBlock = {
		noteTypeId: note.noteTypeId,
		noteTypeSlug: resolveSlug(noteType),
		fields: note.fields,
		sourceText: note.sourceText,
		alwaysTypeIn: card.alwaysTypeIn,
	};

	return blockToText(block, noteType.fields);
}

export function cardsToBlockText(
	cards: FlashcardItem[],
	plugin: TrueRecallPlugin,
): string {
	return cards.map((card) => cardToBlockText(card, plugin)).join("\n\n---\n");
}
