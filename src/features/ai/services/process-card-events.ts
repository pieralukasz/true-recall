import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import type { TFile } from "obsidian";
import type { IncrementalFlashcardParser } from "./incremental-flashcard-parser";
import { addStreamedCard } from "./streaming-state";

type ParserEvents = ReturnType<IncrementalFlashcardParser["feed"]>;

export async function processCardEvents(
	events: ParserEvents,
	sourceFile: TFile,
	flashcardManager: FlashcardManager,
	onPartial: (q: string | null, a: string | null) => void,
	onCount: (created: number, dups: number) => void,
): Promise<void> {
	const frontmatterService = flashcardManager.getFrontmatterService();
	let sourceUid = await frontmatterService.getSourceNoteUid(sourceFile);
	if (!sourceUid) {
		sourceUid = frontmatterService.generateUid();
		await frontmatterService.setSourceNoteUid(sourceFile, sourceUid);
	}

	for (const event of events) {
		if (event.type === "card_complete" && event.block) {
			try {
				const result = flashcardManager.createNote({
					noteTypeId: event.block.noteTypeId,
					fields: event.block.fields,
					alwaysTypeIn: event.block.alwaysTypeIn,
					sourceUid,
					sourceText: event.block.sourceText,
					createdVia: "ai",
				});

				if (result.cards.length > 0) {
					onCount(result.cards.length, 0);
					for (const card of result.cards) {
						addStreamedCard({
							id: card.id,
							question: card.question,
							answer: card.answer,
							cardType: card.cardType,
							clozeTemplate: card.clozeTemplate,
							clozeIndex: card.clozeIndex,
							sourceText: card.sourceText,
						});
					}
					await new Promise<void>((r) => requestAnimationFrame(() => r()));
				} else {
					onCount(0, 1);
				}
			} catch {
				onCount(0, 1);
			}
		} else if (event.type === "partial_update") {
			onPartial(event.partialQuestion ?? null, event.partialAnswer ?? null);
		}
	}
}
