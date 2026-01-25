/**
 * Collect Service
 * Handles collecting flashcards from markdown and stripping #flashcard tags
 *
 * Uses a single-pass algorithm to:
 * - Extract flashcards
 * - Strip #flashcard tags from content
 * - Remove entire flashcard blocks
 *
 * All in O(n) time with proper handling of:
 * - Legacy ID lines (ID: 123)
 * - Code blocks (``` or ~~~) - empty lines inside code blocks don't end flashcards
 * - Consecutive flashcards
 * - Files ending with flashcards (no trailing newline)
 */
import { FLASHCARD_CONFIG } from "../../constants";
import type { FlashcardItem } from "../../types";

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
 *
 * Uses single-pass algorithm that mirrors FlashcardParserService logic
 * to ensure consistency between extraction and removal.
 */
export class CollectService {
	private readonly flashcardTag = FLASHCARD_CONFIG.tag;
	private readonly flashcardPattern: RegExp;
	private readonly legacyIdPattern: RegExp;
	private readonly codeBlockPattern: RegExp;

	constructor() {
		// Pattern from FlashcardParserService - matches line ending with #flashcard
		// Group 1 captures the question text before the tag
		this.flashcardPattern = new RegExp(
			`^(.+?)\\s*${FLASHCARD_CONFIG.tag}\\s*$`
		);
		// Matches legacy ID lines (old format)
		this.legacyIdPattern = /^ID:\s*\d+/;
		// Detect code block markers (``` or ~~~)
		this.codeBlockPattern = /^\s*(```|~~~)/;
	}

	/**
	 * Collect flashcards from markdown content
	 * Returns the flashcards and content with tags/flashcards removed
	 *
	 * Single-pass algorithm: O(n) where n is number of lines
	 */
	collect(content: string): CollectResult {
		const lines = content.split(/\r?\n/);
		const flashcards: FlashcardItem[] = [];
		const tagsStrippedLines: string[] = [];
		const noFlashcardsLines: string[] = [];

		let currentQuestion: string | null = null;
		let currentAnswerLines: string[] = [];
		let inFlashcard = false;
		let inCodeBlock = false; // Track if we're inside a code block

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i] ?? "";
			const match = line.match(this.flashcardPattern);
			const trimmedLine = line.trim();

			// Toggle code block state if we hit a marker
			if (this.codeBlockPattern.test(trimmedLine)) {
				if (inFlashcard) {
					inCodeBlock = !inCodeBlock;
				}
			}

			if (match?.[1]) {
				// Start of new flashcard - save previous if exists
				if (inFlashcard && currentQuestion) {
					this.saveFlashcard(flashcards, currentQuestion, currentAnswerLines);
				}

				currentQuestion = match[1].trim();
				currentAnswerLines = [];
				inFlashcard = true;
				inCodeBlock = false;

				// newContent: line without tag
				tagsStrippedLines.push(currentQuestion);
				// newContentWithoutFlashcards: skip this line
			} else if (inFlashcard) {
				// Check for end conditions (same as FlashcardParserService)
				if (this.legacyIdPattern.test(line)) {
					// Skip legacy ID lines from answer, but keep in file content
					tagsStrippedLines.push(line);
				} else if (
					(trimmedLine === "" && !inCodeBlock) ||
					this.flashcardPattern.test(line)
				) {
					// Empty line (when NOT in code block) or new flashcard - end current flashcard
					if (currentQuestion) {
						this.saveFlashcard(
							flashcards,
							currentQuestion,
							currentAnswerLines
						);
					}
					inFlashcard = false;
					inCodeBlock = false;
					currentQuestion = null;
					currentAnswerLines = [];

					// Keep empty line in both outputs
					tagsStrippedLines.push(line);
					noFlashcardsLines.push(line);

					// If it's a flashcard line, re-process it
					if (this.flashcardPattern.test(line)) {
						i--;
					}
				} else {
					// Part of answer (including empty lines inside code blocks)
					currentAnswerLines.push(line);
					tagsStrippedLines.push(line);
					// Skip in noFlashcardsLines
				}
			} else {
				// Regular text
				tagsStrippedLines.push(line);
				noFlashcardsLines.push(line);
			}
		}

		// Handle edge case: file ends with flashcard
		if (inFlashcard && currentQuestion) {
			this.saveFlashcard(flashcards, currentQuestion, currentAnswerLines);
		}

		return {
			collectedCount: flashcards.length,
			flashcards,
			newContent: tagsStrippedLines.join("\n"),
			newContentWithoutFlashcards: noFlashcardsLines.join("\n"),
		};
	}

	/**
	 * Save a flashcard to the collection
	 */
	private saveFlashcard(
		flashcards: FlashcardItem[],
		question: string,
		answerLines: string[]
	): void {
		if (!question) return;
		flashcards.push({
			question,
			answer: answerLines.join("\n").trim(),
			id: crypto.randomUUID(),
		});
	}

	/**
	 * Check if content has any flashcard tags
	 * Uses simple string.includes() for performance
	 */
	hasFlashcardTags(content: string): boolean {
		return content.includes(this.flashcardTag);
	}

	/**
	 * Count flashcard tags in content
	 * Uses line-by-line iteration to avoid global regex state issues
	 */
	countFlashcardTags(content: string): number {
		const lines = content.split(/\r?\n/);
		let count = 0;
		for (const line of lines) {
			if (this.flashcardPattern.test(line)) count++;
		}
		return count;
	}
}
