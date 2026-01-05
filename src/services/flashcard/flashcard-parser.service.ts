/**
 * Flashcard Parser Service
 * Handles parsing and extracting flashcards from markdown content
 */
import { FLASHCARD_CONFIG } from "../../constants";
import { type FlashcardItem } from "../../validation";

/**
 * Service for parsing flashcard content from markdown files
 */
export class FlashcardParserService {
	private flashcardPattern: RegExp;
	private blockIdPattern: RegExp;

	constructor() {
		this.flashcardPattern = new RegExp(
			`^(.+?)\\s*${FLASHCARD_CONFIG.tag}\\s*$`
		);
		this.blockIdPattern = /^\^([a-zA-Z0-9-]+)$/;
	}

	/**
	 * Extract flashcards from content
	 * Parses markdown content and returns all flashcard items with their metadata
	 */
	extractFlashcards(content: string): FlashcardItem[] {
		const flashcards: FlashcardItem[] = [];
		const lines = content.split("\n");

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i] ?? "";
			const match = line.match(this.flashcardPattern);

			if (match?.[1]) {
				const question = match[1].trim();
				const questionLineNumber = i + 1;
				const answerLines: string[] = [];
				let cardId: string | undefined;

				i++;
				while (i < lines.length) {
					const answerLine = lines[i] ?? "";

					// Skip legacy ID lines
					if (/^ID:\s*\d+/.test(answerLine)) {
						i++;
						continue;
					}

					// Check for block ID (^uuid)
					const blockIdMatch = answerLine.match(this.blockIdPattern);
					if (blockIdMatch?.[1]) {
						cardId = blockIdMatch[1];
						i++;
						continue;
					}

					if (
						answerLine.trim() === "" ||
						this.isFlashcardLine(answerLine)
					) {
						i--;
						break;
					}

					answerLines.push(answerLine);
					i++;
				}

				const answer = answerLines.join("\n").trim();
				if (question) {
					flashcards.push({
						question,
						answer,
						lineNumber: questionLineNumber,
						id: cardId,
					});
				}
			}
		}

		return flashcards;
	}

	/**
	 * Check if a line is a flashcard question line (contains #flashcard tag)
	 */
	isFlashcardLine(line: string): boolean {
		return this.flashcardPattern.test(line);
	}

	/**
	 * Get the flashcard tag pattern for external use
	 */
	getFlashcardTag(): string {
		return FLASHCARD_CONFIG.tag;
	}
}
