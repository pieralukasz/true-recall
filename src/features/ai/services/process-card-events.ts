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
	for (const event of events) {
		if (event.type === "card_complete" && event.block) {
			try {
				const sourceUid = await flashcardManager
					.getFrontmatterService()
					.getSourceNoteUid(sourceFile);

				const result = flashcardManager.createNote({
					noteTypeId: event.block.noteTypeId,
					fields: event.block.fields,
					alwaysTypeIn: event.block.alwaysTypeIn,
					sourceUid: sourceUid ?? undefined,
					sourceText: event.block.sourceText,
					createdVia: "ai",
				});

				if (result.cards.length > 0) {
					onCount(result.cards.length, 0);
					const firstField =
						Object.values(event.block.fields)[0] ?? "";
					const secondField =
						Object.values(event.block.fields)[1] ?? "";
					addStreamedCard({
						id: result.cards[0]!.id,
						question: firstField,
						answer: secondField,
						sourceText: event.block.sourceText,
					});
					await new Promise<void>((r) =>
						requestAnimationFrame(() => r()),
					);
				} else {
					onCount(0, 1);
				}
			} catch {
				onCount(0, 1);
			}
		} else if (event.type === "partial_update") {
			onPartial(
				event.partialQuestion ?? null,
				event.partialAnswer ?? null,
			);
		}
	}
}
