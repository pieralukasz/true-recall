/**
 * Collect Service
 * Handles collecting flashcards from markdown and stripping #flashcard tags
 *
 * Uses a single-pass algorithm to:
 * - Extract flashcards (supports multi-line questions with code blocks)
 * - Strip #flashcard tags from content
 * - Remove entire flashcard blocks
 *
 * All in O(n) time with proper handling of:
 * - Multi-line questions (including code blocks)
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
	private readonly tagPattern: RegExp;
	private readonly legacyIdPattern: RegExp;
	private readonly codeBlockPattern: RegExp;

	constructor() {
		// Matches any line ending with #flashcard, captures everything before
		this.tagPattern = new RegExp(
			`^(.*)\\s*${FLASHCARD_CONFIG.tag}\\s*$`
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
	 * Supports multi-line questions including code blocks.
	 */
	collect(content: string): CollectResult {
		const lines = content.split(/\r?\n/);
		const flashcards: FlashcardItem[] = [];
		const tagsStrippedLines: string[] = [];
		const noFlashcardsLines: string[] = [];

		// For accumulating potential question lines
		let potentialQuestionLines: string[] = [];
		let potentialQuestionOutputLines: string[] = []; // For tagsStrippedLines
		let inQuestionCodeBlock = false;

		// For collecting answer
		let currentQuestion: string | null = null;
		let currentAnswerLines: string[] = [];
		let inFlashcard = false;
		let inAnswerCodeBlock = false;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i] ?? "";
			const trimmedLine = line.trim();

			if (inFlashcard) {
				// We're collecting answer lines
				if (this.codeBlockPattern.test(trimmedLine)) {
					inAnswerCodeBlock = !inAnswerCodeBlock;
				}

				if (this.legacyIdPattern.test(line)) {
					// Skip legacy ID lines from answer, but keep in file content
					tagsStrippedLines.push(line);
				} else if (trimmedLine === "" && !inAnswerCodeBlock && currentAnswerLines.length === 0) {
					// Skip leading empty lines between question and answer
					tagsStrippedLines.push(line);
					// Don't add to noFlashcardsLines - this is part of the flashcard block
				} else if (
					(trimmedLine === "" && !inAnswerCodeBlock) ||
					this.tagPattern.test(line)
				) {
					// Empty line (when NOT in code block) or new flashcard - end current flashcard
					if (currentQuestion) {
						this.saveFlashcard(flashcards, currentQuestion, currentAnswerLines);
					}
					inFlashcard = false;
					inAnswerCodeBlock = false;
					currentQuestion = null;
					currentAnswerLines = [];

					// If it's a new flashcard line, re-process it
					if (this.tagPattern.test(line)) {
						i--;
					} else {
						// Keep empty line in both outputs
						tagsStrippedLines.push(line);
						noFlashcardsLines.push(line);
					}
				} else {
					// Part of answer (including empty lines inside code blocks)
					currentAnswerLines.push(line);
					tagsStrippedLines.push(line);
					// Skip in noFlashcardsLines
				}
			} else {
				// Not in flashcard - either regular text or accumulating question

				// Toggle code block state for question accumulation
				if (this.codeBlockPattern.test(line)) {
					inQuestionCodeBlock = !inQuestionCodeBlock;
				}

				const tagMatch = line.match(this.tagPattern);

				if (tagMatch) {
					// Found #flashcard - finalize question and start collecting answer
					const beforeTag = tagMatch[1] ?? "";

					// Add the part before #flashcard to question lines
					potentialQuestionLines.push(beforeTag);
					potentialQuestionOutputLines.push(beforeTag);

					const question = potentialQuestionLines.join("\n").trim();

					// Add accumulated question lines to tagsStrippedLines (without the tag)
					tagsStrippedLines.push(...potentialQuestionOutputLines);
					// Don't add to noFlashcardsLines - question is part of flashcard

					// Reset accumulation
					potentialQuestionLines = [];
					potentialQuestionOutputLines = [];
					inQuestionCodeBlock = false;

					if (question) {
						currentQuestion = question;
						currentAnswerLines = [];
						inFlashcard = true;
						inAnswerCodeBlock = false;
					}
				} else if (trimmedLine === "" && !inQuestionCodeBlock) {
					// Empty line outside code block - this separates content
					// Flush any accumulated question lines as regular text
					if (potentialQuestionLines.length > 0) {
						tagsStrippedLines.push(...potentialQuestionOutputLines);
						noFlashcardsLines.push(...potentialQuestionOutputLines);
						potentialQuestionLines = [];
						potentialQuestionOutputLines = [];
					}
					// Add the empty line
					tagsStrippedLines.push(line);
					noFlashcardsLines.push(line);
				} else {
					// Accumulate as potential question line
					potentialQuestionLines.push(line);
					potentialQuestionOutputLines.push(line);
				}
			}
		}

		// Handle edge case: file ends with flashcard
		if (inFlashcard && currentQuestion) {
			this.saveFlashcard(flashcards, currentQuestion, currentAnswerLines);
		}

		// Flush any remaining accumulated lines as regular text
		if (potentialQuestionLines.length > 0) {
			tagsStrippedLines.push(...potentialQuestionOutputLines);
			noFlashcardsLines.push(...potentialQuestionOutputLines);
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
			if (this.tagPattern.test(line)) count++;
		}
		return count;
	}
}
