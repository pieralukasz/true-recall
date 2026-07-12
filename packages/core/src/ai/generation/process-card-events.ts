import type { FlashcardItem } from "../../types/flashcard.types";
import type { IncrementalFlashcardParser } from "../parsing/incremental-flashcard-parser";
import { addStreamedCard } from "../state/streaming-state";
import { fixSourceText } from "../utils/source-text-fixer";

type ParserEvents = ReturnType<IncrementalFlashcardParser["feed"]>;

/** Minimal file reference needed by process-card-events (replaces Obsidian TFile). */
export interface SourceFileRef {
	path: string;
}

/** Minimal subset of FlashcardManager used during card event processing. */
export interface CardEventFlashcardManager {
	getFrontmatterService(): {
		getSourceNoteUid(file: SourceFileRef): Promise<string | undefined | null>;
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
		skipDuplicates?: boolean;
	}): { cards: FlashcardItem[] };
}

export async function processCardEvents(
	events: ParserEvents,
	sourceFile: SourceFileRef,
	flashcardManager: CardEventFlashcardManager,
	onPartial: (q: string | null, a: string | null) => void,
	onCount: (created: number, dups: number) => void,
	inputText?: string,
): Promise<string[]> {
	const frontmatterService = flashcardManager.getFrontmatterService();
	let sourceUid = await frontmatterService.getSourceNoteUid(sourceFile);
	if (!sourceUid) {
		sourceUid = frontmatterService.generateUid();
		await frontmatterService.setSourceNoteUid(sourceFile, sourceUid);
	}

	const createdIds: string[] = [];

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
					// Re-running generation on the same note must not create
					// duplicate cards; empty result counts as a duplicate below.
					skipDuplicates: true,
				});

				if (result.cards.length > 0) {
					onCount(result.cards.length, 0);
					for (const card of result.cards) {
						createdIds.push(card.id);
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
			} catch (error) {
				if (error instanceof Error && error.name === "DuplicateQuestionError") {
					onCount(0, 1);
				} else {
					console.error("[processCardEvents] Card creation failed:", error);
					onCount(0, 1);
				}
			}
		} else if (event.type === "partial_update") {
			onPartial(event.partialQuestion ?? null, event.partialAnswer ?? null);
		}
	}

	return createdIds;
}
