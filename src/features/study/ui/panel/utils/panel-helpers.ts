import type TrueRecallPlugin from "../../../../../main";
import { notify } from "@shared/services/notification.service";
import type { FlashcardInfo } from "@shared/types";

export async function getSourceNoteNameFromFile(
	app: { vault: { read: (file: any) => Promise<string> } },
	currentFile: any,
	flashcardInfo: FlashcardInfo | null,
): Promise<string | undefined> {
	if (!currentFile || !flashcardInfo) return undefined;
	try {
		const content = await app.vault.read(currentFile);
		const match = content.match(/source_link:\s*"\[\[(.+?)\]\]"/);
		return match?.[1];
	} catch {
		return undefined;
	}
}

export function showDuplicateNotifications(
	plugin: TrueRecallPlugin,
	duplicates: any[],
): void {
	const sourceNoteService = plugin.flashcardManager.getSourceNoteService();
	for (const dup of duplicates) {
		const sourceInfo = dup.existingSourceUid
			? sourceNoteService.resolveSourceNote(dup.existingSourceUid)
			: {};
		notify().duplicateFound(
			dup.flashcard.question,
			(sourceInfo as any).noteName,
		);
	}
}

export function notifyDuplicateError(
	plugin: TrueRecallPlugin,
	error: any,
	question: string,
): void {
	const sourceNoteService = plugin.flashcardManager.getSourceNoteService();
	const sourceInfo = error.existingSourceUid
		? sourceNoteService.resolveSourceNote(error.existingSourceUid)
		: {};
	notify().duplicateFound(question, (sourceInfo as any).noteName);
}
