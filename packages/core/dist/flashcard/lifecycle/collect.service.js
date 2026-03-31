/**
 * Scans note content for block-format flashcards (#type/<slug> blocks).
 * Returns parsed blocks ready for createNote/createNoteBatch.
 */
import { countBlocks, parseBlocks, } from "@true-recall/core/flashcard/parsing/block-parser.service";
export class CollectService {
    constructor(getNoteType) {
        this.getNoteType = getNoteType;
    }
    collect(content) {
        const { blocks, contentWithoutBlocks } = parseBlocks(content, this.getNoteType);
        return {
            collectedCount: blocks.length,
            parsedBlocks: blocks,
            newContent: content,
            newContentWithoutFlashcards: contentWithoutBlocks,
        };
    }
    countFlashcardLines(content) {
        return countBlocks(content, this.getNoteType);
    }
}
