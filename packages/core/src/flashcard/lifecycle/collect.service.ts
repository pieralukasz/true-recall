/**
 * Scans note content for block-format flashcards (#type/<slug> blocks).
 * Returns parsed blocks ready for createNote/createNoteBatch.
 */

import {
	countBlocks,
	type NoteTypeLookup,
	type ParsedBlock,
	parseBlocks,
} from "@true-recall/core/flashcard/parsing/block-parser.service";

export interface CollectResult {
	collectedCount: number;
	parsedBlocks: ParsedBlock[];
	/** Original content unchanged */
	newContent: string;
	/** Content with block-format flashcards removed */
	newContentWithoutFlashcards: string;
}

export class CollectService {
	constructor(private getNoteType: NoteTypeLookup) {}

	collect(content: string): CollectResult {
		const { blocks, contentWithoutBlocks } = parseBlocks(
			content,
			this.getNoteType,
		);

		return {
			collectedCount: blocks.length,
			parsedBlocks: blocks,
			newContent: content,
			newContentWithoutFlashcards: contentWithoutBlocks,
		};
	}

	countFlashcardLines(content: string): number {
		return countBlocks(content, this.getNoteType);
	}
}
