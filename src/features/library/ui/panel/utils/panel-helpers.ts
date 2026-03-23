import {
	blockToText,
	type ParsedBlock,
} from "@features/study/services/flashcard/block-parser.service";
import { resolveSlug } from "@features/study/services/flashcard/note-type-slug";
import { notify } from "@shared/services/notification.service";
import type { FlashcardInfo, FlashcardItem } from "@shared/types";
import type { App, TFile } from "obsidian";
import type TrueRecallPlugin from "../../../../../main";

interface DuplicateEntry {
	flashcard: { question: string };
	existingSourceUid?: string;
}

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

export function showDuplicateNotifications(
	plugin: TrueRecallPlugin,
	duplicates: DuplicateEntry[],
): void {
	const sourceNoteService = plugin.flashcardManager.getSourceNoteService();
	for (const dup of duplicates) {
		const sourceInfo = dup.existingSourceUid
			? sourceNoteService.resolveSourceNote(dup.existingSourceUid)
			: {};
		notify().duplicateFound(dup.flashcard.question, sourceInfo.noteName);
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
