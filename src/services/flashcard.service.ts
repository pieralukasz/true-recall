/**
 * Flashcard Manager Service
 * Handles flashcard file operations in the Obsidian vault
 */
import { App, TFile, normalizePath, WorkspaceLeaf } from "obsidian";
import { FLASHCARD_CONFIG } from "../constants";
import { type FlashcardItem, type FlashcardChange } from "../validation";
import { FileError } from "../errors";
import type {
	EpistemeSettings,
	FSRSCardData,
	FSRSFlashcardItem,
	DeckInfo,
	CardReviewLogEntry,
} from "../types";
import { createDefaultFSRSData, State } from "../types";
import type { ShardedStoreService, ShardEntry } from "./sharded-store.service";

/** Default deck name for cards without explicit deck assignment */
const DEFAULT_DECK = "Knowledge";

/**
 * Result of scanning vault for new flashcards
 */
export interface ScanResult {
	totalCards: number;
	newCardsProcessed: number;
	filesProcessed: number;
	orphanedRemoved: number;
}

/**
 * Flashcard file information
 */
export interface FlashcardInfo {
	exists: boolean;
	filePath: string;
	cardCount: number;
	questions: string[];
	flashcards: FlashcardItem[];
	lastModified: number | null;
}

/**
 * Service for managing flashcard files in the vault
 */
export class FlashcardManager {
	private app: App;
	private settings: EpistemeSettings;
	private store: ShardedStoreService | null = null;

