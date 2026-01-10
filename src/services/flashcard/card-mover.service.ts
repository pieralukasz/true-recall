/**
 * Card Mover Service
 * Handles moving flashcards between files and extracting card data
 */
import { FLASHCARD_CONFIG } from "../../constants";

/**
 * Extracted card data from content
 */
export interface ExtractedCardData {
	question: string;
	answer: string;
	startLine: number;
	endLine: number;
}

/**
 * Service for card movement operations
 */
export class CardMoverService {
	private flashcardPattern: RegExp;

	constructor() {
		this.flashcardPattern = new RegExp(
			`^(.+?)\\s*${FLASHCARD_CONFIG.tag}\\s*$`
		);
	}

	/**
	 * Extract a flashcard by its UUID from file content
	 * Parses backwards from ^uuid to find the question line with #flashcard
	 */
	extractCardById(content: string, cardId: string): ExtractedCardData | null {
		const lines = content.split("\n");
		const blockIdPattern = new RegExp(`^\\^${cardId}$`, "i");

		// Find the line with ^cardId
		let blockIdLineIndex = -1;
		for (let i = 0; i < lines.length; i++) {
			if (blockIdPattern.test(lines[i] ?? "")) {
				blockIdLineIndex = i;
				break;
			}
		}

		if (blockIdLineIndex === -1) {
			return null;
		}

		// Parse backwards to find question line
		let questionLineIndex = -1;
		const answerLines: string[] = [];

		for (let i = blockIdLineIndex - 1; i >= 0; i--) {
			const line = lines[i] ?? "";
			const flashcardMatch = line.match(this.flashcardPattern);

			if (flashcardMatch?.[1]) {
				questionLineIndex = i;
				break;
			}

			// Skip empty lines at the end
			if (answerLines.length === 0 && line.trim() === "") {
				continue;
			}

			// Skip legacy FSRS comments
			if (line.includes(FLASHCARD_CONFIG.fsrsDataPrefix)) {
				continue;
			}

			answerLines.unshift(line);
		}

		if (questionLineIndex === -1) {
			return null;
		}

		const questionLine = lines[questionLineIndex] ?? "";
		const questionMatch = questionLine.match(this.flashcardPattern);
		const question = questionMatch?.[1]?.trim() ?? "";

		return {
			question,
			answer: answerLines.join("\n").trim(),
			startLine: questionLineIndex,
			endLine: blockIdLineIndex,
		};
	}

	/**
	 * Remove a card from content by line range
	 * Also removes trailing empty lines
	 */
	removeCardFromContent(
		content: string,
		startLine: number,
		endLine: number
	): string {
		const lines = content.split("\n");

		// Extend endLine to include trailing empty lines
		let actualEndLine = endLine;
		while (
			actualEndLine + 1 < lines.length &&
			(lines[actualEndLine + 1] ?? "").trim() === ""
		) {
			actualEndLine++;
		}

		// Remove the lines
		lines.splice(startLine, actualEndLine - startLine + 1);

		// Also remove leading empty lines if any (after previous card)
		while (
			startLine > 0 &&
			startLine < lines.length &&
			(lines[startLine] ?? "").trim() === "" &&
			(lines[startLine - 1] ?? "").trim() === ""
		) {
			lines.splice(startLine, 1);
		}

		return lines.join("\n");
	}

	/**
	 * Build flashcard text for insertion
	 */
	buildFlashcardText(question: string, answer: string, cardId: string): string {
		return `${question} ${FLASHCARD_CONFIG.tag}\n${answer}\n^${cardId}`;
	}

	/**
	 * Get the flashcard tag
	 */
	getFlashcardTag(): string {
		return FLASHCARD_CONFIG.tag;
	}

	/**
	 * Find the line number of a card by its UUID (for navigation)
	 * Searches for ^{cardId} in content and returns the question line number (1-based)
	 * @returns Line number (1-based) or null if card not found
	 */
	findCardLineNumber(content: string, cardId: string): number | null {
		const lines = content.split("\n");
		const blockIdPattern = new RegExp(`^\\^${cardId}$`, "i");

		// Find the line with ^cardId
		let blockIdLineIndex = -1;
		for (let i = 0; i < lines.length; i++) {
			if (blockIdPattern.test(lines[i] ?? "")) {
				blockIdLineIndex = i;
				break;
			}
		}

		if (blockIdLineIndex === -1) {
			return null;
		}

		// Parse backwards to find question line
		for (let i = blockIdLineIndex - 1; i >= 0; i--) {
			const line = lines[i] ?? "";
			if (this.flashcardPattern.test(line)) {
				return i + 1; // Convert 0-based to 1-based line number
			}
		}

		return null;
	}

	/**
	 * Replace card content in file by line range
	 * @returns New content with card replaced
	 */
	replaceCardContent(
		content: string,
		startLine: number,
		endLine: number,
		newCardText: string
	): string {
		const lines = content.split("\n");

		// Extend endLine to include trailing empty lines
		let actualEndLine = endLine;
		while (
			actualEndLine + 1 < lines.length &&
			(lines[actualEndLine + 1] ?? "").trim() === ""
		) {
			actualEndLine++;
		}

		// Replace the lines
		lines.splice(startLine, actualEndLine - startLine + 1, newCardText);

		return lines.join("\n");
	}
}
