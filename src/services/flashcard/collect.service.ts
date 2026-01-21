/**
 * Collect Service
 * Handles collecting flashcards from markdown and stripping #flashcard tags
 */
import { FLASHCARD_CONFIG } from "../../constants";
import type { FlashcardItem } from "../../types";
import type { FlashcardParserService } from "./flashcard-parser.service";

/**
 * Result of collecting flashcards from markdown
 */
export interface CollectResult {
	/** Number of flashcards collected */
	collectedCount: number;
	/** Flashcards to save to SQL */
	flashcards: FlashcardItem[];
	/** Markdown content with #flashcard tags removed */
	newContent: string;
}

/**
 * Service for collecting flashcards from markdown content
 * and stripping the #flashcard tags
 */
export class CollectService {
	private flashcardTagPattern: RegExp;

	constructor(private parserService: FlashcardParserService) {
		// Pattern to match " #flashcard" at end of line (with optional whitespace)
		this.flashcardTagPattern = new RegExp(
			`\\s*${FLASHCARD_CONFIG.tag}\\s*$`,
			"gm"
		);
	}

	/**
	 * Collect flashcards from markdown content
	 * Returns the flashcards and the content with tags removed
	 */
	collect(content: string): CollectResult {
		const flashcards = this.parserService.extractFlashcards(content);
		const newContent = this.stripFlashcardTags(content);

		return {
			collectedCount: flashcards.length,
			flashcards,
			newContent,
		};
	}

	/**
	 * Remove #flashcard tags from content while preserving the rest
	 */
	private stripFlashcardTags(content: string): string {
		return content.replace(this.flashcardTagPattern, "");
	}

	/**
	 * Check if content has any flashcard tags
	 */
	hasFlashcardTags(content: string): boolean {
		return this.flashcardTagPattern.test(content);
	}

	/**
	 * Count flashcard tags in content
	 */
	countFlashcardTags(content: string): number {
		const matches = content.match(this.flashcardTagPattern);
		return matches?.length ?? 0;
	}
}