	constructor(app: App, settings: EpistemeSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Set the sharded store for FSRS data
	 * When set, FSRS data will be read/written from store instead of inline comments
	 */
	setStore(store: ShardedStoreService): void {
		this.store = store;
	}

	/**
	 * Check if sharded store is available
	 */
	hasStore(): boolean {
		return this.store !== null && this.store.isReady();
	}

	/**
	 * Update settings reference
	 */
	updateSettings(settings: EpistemeSettings): void {
		this.settings = settings;
	}

	/**
	 * Get the flashcard file path for a source note
	 */
	getFlashcardPath(sourceFile: TFile): string {
		const baseName = sourceFile.basename;
		return normalizePath(
			`${this.settings.flashcardsFolder}/${FLASHCARD_CONFIG.filePrefix}${baseName}.md`
		);
	}

	/**
	 * Get flashcard file info for a source note
	 */
	async getFlashcardInfo(sourceFile: TFile): Promise<FlashcardInfo> {
		const flashcardPath = this.getFlashcardPath(sourceFile);
		const flashcardFile =
			this.app.vault.getAbstractFileByPath(flashcardPath);

		if (!(flashcardFile instanceof TFile)) {
			return this.createEmptyFlashcardInfo(flashcardPath);
		}

		return this.parseFlashcardFile(flashcardFile);
	}

	/**
	 * Get flashcard info directly from a flashcard file
	 */
	async getFlashcardInfoDirect(flashcardFile: TFile): Promise<FlashcardInfo> {
		return this.parseFlashcardFile(flashcardFile);
	}

	/**
	 * Extract source note content from flashcard file (stored in HTML comment)
	 */
	async extractSourceContent(sourceFile: TFile): Promise<string | null> {
		const flashcardPath = this.getFlashcardPath(sourceFile);
		const flashcardFile =
			this.app.vault.getAbstractFileByPath(flashcardPath);

		if (!(flashcardFile instanceof TFile)) {
			return null;
		}

		const content = await this.app.vault.read(flashcardFile);
		const pattern = new RegExp(
			`${FLASHCARD_CONFIG.sourceContentStartMarker}\\n([\\s\\S]*?)\\n${FLASHCARD_CONFIG.sourceContentEndMarker}`
		);
		const match = content.match(pattern);
		return match?.[1] ?? null;
	}

	/**
	 * Update or add source content in flashcard file
	 */
	async updateSourceContent(
		sourceFile: TFile,
		noteContent: string
	): Promise<void> {
		const flashcardPath = this.getFlashcardPath(sourceFile);
		const flashcardFile =
			this.app.vault.getAbstractFileByPath(flashcardPath);

		if (!(flashcardFile instanceof TFile)) {
			return;
		}

		const content = await this.app.vault.read(flashcardFile);
		const sourceBlock = this.generateSourceContentBlock(noteContent);
		const pattern = new RegExp(
			`${FLASHCARD_CONFIG.sourceContentStartMarker}\\n[\\s\\S]*?\\n${FLASHCARD_CONFIG.sourceContentEndMarker}`
		);
		const existingMatch = content.match(pattern);

		let newContent: string;
		if (existingMatch) {
			newContent = content.replace(existingMatch[0], sourceBlock.trim());
		} else {
			newContent = content.trimEnd() + "\n" + sourceBlock;
		}

		await this.app.vault.modify(flashcardFile, newContent);
	}

	/**
	 * Create a new flashcard file
	 */
	async createFlashcardFile(
		sourceFile: TFile,
		flashcardContent: string
	): Promise<TFile> {
		await this.ensureFolderExists();

		const flashcardPath = this.getFlashcardPath(sourceFile);
		const frontmatter = this.generateFrontmatter(sourceFile);
		const fullContent = frontmatter + flashcardContent;

		const existing = this.app.vault.getAbstractFileByPath(flashcardPath);
		if (existing instanceof TFile) {
			await this.app.vault.modify(existing, fullContent);
			return existing;
		}

		return await this.app.vault.create(flashcardPath, fullContent);
	}

	/**
	 * Append new flashcards to existing file
	 */
	async appendFlashcards(
		sourceFile: TFile,
		newFlashcardContent: string
	): Promise<TFile> {
		const flashcardPath = this.getFlashcardPath(sourceFile);
		const flashcardFile =
			this.app.vault.getAbstractFileByPath(flashcardPath);

		if (!(flashcardFile instanceof TFile)) {
			return await this.createFlashcardFile(
				sourceFile,
				newFlashcardContent
			);
		}

		const existingContent = await this.app.vault.read(flashcardFile);
		const updatedContent =
			existingContent.trimEnd() + "\n\n" + newFlashcardContent;
		await this.app.vault.modify(flashcardFile, updatedContent);

		return flashcardFile;
	}

	/**
	 * Open flashcard file
	 */
	async openFlashcardFile(sourceFile: TFile): Promise<void> {
		const flashcardPath = this.getFlashcardPath(sourceFile);
		const flashcardFile =
			this.app.vault.getAbstractFileByPath(flashcardPath);

		if (flashcardFile instanceof TFile) {
			const leaf = this.getLeafForFile(flashcardFile);
			await leaf.openFile(flashcardFile);
			this.app.workspace.setActiveLeaf(leaf, { focus: true });
		}
	}

	/**
	 * Open flashcard file at a specific line for editing
	 */
	async openFlashcardFileAtLine(
		sourceFile: TFile,
		lineNumber: number
	): Promise<void> {
		const flashcardPath = this.getFlashcardPath(sourceFile);
		const flashcardFile =
			this.app.vault.getAbstractFileByPath(flashcardPath);

		if (flashcardFile instanceof TFile) {
			await this.openFileAtLine(flashcardFile, lineNumber);
		}
	}

	/**
	 * Open any file at a specific line
	 */
	async openFileAtLine(file: TFile, lineNumber: number): Promise<void> {
		const leaf = this.getLeafForFile(file);
		await leaf.openFile(file);
		this.app.workspace.setActiveLeaf(leaf, { focus: true });

		const view = leaf.view;
		if (view && "editor" in view) {
			const editor = (
				view as {
					editor: {
						setCursor: (pos: { line: number; ch: number }) => void;
					};
				}
			).editor;
			editor.setCursor({ line: lineNumber - 1, ch: 0 });
		}
	}

	/**
	 * Remove a flashcard from the file by its line number
	 */
	async removeFlashcard(
		sourceFile: TFile,
		lineNumber: number
	): Promise<boolean> {
		const flashcardPath = this.getFlashcardPath(sourceFile);
		const flashcardFile =
			this.app.vault.getAbstractFileByPath(flashcardPath);

		if (!(flashcardFile instanceof TFile)) {
			return false;
		}

		return this.removeFlashcardDirect(flashcardFile, lineNumber);
	}

	/**
	 * Remove a flashcard directly from a flashcard file
	 */
	async removeFlashcardDirect(
		flashcardFile: TFile,
		lineNumber: number
	): Promise<boolean> {
		if (!(flashcardFile instanceof TFile)) {
			return false;
		}

		const content = await this.app.vault.read(flashcardFile);
		const lines = content.split("\n");

		const startIndex = lineNumber - 1;
		if (startIndex < 0 || startIndex >= lines.length) {
			return false;
		}

		// Find the end of this flashcard block
		let endIndex = startIndex + 1;
		while (endIndex < lines.length) {
			const line = lines[endIndex] ?? "";
			if (line.trim() === "" || this.isFlashcardLine(line)) {
				break;
			}
			endIndex++;
		}

		// Remove trailing empty lines
		while (
			endIndex < lines.length &&
			(lines[endIndex] ?? "").trim() === ""
		) {
			endIndex++;
		}

		lines.splice(startIndex, endIndex - startIndex);
		const newContent = lines.join("\n");
		await this.app.vault.modify(flashcardFile, newContent);

		return true;
	}

	/**
	 * Apply accepted diff changes to the flashcard file
	 */
	async applyDiffChanges(
		sourceFile: TFile,
		changes: FlashcardChange[],
		_existingFlashcards: FlashcardItem[]
	): Promise<TFile> {
		const flashcardPath = this.getFlashcardPath(sourceFile);
		const flashcardFile =
			this.app.vault.getAbstractFileByPath(flashcardPath);

		if (!(flashcardFile instanceof TFile)) {
			throw new FileError(
				"Flashcard file not found",
				flashcardPath,
				"read"
			);
		}

		const content = await this.app.vault.read(flashcardFile);
		let lines = content.split("\n");

		// Process DELETED changes first (sort by line number descending)
		lines = this.processDeletedChanges(lines, changes);

		// Process MODIFIED changes (sort by line number descending)
		lines = this.processModifiedChanges(lines, changes);

		// Process NEW changes (append at end)
		lines = this.processNewChanges(lines, changes);

		const newContent = lines.join("\n").trimEnd() + "\n";
		await this.app.vault.modify(flashcardFile, newContent);

		return flashcardFile;
	}

	// ===== Private Helper Methods =====

	private createEmptyFlashcardInfo(filePath: string): FlashcardInfo {
		return {
			exists: false,
			filePath,
			cardCount: 0,
			questions: [],
			flashcards: [],
			lastModified: null,
		};
	}

	private async parseFlashcardFile(file: TFile): Promise<FlashcardInfo> {
		const content = await this.app.vault.read(file);
		const flashcards = this.extractFlashcards(content);
		const questions = flashcards.map((f) => f.question);

		return {
			exists: true,
			filePath: file.path,
			cardCount: flashcards.length,
			questions,
			flashcards,
			lastModified: file.stat.mtime,
		};
	}

	private extractFlashcards(content: string): FlashcardItem[] {
		const flashcards: FlashcardItem[] = [];
		const lines = content.split("\n");
		const flashcardPattern = new RegExp(
			`^(.+?)\\s*${FLASHCARD_CONFIG.tag}\\s*$`
		);

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i] ?? "";
			const match = line.match(flashcardPattern);

			if (match?.[1]) {
				const question = match[1].trim();
				const questionLineNumber = i + 1;
				const answerLines: string[] = [];

				i++;
				while (i < lines.length) {
					const answerLine = lines[i] ?? "";

					// Skip legacy ID lines
					if (/^ID:\s*\d+/.test(answerLine)) {
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
					});
				}
			}
		}

		return flashcards;
	}

	private isFlashcardLine(line: string): boolean {
		return new RegExp(`^.+?\\s*${FLASHCARD_CONFIG.tag}\\s*$`).test(line);
	}

	private async ensureFolderExists(): Promise<void> {
		const folderPath = normalizePath(this.settings.flashcardsFolder);
		const folder = this.app.vault.getAbstractFileByPath(folderPath);

		if (!folder) {
			await this.app.vault.createFolder(folderPath);
		}
	}

	private generateSourceContentBlock(noteContent: string): string {
		return `\n${FLASHCARD_CONFIG.sourceContentStartMarker}\n${noteContent}\n${FLASHCARD_CONFIG.sourceContentEndMarker}\n`;
	}

	private generateFrontmatter(
		sourceFile: TFile,
		deck: string = DEFAULT_DECK
	): string {
		return `---
source_link: "[[${sourceFile.basename}]]"
tags: [flashcards/auto]
deck: "${deck}"
---

# Flashcards for [[${sourceFile.basename}]]

`;
	}

	/**
	 * Extract deck name from frontmatter
	 */
	private extractDeckFromFrontmatter(content: string): string {
		const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
		if (!frontmatterMatch) {
			return DEFAULT_DECK;
		}

		const frontmatter = frontmatterMatch[1] ?? "";
		const deckMatch = frontmatter.match(/^deck:\s*["']?([^"'\n]+)["']?/m);

		return deckMatch?.[1]?.trim() ?? DEFAULT_DECK;
	}

	/**
	 * Extract source_link from frontmatter
	 * Returns the note name from source_link: "[[NoteName]]"
	 */
	private extractSourceLinkFromContent(content: string): string | null {
		const match = content.match(/source_link:\s*"\[\[([^\]]+)\]\]"/);
		return match?.[1] ?? null;
	}

	private getLeafForFile(file: TFile): WorkspaceLeaf {
		const leaves = this.app.workspace.getLeavesOfType("markdown");
		for (const leaf of leaves) {
			const view = leaf.view as { file?: TFile };
			if (view.file?.path === file.path) {
				return leaf;
			}
		}
		return this.app.workspace.getLeaf("tab");
	}

	private processDeletedChanges(
		lines: string[],
		changes: FlashcardChange[]
	): string[] {
		const deletedChanges = changes
			.filter(
				(c) =>
					c.type === "DELETED" && c.accepted && c.originalLineNumber
			)
			.sort(
				(a, b) =>
					(b.originalLineNumber ?? 0) - (a.originalLineNumber ?? 0)
			);

		for (const change of deletedChanges) {
			const lineIndex = (change.originalLineNumber ?? 0) - 1;
			if (lineIndex < 0 || lineIndex >= lines.length) continue;

			let endIndex = lineIndex + 1;
			while (endIndex < lines.length) {
				const line = lines[endIndex] ?? "";
				if (line.trim() === "" || this.isFlashcardLine(line)) {
					break;
				}
				endIndex++;
			}

			if (
				endIndex < lines.length &&
				(lines[endIndex] ?? "").trim() === ""
			) {
				endIndex++;
			}

			lines.splice(lineIndex, endIndex - lineIndex);
		}

		return lines;
	}

	private processModifiedChanges(
		lines: string[],
		changes: FlashcardChange[]
	): string[] {
		const modifiedChanges = changes
			.filter(
				(c) =>
					c.type === "MODIFIED" && c.accepted && c.originalLineNumber
			)
			.sort(
				(a, b) =>
					(b.originalLineNumber ?? 0) - (a.originalLineNumber ?? 0)
			);

		for (const change of modifiedChanges) {
			const lineIndex = (change.originalLineNumber ?? 0) - 1;
			if (lineIndex < 0 || lineIndex >= lines.length) continue;

			let endIndex = lineIndex + 1;
			while (endIndex < lines.length) {
				const line = lines[endIndex] ?? "";
				if (line.trim() === "" || this.isFlashcardLine(line)) {
					break;
				}
				endIndex++;
			}

			const newFlashcardLines = [
				`${change.question} ${FLASHCARD_CONFIG.tag}`,
				change.answer,
			];

			lines.splice(lineIndex, endIndex - lineIndex, ...newFlashcardLines);
		}

		return lines;
	}

	private processNewChanges(
		lines: string[],
		changes: FlashcardChange[]
	): string[] {
		const newChanges = changes.filter(
			(c) => c.type === "NEW" && c.accepted
		);

		if (newChanges.length > 0) {
			const lastLine = lines[lines.length - 1] ?? "";
			if (lastLine.trim() !== "") {
				lines.push("");
			}

			for (const change of newChanges) {
				lines.push(`${change.question} ${FLASHCARD_CONFIG.tag}`);
				lines.push(change.answer);
				lines.push("");
			}
		}

		return lines;
	}

	// ===== FSRS Methods =====

	/**
	 * Get all flashcards with FSRS data from all flashcard files
	 * Scans all files and handles both existing cards (from store) and new cards (without block ID)
	 */
	async getAllFSRSCards(): Promise<FSRSFlashcardItem[]> {
		if (!this.store) {
			throw new Error("Sharded store not initialized. Please restart Obsidian.");
		}

		const allCards: FSRSFlashcardItem[] = [];
		const folderPath = normalizePath(this.settings.flashcardsFolder);

		// Get all flashcard files
		const files = this.app.vault
			.getMarkdownFiles()
			.filter(
				(file) =>
					file.path.startsWith(folderPath + "/") &&
					file.name.startsWith(FLASHCARD_CONFIG.filePrefix)
			);

		for (const file of files) {
			const content = await this.app.vault.read(file);
			const deck = this.extractDeckFromFrontmatter(content);
			const sourceNoteName = this.extractSourceLinkFromContent(content);
			const cards = this.parseAllFlashcards(content, file.path, deck, sourceNoteName);
			allCards.push(...cards);
		}

		return allCards;
	}

	/**
	 * Parse all flashcards from file content
	 * - Cards with block ID: get FSRS from store
	 * - Cards without block ID: create new FSRS, add to store
	 */
	private parseAllFlashcards(
		content: string,
		filePath: string,
		deck: string,
		sourceNoteName: string | null
	): FSRSFlashcardItem[] {
		const flashcards: FSRSFlashcardItem[] = [];
		const lines = content.split("\n");
		const flashcardPattern = new RegExp(
			`^(.+?)\\s*${FLASHCARD_CONFIG.tag}\\s*$`
		);
		// Match both old fsrs- format and new UUID format
		const blockIdPattern =
			/^\^(fsrs-[a-zA-Z0-9]+|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;

		let currentQuestion = "";
		let currentAnswerLines: string[] = [];
		let currentLineNumber = 0;
		let foundBlockId = false;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i] ?? "";
			const flashcardMatch = line.match(flashcardPattern);

			if (flashcardMatch?.[1]) {
				// Process previous card if exists and has no block ID
				if (currentQuestion && !foundBlockId) {
					const card = this.createNewCard(
						currentQuestion,
						currentAnswerLines.join("\n").trim(),
						currentLineNumber,
						filePath,
						deck,
						sourceNoteName ?? undefined
					);
					flashcards.push(card);
				}

				// Start new card
				currentQuestion = flashcardMatch[1].trim();
				currentLineNumber = i + 1;
				currentAnswerLines = [];
				foundBlockId = false;
				continue;
			}

			// Check for block ID
			const blockIdMatch = line.match(blockIdPattern);
			if (blockIdMatch?.[1] && currentQuestion) {
				const blockId = blockIdMatch[1];
				foundBlockId = true;

				// Get from store or create new entry
				let fsrsData = this.store!.get(blockId);
				if (!fsrsData) {
					// Block ID exists in file but not in store - create entry
					fsrsData = createDefaultFSRSData(blockId);
					this.store!.set(blockId, fsrsData);
				}

				flashcards.push({
					id: blockId,
					question: currentQuestion,
					answer: currentAnswerLines.join("\n").trim(),
					lineNumber: currentLineNumber,
					filePath,
					fsrs: fsrsData,
					deck,
					sourceNoteName: sourceNoteName ?? undefined,
				});

				// Reset for next card
				currentQuestion = "";
				currentAnswerLines = [];
				continue;
			}

			// Skip FSRS comments (legacy) and ID lines
			if (
				line.includes(FLASHCARD_CONFIG.fsrsDataPrefix) ||
				line.match(/^ID:\s*\d+/)
			) {
				continue;
			}

			// Empty line - potential end of card without block ID
			if (line.trim() === "") {
				// If we have a complete card without block ID, save it
				if (currentQuestion && currentAnswerLines.length > 0 && !foundBlockId) {
					const card = this.createNewCard(
						currentQuestion,
						currentAnswerLines.join("\n").trim(),
						currentLineNumber,
						filePath,
						deck,
						sourceNoteName ?? undefined
					);
					flashcards.push(card);
					currentQuestion = "";
					currentAnswerLines = [];
					foundBlockId = false;
				}
				continue;
			}

			// Part of answer
			if (currentQuestion) {
				currentAnswerLines.push(line);
			}
		}

		// Process last card if no block ID
		if (currentQuestion && !foundBlockId) {
			const card = this.createNewCard(
				currentQuestion,
				currentAnswerLines.join("\n").trim(),
				currentLineNumber,
				filePath,
				deck,
				sourceNoteName ?? undefined
			);
			flashcards.push(card);
		}

		return flashcards;
	}

	/**
	 * Create a new card and add it to store
	 * Does NOT add block ID to file yet (will be added on first review)
	 */
	private createNewCard(
		question: string,
		answer: string,
		lineNumber: number,
		filePath: string,
		deck: string,
		sourceNoteName?: string
	): FSRSFlashcardItem {
		const id = this.generateCardId();
		const fsrsData = createDefaultFSRSData(id);

		this.store!.set(id, fsrsData);

		return {
			id,
			question,
			answer,
			lineNumber,
			filePath,
			fsrs: fsrsData,
			deck,
			sourceNoteName,
		};
	}

	/**
	 * Get all unique deck names with their statistics
	 */
	async getAllDecks(): Promise<DeckInfo[]> {
		const allCards = await this.getAllFSRSCards();
		const deckMap = new Map<string, FSRSFlashcardItem[]>();

		for (const card of allCards) {
			const deck = card.deck;
			if (!deckMap.has(deck)) {
				deckMap.set(deck, []);
			}
			deckMap.get(deck)!.push(card);
		}

		const now = new Date();
		const decks: DeckInfo[] = [];

		for (const [name, cards] of deckMap) {
			decks.push({
				name,
				cardCount: cards.length,
				dueCount: cards.filter((c) => {
					const dueDate = new Date(c.fsrs.due);
					return dueDate <= now && c.fsrs.state !== State.New;
				}).length,
				newCount: cards.filter((c) => c.fsrs.state === State.New)
					.length,
			});
		}

		return decks.sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Update FSRS data for a specific card
	 * When store is available, updates store (fast, no file I/O)
	 * Otherwise falls back to inline comment update (legacy)
	 */
	async updateCardFSRS(
		filePath: string,
		cardId: string,
		newFSRSData: FSRSCardData,
		lineNumber: number,
		reviewLogEntry?: CardReviewLogEntry
	): Promise<void> {
		// Fast path: use sharded store
		if (this.hasStore() && this.store) {
			const existing = this.store.get(cardId);
			const entry: ShardEntry = { ...newFSRSData };

			// Append review to history if provided
			if (reviewLogEntry) {
				const history = existing?.history || [];
				history.push(reviewLogEntry);
				// Keep only last 20 entries
				if (history.length > 20) {
					entry.history = history.slice(-20);
				} else {
					entry.history = history;
				}
			} else if (existing?.history) {
				entry.history = existing.history;
			}

			this.store.set(cardId, entry);

			// Ensure block ID exists in file (for new cards created during this session)
			await this.ensureBlockIdInFile(filePath, cardId, lineNumber);

			return;
		}

		// Store is required for updating FSRS data
		throw new FileError(
			"Sharded store not available. Run migration first.",
			filePath,
			"write"
		);
	}

	/**
	 * Ensure block ID exists in file for a card
	 * Adds ^uuid after the answer if not present
	 */
	private async ensureBlockIdInFile(
		filePath: string,
		cardId: string,
		lineNumber: number
	): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return;

		const content = await this.app.vault.read(file);
		const lines = content.split("\n");

		// Find end of card (answer section)
		let insertIndex = lineNumber; // Start after question (lineNumber is 1-based)
		while (insertIndex < lines.length) {
			const line = lines[insertIndex] ?? "";

			// Check if block ID already exists
			if (line.match(/^\^[a-f0-9-]+$/i)) {
				return; // Already has block ID
			}

			// Stop at empty line or next flashcard
			if (line.trim() === "" || this.isFlashcardLine(line)) {
				break;
			}

			insertIndex++;
		}

		// Insert block ID before empty line or at end of answer
		lines.splice(insertIndex, 0, `^${cardId}`);
		await this.app.vault.modify(file, lines.join("\n"));
	}

	/**
	 * Update card content (question and answer) in the file
	 * Used for inline editing during review
	 */
	async updateCardContent(
		filePath: string,
		lineNumber: number,
		newQuestion: string,
		newAnswer: string
	): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) {
			throw new FileError("Flashcard file not found", filePath, "read");
		}

		const content = await this.app.vault.read(file);
		const lines = content.split("\n");
		const questionLineIndex = lineNumber - 1;

		if (questionLineIndex < 0 || questionLineIndex >= lines.length) {
			return;
		}

		// Update question line (preserve #flashcard tag)
		lines[questionLineIndex] = `${newQuestion} ${FLASHCARD_CONFIG.tag}`;

		// Find answer range (from question+1 to empty line, next card, or FSRS comment)
		let answerStartIndex = questionLineIndex + 1;
		let answerEndIndex = answerStartIndex;

		for (let i = answerStartIndex; i < lines.length; i++) {
			const line = lines[i] ?? "";

			// Stop at empty line
			if (line.trim() === "") {
				answerEndIndex = i;
				break;
			}

			// Stop at next flashcard
			if (this.isFlashcardLine(line)) {
				answerEndIndex = i;
				break;
			}

			// Stop at FSRS data (but we need to preserve it)
			if (line.includes(FLASHCARD_CONFIG.fsrsDataPrefix)) {
				answerEndIndex = i;
				break;
			}

			answerEndIndex = i + 1;
		}

		// Get FSRS data line if it exists
		const fsrsLine = lines[answerEndIndex]?.includes(
			FLASHCARD_CONFIG.fsrsDataPrefix
		)
			? lines[answerEndIndex]
			: null;

		// Remove old answer lines
		const linesToRemove = answerEndIndex - answerStartIndex;
		lines.splice(answerStartIndex, linesToRemove);

		// Insert new answer lines
		const newAnswerLines = newAnswer.split("\n");
		lines.splice(answerStartIndex, 0, ...newAnswerLines);

		// Re-add FSRS data if it existed (after new answer)
		if (fsrsLine) {
			const fsrsIndex = answerStartIndex + newAnswerLines.length;
			// Check if FSRS is already there (in case answer didn't change length)
			if (!lines[fsrsIndex]?.includes(FLASHCARD_CONFIG.fsrsDataPrefix)) {
				lines.splice(fsrsIndex, 0, fsrsLine);
			}
		}

		const newContent = lines.join("\n");
		await this.app.vault.modify(file, newContent);
	}


	/**
	 * Generate unique card ID
	 */
	private generateCardId(): string {
		return crypto.randomUUID();
	}

	// ===== Scan Vault Methods =====

	/**
	 * Scan vault for flashcards and add FSRS IDs to new cards
	 * - Scans all flashcard files
	 * - Generates UUID for cards without block ID
	 * - Adds block ID to markdown file
	 * - Saves FSRS data to sharded store
	 * - Removes orphaned cards from store (cards deleted from files)
	 */
	async scanVault(): Promise<ScanResult> {
		if (!this.store) {
			throw new Error("Sharded store not initialized. Please restart Obsidian.");
		}

		let totalCards = 0;
		let newCardsProcessed = 0;
		let filesProcessed = 0;

		// Collect all block IDs found in files
		const foundBlockIds = new Set<string>();

		const folderPath = normalizePath(this.settings.flashcardsFolder);
		const files = this.app.vault.getMarkdownFiles()
			.filter(file =>
				file.path.startsWith(folderPath + "/") &&
				file.name.startsWith(FLASHCARD_CONFIG.filePrefix)
			);

		for (const file of files) {
			const result = await this.scanAndAddIdsToFile(file, foundBlockIds);
			totalCards += result.total;
			newCardsProcessed += result.newIds;
			filesProcessed++;
		}

		// Cleanup: remove orphaned cards from store
		const orphanedRemoved = this.removeOrphanedCards(foundBlockIds);

		// Force save store immediately
		await this.store.saveNow();

		return { totalCards, newCardsProcessed, filesProcessed, orphanedRemoved };
	}

	/**
	 * Scan a single file and add block IDs to cards that don't have them
	 * Also collects all found block IDs into the provided Set
	 */
	private async scanAndAddIdsToFile(
		file: TFile,
		foundBlockIds: Set<string>
	): Promise<{ total: number; newIds: number }> {
		const content = await this.app.vault.read(file);
		const lines = content.split("\n");
		const flashcardPattern = new RegExp(`^(.+?)\\s*${FLASHCARD_CONFIG.tag}\\s*$`);
		const blockIdPattern = /^\^(fsrs-[a-zA-Z0-9]+|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;

		let total = 0;
		let newIds = 0;
		let modified = false;
		let i = 0;

		while (i < lines.length) {
			const line = lines[i] ?? "";
			const flashcardMatch = line.match(flashcardPattern);

			if (flashcardMatch?.[1]) {
				total++;

				// Find end of answer and check for block ID
				let answerEndIndex = i + 1;
				let hasBlockId = false;
				let existingBlockId = "";

				while (answerEndIndex < lines.length) {
					const currentLine = lines[answerEndIndex] ?? "";
					const blockIdMatch = currentLine.match(blockIdPattern);

					if (blockIdMatch?.[1]) {
						hasBlockId = true;
						existingBlockId = blockIdMatch[1];
						foundBlockIds.add(existingBlockId);
						break;
					}

					if (currentLine.trim() === "" || this.isFlashcardLine(currentLine)) {
						break;
					}

					answerEndIndex++;
				}

				if (!hasBlockId) {
					// Generate new ID and create FSRS data
					const id = this.generateCardId();
					const fsrsData = createDefaultFSRSData(id);
					this.store!.set(id, fsrsData);

					// Insert block ID into lines array
					lines.splice(answerEndIndex, 0, `^${id}`);

					// Track the new ID
					foundBlockIds.add(id);

					newIds++;
					modified = true;
					// Increment answerEndIndex to account for inserted line
					answerEndIndex++;
				}

				i = answerEndIndex + 1;
			} else {
				i++;
			}
		}

		// Save modified content back to file
		if (modified) {
			await this.app.vault.modify(file, lines.join("\n"));
		}

		return { total, newIds };
	}

	/**
	 * Remove cards from store that no longer exist in markdown files
	 */
	private removeOrphanedCards(foundBlockIds: Set<string>): number {
		const storeIds = this.store!.keys();
		let removed = 0;

		for (const storeId of storeIds) {
			if (!foundBlockIds.has(storeId)) {
				this.store!.delete(storeId);
				removed++;
			}
		}

		return removed;
	}
}
