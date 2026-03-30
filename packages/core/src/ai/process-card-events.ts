import type { FlashcardItem } from "../types/flashcard.types";
import type { IncrementalFlashcardParser } from "./incremental-flashcard-parser";
import { fixSourceText } from "./source-text-fixer";
import { addStreamedCard } from "./streaming-state";

type ParserEvents = ReturnType<IncrementalFlashcardParser["feed"]>;

/** Minimal file reference needed by process-card-events (replaces Obsidian TFile). */
export interface SourceFileRef {
	path: string;
}

/** Minimal subset of FlashcardManager used during card event processing. */
export interface CardEventFlashcardManager {
	getFrontmatterService(): {
		getSourceNoteUid(file: SourceFileRef): Promise<string | undefined>;
		generateUid(): string;
		setSourceNoteUid(file: SourceFileRef, uid: string): Promise<void>;
	};
	createNote(params: {
		noteTypeId: string;
		fields: Record<string, string>;
		alwaysTypeIn?: boolean;
		sourceUid: string;
		sourceText?: string;
		createdVia: string;
	}): { cards: FlashcardItem[] };
}

export async function processCardEvents(
	events: ParserEvents,
	sourceFile: SourceFileRef,
	flashcardManager: CardEventFlashcardManager,
	onPartial: (q: string | null, a: string | null) => void,
	onCount: (created: number, dups: number) => void,
	inputText?: string,
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
				const sourceText =
					inputText && event.block.sourceText
						? fixSourceText(event.block.sourceText, inputText)
						: event.block.sourceText;
				const result = flashcardManager.createNote({
					noteTypeId: event.block.noteTypeId,
					fields: event.block.fields,
					alwaysTypeIn: event.block.alwaysTypeIn,
					sourceUid,
					sourceText,
					createdVia: "ai",
				});

				if (result.cards.length > 0) {
					onCount(result.cards.length, 0);
					for (const card of result.cards) {
						addStreamedCard({
							id: card.id,
							question: card.question ?? "",
							answer: card.answer ?? "",
							cardType: card.cardType,
							clozeTemplate: card.clozeTemplate,
							clozeIndex: card.clozeIndex,
							sourceText: card.sourceText,
						});
					}
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
