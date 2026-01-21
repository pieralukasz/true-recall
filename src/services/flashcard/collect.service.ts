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
	/** Markdown content with #flashcard tags removed (content preserved) */
	newContent: string;
	/** Markdown content with entire flashcards removed (question + answer) */
	newContentWithoutFlashcards: string;
}

/**
 * Service for collecting flashcards from markdown content
 * and stripping the #flashcard tags
 */
export class CollectService {
	private flashcardTagPattern: RegExp;
	private entireFlashcardPattern: RegExp;

	constructor(private parserService: FlashcardParserService) {
		// Pattern to match " #flashcard" at end of line (with optional whitespace)
		this.flashcardTagPattern = new RegExp(
			`\\s*${FLASHCARD_CONFIG.tag}\\s*$`,
			"gm"
		);

		// Pattern to match entire flashcard block:
		// - Line ending with #flashcard (question)
		// - Following non-empty lines (answer)
		// - Optional trailing empty line
		this.entireFlashcardPattern = new RegExp(
			`^[^\\n]*${FLASHCARD_CONFIG.tag}\\s*\\n(?:[^\\n]+\\n)*(?:\\n)?`,
			"gm"
		);
	}

	/**
	 * Collect flashcards from markdown content
	 * Returns the flashcards and content with tags/flashcards removed
	 */
	collect(content: string): CollectResult {
		const flashcards = this.parserService.extractFlashcards(content);
		const newContent = this.stripFlashcardTags(content);
		const newContentWithoutFlashcards = this.stripEntireFlashcards(content);

		return {
			collectedCount: flashcards.length,
			flashcards,
			newContent,
			newContentWithoutFlashcards,
		};
	}

	/**
	 * Remove #flashcard tags from content while preserving the rest
	 */
	private stripFlashcardTags(content: string): string {
		return content.replace(this.flashcardTagPattern, "");
	}

	/**
	 * Remove entire flashcard blocks (question + answer) from content
	 */
	private stripEntireFlashcards(content: string): string {
		return content.replace(this.entireFlashcardPattern, "");
	}

	/**
	 * Check if content has any flashcard tags
	 */
	hasFlashcardTags(content: string): boolean {
		// Reset lastIndex for global regex
		this.flashcardTagPattern.lastIndex = 0;
		return this.flashcardTagPattern.test(content);
	}

	/**
	 * Count flashcard tags in content
	 */
	countFlashcardTags(content: string): number {
		// Reset lastIndex for global regex
		this.flashcardTagPattern.lastIndex = 0;
		const matches = content.match(this.flashcardTagPattern);
		return matches?.length ?? 0;
	}
}
