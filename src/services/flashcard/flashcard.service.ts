/**
 * Flashcard Manager Service
 * Handles flashcard file operations in the Obsidian vault
 */
import { App, TFile, normalizePath, WorkspaceLeaf } from "obsidian";
import { FLASHCARD_CONFIG } from "../../constants";
import { FileError } from "../../errors";
import type {
	EpistemeSettings,
	FSRSCardData,
	FSRSFlashcardItem,
	DeckInfo,
	CardReviewLogEntry,
	NoteFlashcardType,
	FlashcardItem,
	FlashcardChange,
	CardStore,
	CardAddedEvent,
	CardRemovedEvent,
	CardUpdatedEvent,
	BulkChangeEvent,
} from "../../types";
import { createDefaultFSRSData, State } from "../../types";
import { getEventBus } from "../core/event-bus.service";
import { FrontmatterService } from "./frontmatter.service";
import { FlashcardParserService } from "./flashcard-parser.service";
import { CardMoverService } from "./card-mover.service";

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
 * Service for managing flashcard files in vault
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
	private store: CardStore | null = null;
	private frontmatterService: FrontmatterService;
	private parserService: FlashcardParserService;
	private cardMoverService: CardMoverService;

	constructor(app: App, settings: EpistemeSettings) {
		this.app = app;
		this.settings = settings;
		this.frontmatterService = new FrontmatterService(app);
		this.parserService = new FlashcardParserService();
		this.cardMoverService = new CardMoverService();
	}

	/**
	 * Set the card store for FSRS data
	 */
	setStore(store: CardStore): void {
		this.store = store;
	}

	/**
	 * Check if sharded store is available
	 */
	hasStore(): boolean {
		return this.store !== null && this.store.isReady();
	}

	/**
	 * Set FSRS data for a card (public method for external use)
	 * Used by FlashcardPanelView to ensure data consistency
	 * Prevents overwriting existing FSRS data to avoid duplicates
	 *
	 * @param cardId The card's UUID
	 * @param fsrsData The FSRS data to store
	 */
	setStoreData(cardId: string, fsrsData: FSRSCardData): void {
		if (!this.store) {
			throw new Error("Store not initialized");
		}

		// Only set if not already exists (prevent overwriting existing data)
		const existing = this.store.get(cardId);
		if (existing) {
			console.warn(`Card ${cardId} already exists in store. Skipping to prevent duplicates.`);
			return;
		}

		this.store.set(cardId, fsrsData);
	}

	/**
	 * Update settings reference
	 */
	updateSettings(settings: EpistemeSettings): void {
		this.settings = settings;
	}

	/**
	 * Get the flashcard file path for a source note (legacy method)
	 * Use getFlashcardPathAsync for new code
	 */
	getFlashcardPath(sourceFile: TFile): string {
		const baseName = sourceFile.basename;
		return normalizePath(
			`${this.settings.flashcardsFolder}/${FLASHCARD_CONFIG.filePrefix}${baseName}.md`
		);
	}

	/**
	 * Get flashcard file path by UID
	 */
	getFlashcardPathByUid(uid: string): string {
		return normalizePath(`${this.settings.flashcardsFolder}/${uid}.md`);
	}

	/**
	 * Get flashcard file path for a source note (UID-first, with legacy fallback)
	 */
	async getFlashcardPathAsync(sourceFile: TFile): Promise<string> {
		// Try new UID system first
		const uid = await this.frontmatterService.getSourceNoteUid(sourceFile);
		if (uid) {
			const uidPath = this.getFlashcardPathByUid(uid);
			// Check if UID-based file exists
			if (this.app.vault.getAbstractFileByPath(uidPath)) {
				return uidPath;
			}
			// Check if legacy file exists (backward compat during migration)
			const legacyPath = this.getFlashcardPath(sourceFile);
			if (this.app.vault.getAbstractFileByPath(legacyPath)) {
				return legacyPath;
			}
			// No file exists - prefer UID path for new files
			return uidPath;
		}
		// No UID - use legacy system
		return this.getFlashcardPath(sourceFile);
	}

	/**
	 * Check if a file is a flashcard file (supports both UID and legacy naming)
	 */
	isFlashcardFile(file: TFile): boolean {
		const folderPath = normalizePath(this.settings.flashcardsFolder);
		if (!file.path.startsWith(folderPath + "/")) {
			return false;
		}
		// Legacy: starts with "flashcards_"
		if (file.name.startsWith(FLASHCARD_CONFIG.filePrefix)) {
			return true;
		}
		// New: 8-char hex UID pattern
		const uidPattern = new RegExp(`^[a-f0-9]{${FLASHCARD_CONFIG.uidLength}}\\.md$`, "i");
		return uidPattern.test(file.name);
	}

	/**
	 * Get the frontmatter service for external use
	 */
	getFrontmatterService(): FrontmatterService {
		return this.frontmatterService;
	}

	/**
	 * Get flashcard file info for a source note
	 */
	async getFlashcardInfo(sourceFile: TFile): Promise<FlashcardInfo> {
		const flashcardPath = await this.getFlashcardPathAsync(sourceFile);
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
		const flashcardPath = await this.getFlashcardPathAsync(sourceFile);
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
		const flashcardPath = await this.getFlashcardPathAsync(sourceFile);
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
	 * Ensures source note has flashcard_uid and uses UID-based naming
	 */
	async createFlashcardFile(
		sourceFile: TFile,
		flashcardContent: string
	): Promise<TFile> {
		await this.ensureFolderExists();

		// Ensure source note has flashcard_uid
		let uid = await this.frontmatterService.getSourceNoteUid(sourceFile);
		if (!uid) {
			uid = this.frontmatterService.generateUid();
			await this.frontmatterService.setSourceNoteUid(sourceFile, uid);
		}

		// Use UID-based path
		const flashcardPath = this.getFlashcardPathByUid(uid);
		const frontmatter = this.frontmatterService.generateFrontmatterWithUid(
			sourceFile,
			uid,
			this.frontmatterService.getDefaultDeck()
		);
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
	 * Ensures source note has flashcard_uid and creates FSRS data for new cards
	 */
	async appendFlashcards(
		sourceFile: TFile,
		newFlashcardContent: string
	): Promise<TFile> {
		// Ensure source note has flashcard_uid
		let uid = await this.frontmatterService.getSourceNoteUid(sourceFile);
		if (!uid) {
			uid = this.frontmatterService.generateUid();
			await this.frontmatterService.setSourceNoteUid(sourceFile, uid);
		}

		const flashcardPath = await this.getFlashcardPathAsync(sourceFile);
		const flashcardFile =
			this.app.vault.getAbstractFileByPath(flashcardPath);

		if (!(flashcardFile instanceof TFile)) {
			return await this.createFlashcardFile(
				sourceFile,
				newFlashcardContent
			);
		}

		// Create FSRS data for new cards with block IDs
		this.createFsrsDataForNewCards(newFlashcardContent);

		const existingContent = await this.app.vault.read(flashcardFile);
		const updatedContent =
			existingContent.trimEnd() + "\n\n" + newFlashcardContent;
		await this.app.vault.modify(flashcardFile, updatedContent);

		return flashcardFile;
	}

	/**
	 * Add a single flashcard to an existing file with auto-generated FSRS ID
	 * Returns the full FSRSFlashcardItem for adding to review queue
	 */
	async addSingleFlashcard(
		filePath: string,
		question: string,
		answer: string
	): Promise<FSRSFlashcardItem> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) {
			throw new FileError("Flashcard file not found", filePath, "read");
		}

		// Generate ID and create FSRS data
		const id = this.generateCardId();
		const fsrsData = createDefaultFSRSData(id);
		this.store!.set(id, fsrsData);

		// Get existing content
		const existingContent = await this.app.vault.read(file);

		// Build flashcard content with block ID
		const newCardContent = `${question} ${FLASHCARD_CONFIG.tag}\n${answer}\n^${id}`;

		// Append to file
		const updatedContent = existingContent.trimEnd() + "\n\n" + newCardContent + "\n";
		await this.app.vault.modify(file, updatedContent);

		// Get deck and sourceNoteName from frontmatter
		const deck = this.frontmatterService.extractDeckFromFrontmatter(existingContent);
		const sourceNoteName = this.frontmatterService.extractSourceLinkFromContent(existingContent);

		// Emit event for cross-component reactivity
		getEventBus().emit({
			type: "card:added",
			cardId: id,
			filePath,
			deck: deck || "default",
			sourceNoteName: sourceNoteName ?? undefined,
			timestamp: Date.now(),
		} as CardAddedEvent);

		// Return full card object
		return {
			id,
			question,
			answer,
			filePath,
			fsrs: fsrsData,
			deck: deck || "default",
			sourceNoteName: sourceNoteName ?? undefined,
		};
	}

	/**
	 * Open flashcard file
	 */
	async openFlashcardFile(sourceFile: TFile): Promise<void> {
		const flashcardPath = await this.getFlashcardPathAsync(sourceFile);
		const flashcardFile =
			this.app.vault.getAbstractFileByPath(flashcardPath);

		if (flashcardFile instanceof TFile) {
			const leaf = this.getLeafForFile(flashcardFile);
			await leaf.openFile(flashcardFile);
			this.app.workspace.setActiveLeaf(leaf, { focus: true });
		}
	}

	/**
	 * Open flashcard file at a specific card by its ID
	 */
	async openFlashcardFileAtCard(
		sourceFile: TFile,
		cardId: string
	): Promise<void> {
		const flashcardPath = await this.getFlashcardPathAsync(sourceFile);
		const flashcardFile =
			this.app.vault.getAbstractFileByPath(flashcardPath);

		if (flashcardFile instanceof TFile) {
			await this.openFileAtCard(flashcardFile, cardId);
		}
	}

	/**
	 * Open any file at a specific card by its ID
	 * Finds the card by UUID and navigates to it
	 */
	async openFileAtCard(file: TFile, cardId: string): Promise<void> {
		const content = await this.app.vault.read(file);
		const lineNumber = this.cardMoverService.findCardLineNumber(content, cardId);

		if (lineNumber) {
			await this.openFileAtLine(file, lineNumber);
		} else {
			// Card not found, just open the file
			const leaf = this.getLeafForFile(file);
			await leaf.openFile(file);
			this.app.workspace.setActiveLeaf(leaf, { focus: true });
		}
	}

	/**
	 * Open any file at a specific line (internal helper for navigation)
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
	 * Remove a flashcard from the file by its card ID
	 */
	async removeFlashcard(
		sourceFile: TFile,
		cardId: string
	): Promise<boolean> {
		const flashcardPath = await this.getFlashcardPathAsync(sourceFile);
		const flashcardFile =
			this.app.vault.getAbstractFileByPath(flashcardPath);

		if (!(flashcardFile instanceof TFile)) {
			return false;
		}

		return this.removeFlashcardById(flashcardFile, cardId);
	}

	/**
	 * Remove a flashcard directly from a flashcard file by its UUID
	 */
	async removeFlashcardById(
		flashcardFile: TFile,
		cardId: string
	): Promise<boolean> {
		if (!(flashcardFile instanceof TFile)) {
			return false;
		}

		const content = await this.app.vault.read(flashcardFile);
		const cardData = this.cardMoverService.extractCardById(content, cardId);

		if (!cardData) {
			return false;
		}

		// Remove the card from content using CardMoverService
		const newContent = this.cardMoverService.removeCardFromContent(
			content,
			cardData.startLine,
			cardData.endLine
		);

		await this.app.vault.modify(flashcardFile, newContent);

		// Also remove from store if available
		if (this.store) {
			this.store.delete(cardId);
		}

		// Emit event for cross-component reactivity
		getEventBus().emit({
			type: "card:removed",
			cardId,
			filePath: flashcardFile.path,
			timestamp: Date.now(),
		} as CardRemovedEvent);

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
		const flashcardPath = await this.getFlashcardPathAsync(sourceFile);
		const flashcardFile =
			this.app.vault.getAbstractFileByPath(flashcardPath);

		if (!(flashcardFile instanceof TFile)) {
			throw new FileError(
				"Flashcard file not found",
				flashcardPath,
				"read"
			);
		}

		let content = await this.app.vault.read(flashcardFile);

		// Process DELETED changes first (finds cards by UUID)
		content = this.processDeletedChanges(content, changes);

		// Process MODIFIED changes (finds cards by UUID)
		content = this.processModifiedChanges(content, changes);

		// Process NEW changes (append at end)
		let lines = content.split("\n");
		lines = this.processNewChanges(lines, changes);

		const newContent = lines.join("\n").trimEnd() + "\n";
		await this.app.vault.modify(flashcardFile, newContent);

		// Emit bulk change event for all accepted changes
		const acceptedChanges = changes.filter((c) => c.accepted);
		if (acceptedChanges.length > 0) {
			// Collect card IDs by type (NEW cards don't have IDs until created)
			const deletedIds = acceptedChanges
				.filter((c) => c.type === "DELETED" && c.originalCardId)
				.map((c) => c.originalCardId!);
			const modifiedIds = acceptedChanges
				.filter((c) => c.type === "MODIFIED" && c.originalCardId)
				.map((c) => c.originalCardId!);
			const hasNewCards = acceptedChanges.some((c) => c.type === "NEW");

			// Emit separate events for each type
			if (deletedIds.length > 0) {
				getEventBus().emit({
					type: "cards:bulk-change",
					action: "removed",
					cardIds: deletedIds,
					filePath: flashcardFile.path,
					timestamp: Date.now(),
				} as BulkChangeEvent);
			}
			if (hasNewCards) {
				// New cards don't have IDs yet, but we signal that cards were added
				getEventBus().emit({
					type: "cards:bulk-change",
					action: "added",
					cardIds: [], // IDs not available for new cards
					filePath: flashcardFile.path,
					timestamp: Date.now(),
				} as BulkChangeEvent);
			}
			if (modifiedIds.length > 0) {
				getEventBus().emit({
					type: "cards:bulk-change",
					action: "updated",
					cardIds: modifiedIds,
					filePath: flashcardFile.path,
					timestamp: Date.now(),
				} as BulkChangeEvent);
			}
		}

		return flashcardFile;
	}

	// ===== Private Helper Methods =====

	/**
	 * Create FSRS data for new flashcards with block IDs
	 * Parses the content and creates FSRS entries for any cards with block IDs
	 * that don't already exist in the store
	 */
	private createFsrsDataForNewCards(content: string): void {
		if (!this.store) return;

		const lines = content.split("\n");
		const flashcardPattern = new RegExp(
			`^(.+?)\\s*${FLASHCARD_CONFIG.tag}\\s*$`
		);
		const blockIdPattern = /^\^([a-f0-9-]+)$/i;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i] ?? "";
			const flashcardMatch = line.match(flashcardPattern);

			if (flashcardMatch?.[1]) {
				// Found a flashcard question, look for block ID
				for (let j = i + 1; j < lines.length && j < i + 50; j++) {
					const currentLine = lines[j] ?? "";
					const blockIdMatch = currentLine.match(blockIdPattern);

					if (blockIdMatch?.[1]) {
						const cardId = blockIdMatch[1];

						// Create FSRS data if not in store
						if (!this.store.get(cardId)) {
							const fsrsData = createDefaultFSRSData(cardId);
							this.store.set(cardId, fsrsData);
						}

						break;
					}

					// Stop if we hit another flashcard or empty line (end of card)
					if (flashcardPattern.test(currentLine) || currentLine.trim() === "") {
						break;
					}
				}
			}
		}
	}

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
		return this.parserService.extractFlashcards(content);
	}

	private isFlashcardLine(line: string): boolean {
		return this.parserService.isFlashcardLine(line);
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
		deck: string = this.frontmatterService.getDefaultDeck()
	): string {
		return this.frontmatterService.generateFrontmatter(sourceFile, deck);
	}

	/**
	 * Extract deck name from frontmatter
	 */
	private extractDeckFromFrontmatter(content: string): string {
		return this.frontmatterService.extractDeckFromFrontmatter(content);
	}

	/**
	 * Check if a source note is a Literature Note (has #input/ tags)
	 */
	private async isLiteratureNote(sourceFile: TFile): Promise<boolean> {
		return this.frontmatterService.isLiteratureNote(sourceFile);
	}

	/**
	 * Get note flashcard type based on tags
	 * Determines what kind of flashcards should be created for a note
	 */
	async getNoteFlashcardType(sourceFile: TFile): Promise<NoteFlashcardType> {
		return this.frontmatterService.getNoteFlashcardType(sourceFile);
	}

	/**
	 * Extract all tags from content (inline and frontmatter)
	 */
	private extractAllTags(content: string): string[] {
		return this.frontmatterService.extractAllTags(content);
	}

	/**
	 * Extract source_link from frontmatter
	 * Returns the note name from source_link: "[[NoteName]]"
	 */
	private extractSourceLinkFromContent(content: string): string | null {
		return this.frontmatterService.extractSourceLinkFromContent(content);
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
		content: string,
		changes: FlashcardChange[]
	): string {
		const deletedChanges = changes.filter(
			(c) => c.type === "DELETED" && c.accepted && c.originalCardId
		);

		let newContent = content;
		for (const change of deletedChanges) {
			const cardData = this.cardMoverService.extractCardById(
				newContent,
				change.originalCardId!
			);
			if (cardData) {
				newContent = this.cardMoverService.removeCardFromContent(
					newContent,
					cardData.startLine,
					cardData.endLine
				);
				// Also remove from store
				if (this.store) {
					this.store.delete(change.originalCardId!);
				}
			}
		}

		return newContent;
	}

	private processModifiedChanges(
		content: string,
		changes: FlashcardChange[]
	): string {
		const modifiedChanges = changes.filter(
			(c) => c.type === "MODIFIED" && c.accepted && c.originalCardId
		);

		let newContent = content;
		for (const change of modifiedChanges) {
			const cardData = this.cardMoverService.extractCardById(
				newContent,
				change.originalCardId!
			);
			if (cardData) {
				// Build new card text preserving the original UUID
				const newCardText = this.cardMoverService.buildFlashcardText(
					change.question,
					change.answer,
					change.originalCardId!
				);
				newContent = this.cardMoverService.replaceCardContent(
					newContent,
					cardData.startLine,
					cardData.endLine,
					newCardText
				);
			}
		}

		return newContent;
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
				// Generate block ID immediately
				const cardId = this.generateCardId();

				// Create FSRS data for the new card
				if (this.store) {
					const fsrsData = createDefaultFSRSData(cardId);
					this.store.set(cardId, fsrsData);
				}

				lines.push(`${change.question} ${FLASHCARD_CONFIG.tag}`);
				lines.push(change.answer);
				lines.push(`^${cardId}`);
				lines.push("");
			}
		}

		return lines;
	}

	// ===== Move Card Methods =====

	/**
	 * Move a flashcard from one file to another
	 * Preserves UUID so FSRS data stays intact
	 * Preserves original source_link from source flashcard file (important for Source filter)
	 *
	 * @param cardId - UUID of the flashcard to move
	 * @param sourceFilePath - Path to the source flashcard file
	 * @param targetNotePath - Path to the target note (not flashcard file)
	 * @returns true if successful, false otherwise
	 */
	async moveCard(
		cardId: string,
		sourceFilePath: string,
		targetNotePath: string
	): Promise<boolean> {
		// 1. Get source file
		const sourceFile = this.app.vault.getAbstractFileByPath(sourceFilePath);
		if (!(sourceFile instanceof TFile)) {
			throw new FileError("Source flashcard file not found", sourceFilePath, "read");
		}

		// 2. Extract card data from source file
		const sourceContent = await this.app.vault.read(sourceFile);
		const cardData = this.extractCardById(sourceContent, cardId);
		if (!cardData) {
			throw new FileError(`Flashcard with ID ${cardId} not found in file`, sourceFilePath, "read");
		}

		// 3. Get or create target flashcard file
		const targetNote = this.app.vault.getAbstractFileByPath(targetNotePath);
		if (!(targetNote instanceof TFile)) {
			throw new FileError("Target note not found", targetNotePath, "read");
		}

		const targetFlashcardPath = await this.getFlashcardPathAsync(targetNote);
		let targetFile = this.app.vault.getAbstractFileByPath(targetFlashcardPath);

		// 5. Prepare the flashcard text to add
		const flashcardText = this.cardMoverService.buildFlashcardText(cardData.question, cardData.answer, cardId);

		// 6. Add to target file
		if (targetFile instanceof TFile) {
			// Append the new card to existing file
			const targetContent = await this.app.vault.read(targetFile);
			const newContent = targetContent.trimEnd() + "\n\n" + flashcardText + "\n";
			await this.app.vault.modify(targetFile, newContent);
		} else {
			// Create new flashcard file with source_link pointing to target note
			await this.ensureFolderExists();
			const frontmatter = this.frontmatterService.generateFrontmatter(targetNote, this.frontmatterService.getDefaultDeck());
			const fullContent = frontmatter + flashcardText + "\n";
			await this.app.vault.create(targetFlashcardPath, fullContent);
		}

		// 8. Remove from source file
		const newSourceContent = this.removeCardFromContent(sourceContent, cardData.startLine, cardData.endLine);
		await this.app.vault.modify(sourceFile, newSourceContent);

		return true;
	}

	/**
	 * Extract a flashcard by its UUID from file content
	 * Parses backwards from ^uuid to find the question line with #flashcard
	 */
	private extractCardById(content: string, cardId: string): {
		question: string;
		answer: string;
		startLine: number;
		endLine: number;
	} | null {
		return this.cardMoverService.extractCardById(content, cardId);
	}

	/**
	 * Remove a card from content by line range
	 * Also removes trailing empty lines
	 */
	private removeCardFromContent(content: string, startLine: number, endLine: number): string {
		return this.cardMoverService.removeCardFromContent(content, startLine, endLine);
	}

	// ===== FSRS Methods =====

	/**
	 * Get all flashcards with FSRS data from all flashcard files
	 * Scans all files and handles both existing cards (from store) and new cards (without block ID)
	 */
	async getAllFSRSCards(): Promise<FSRSFlashcardItem[]> {
		if (!this.store) {
			throw new Error(
				"Failed to get all FSRS cards: Sharded store not initialized. Please restart Obsidian."
			);
		}

		const allCards: FSRSFlashcardItem[] = [];

		// Get all flashcard files (supports both UID and legacy naming)
		const files = this.app.vault
			.getMarkdownFiles()
			.filter((file) => this.isFlashcardFile(file));

		for (const file of files) {
			const content = await this.app.vault.read(file);
			const deck = this.extractDeckFromFrontmatter(content);
			const sourceNoteName = this.extractSourceLinkFromContent(content);
			const cards = this.parseAllFlashcards(
				content,
				file.path,
				deck,
				sourceNoteName
			);
			allCards.push(...cards);
		}

		// Force save any new entries created during parsing
		// This ensures data isn't lost if Obsidian is closed before debounced save
		await this.store.saveNow();

		return allCards;
	}

	/**
	 * Parse all flashcards from file content
	 * - Cards with block ID: get FSRS from store
	 * - Cards without block ID: create new FSRS, add to store (block ID will be added by scanVault)
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
						filePath,
						deck,
						sourceNoteName ?? undefined
					);
					flashcards.push(card);
				}

				// Start new card
				currentQuestion = flashcardMatch[1].trim();
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
					// This can happen due to iCloud sync issues or if plugin was closed before save
					console.warn(`[Episteme] Card ${blockId} has block ID but no store entry - creating new FSRS data. File: ${filePath}`);
					fsrsData = createDefaultFSRSData(blockId);
					this.store!.set(blockId, fsrsData);
				}

				flashcards.push({
					id: blockId,
					question: currentQuestion,
					answer: currentAnswerLines.join("\n").trim(),
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
				if (
					currentQuestion &&
					currentAnswerLines.length > 0 &&
					!foundBlockId
				) {
					const card = this.createNewCard(
						currentQuestion,
						currentAnswerLines.join("\n").trim(),
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
	 * Block ID will be added to file by scanVault on next scan
	 */
	private createNewCard(
		question: string,
		answer: string,
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
			filePath,
			fsrs: fsrsData,
			deck,
			sourceNoteName,
		};
	}

	/**
	 * Get all unique deck names with their statistics
	 * @param dayBoundaryService Optional day boundary service for accurate due counts
	 */
	async getAllDecks(
		dayBoundaryService?: import("../core/day-boundary.service").DayBoundaryService
	): Promise<DeckInfo[]> {
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
			// Use day-based scheduling if service provided, otherwise fallback to timestamp
			const dueCount = dayBoundaryService
				? dayBoundaryService.countDueCards(cards, now)
				: cards.filter((c) => {
						const dueDate = new Date(c.fsrs.due);
						return dueDate <= now && c.fsrs.state !== State.New;
					}).length;

			decks.push({
				name,
				cardCount: cards.length,
				dueCount,
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
		reviewLogEntry?: CardReviewLogEntry
	): Promise<void> {
		// Fast path: use card store
		if (this.hasStore() && this.store) {
			const existing = this.store.get(cardId);
			const entry: FSRSCardData = { ...newFSRSData };

			// Append review to history if provided
			if (reviewLogEntry) {
				const history: CardReviewLogEntry[] =
					(existing?.history as CardReviewLogEntry[] | undefined) ||
					[];
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
			await this.ensureBlockIdInFile(filePath, cardId);

			// Emit event for cross-component reactivity
			getEventBus().emit({
				type: "card:updated",
				cardId,
				filePath,
				changes: { fsrs: true },
				timestamp: Date.now(),
			} as CardUpdatedEvent);

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
	 * If the ID is missing, finds the first card without an ID and adds it
	 */
	private async ensureBlockIdInFile(
		filePath: string,
		cardId: string
	): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return;

		const content = await this.app.vault.read(file);

		// Check if block ID already exists in file
		const blockIdPattern = new RegExp(`^\\^${cardId}$`, "im");
		if (blockIdPattern.test(content)) {
			return; // Already has block ID
		}

		// Find the card in the file and add the block ID
		const lines = content.split("\n");
		const flashcardPattern = new RegExp(
			`^(.+?)\\s*${FLASHCARD_CONFIG.tag}\\s*$`
		);
		const existingBlockIdPattern = /^\^[a-zA-Z0-9-]+$/;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i] ?? "";
			if (!flashcardPattern.test(line)) continue;

			// Find end of this card's answer
			let answerEndIndex = i + 1;
			while (answerEndIndex < lines.length) {
				const currentLine = lines[answerEndIndex] ?? "";
				// Stop at empty line, next flashcard, or existing block ID
				if (
					currentLine.trim() === "" ||
					flashcardPattern.test(currentLine) ||
					existingBlockIdPattern.test(currentLine)
				) {
					break;
				}
				answerEndIndex++;
			}

			// Check if this card already has a block ID
			const nextLine = lines[answerEndIndex] ?? "";
			if (existingBlockIdPattern.test(nextLine)) {
				continue; // This card has an ID, check next
			}

			// This card has no ID - add it
			lines.splice(answerEndIndex, 0, `^${cardId}`);
			await this.app.vault.modify(file, lines.join("\n"));
			return;
		}
	}

	/**
	 * Update card content (question and answer) in the file
	 * Used for inline editing during review
	 */
	async updateCardContent(
		filePath: string,
		cardId: string,
		newQuestion: string,
		newAnswer: string
	): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) {
			throw new FileError("Flashcard file not found", filePath, "read");
		}

		const content = await this.app.vault.read(file);
		const cardData = this.cardMoverService.extractCardById(content, cardId);

		if (!cardData) {
			return; // Card not found
		}

		// Build new card text preserving the UUID
		const newCardText = this.cardMoverService.buildFlashcardText(
			newQuestion,
			newAnswer,
			cardId
		);

		// Replace card content
		const newContent = this.cardMoverService.replaceCardContent(
			content,
			cardData.startLine,
			cardData.endLine,
			newCardText
		);

		await this.app.vault.modify(file, newContent);

		// Emit event for cross-component reactivity
		getEventBus().emit({
			type: "card:updated",
			cardId,
			filePath,
			changes: { question: true, answer: true },
			timestamp: Date.now(),
		} as CardUpdatedEvent);
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
			throw new Error(
				"Failed to scan vault: Sharded store not initialized. Please restart Obsidian."
			);
		}

		// Ensure store is fully loaded before scanning
		if (!this.store.isReady()) {
			throw new Error(
				"Failed to scan vault: Store is still loading. Please wait a moment and try again."
			);
		}

		let totalCards = 0;
		let newCardsProcessed = 0;
		let filesProcessed = 0;

		// Collect all block IDs found in files
		const foundBlockIds = new Set<string>();

		// Get all flashcard files (supports both UID and legacy naming)
		const files = this.app.vault
			.getMarkdownFiles()
			.filter((file) => this.isFlashcardFile(file));

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

		return {
			totalCards,
			newCardsProcessed,
			filesProcessed,
			orphanedRemoved,
		};
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
		const flashcardPattern = new RegExp(
			`^(.+?)\\s*${FLASHCARD_CONFIG.tag}\\s*$`
		);
		const blockIdPattern =
			/^\^(fsrs-[a-zA-Z0-9]+|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;

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

						// Ensure store entry exists for cards with block IDs
						// This handles recovery from lost store data (e.g., iCloud sync issues)
						if (!this.store!.has(existingBlockId)) {
							const fsrsData = createDefaultFSRSData(existingBlockId);
							this.store!.set(existingBlockId, fsrsData);
							newIds++;
						}

						break;
					}

					if (
						currentLine.trim() === "" ||
						this.isFlashcardLine(currentLine)
					) {
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
		// Safety check: if no flashcards were found in files, skip cleanup
		// This prevents accidentally removing all cards when scanning fails
		if (foundBlockIds.size === 0) {
			return 0;
		}

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

	// ===== Legacy File Migration Methods =====

	/**
	 * Migrate legacy flashcards_ files to UID-based naming
	 * - Renames files from flashcards_NAME.md to {uid}.md
	 * - Adds flashcard_uid to source notes
	 * - Updates source_uid in flashcard file frontmatter
	 *
	 * @returns Result with count of renamed files and any errors
	 */
	async migrateLegacyFiles(): Promise<{ renamed: number; errors: string[] }> {
		const results = { renamed: 0, errors: [] as string[] };

		// Find all legacy flashcard files
		const files = this.app.vault.getMarkdownFiles().filter((file) =>
			file.name.startsWith(FLASHCARD_CONFIG.filePrefix)
		);

		for (const file of files) {
			try {
				const content = await this.app.vault.read(file);
				const sourceLink = this.frontmatterService.extractSourceLinkFromContent(content);

				if (!sourceLink) {
					results.errors.push(`${file.path}: No source_link found`);
					continue;
				}

				// Find source note
				const sourceFiles = this.app.vault.getMarkdownFiles().filter((f) => f.basename === sourceLink);
				const sourceFile = sourceFiles[0];

				if (!sourceFile) {
					results.errors.push(`${file.path}: Source note not found`);
					continue;
				}

				// Generate UID if source note doesn't have one
				let uid = await this.frontmatterService.getSourceNoteUid(sourceFile);
				if (!uid) {
					uid = this.frontmatterService.generateUid();
					await this.frontmatterService.setSourceNoteUid(sourceFile, uid);
				}

				// Update flashcard file frontmatter with source_uid
				const updatedContent = this.updateFlashcardFrontmatterWithUid(content, uid);

				// Create new UID-based file
				const newPath = this.getFlashcardPathByUid(uid);
				await this.app.vault.create(newPath, updatedContent);

				// Delete old file
				await this.app.vault.delete(file);

				results.renamed++;
			} catch (error) {
				results.errors.push(`${file.path}: ${error}`);
			}
		}

		return results;
	}

	/**
	 * Update flashcard file frontmatter with source_uid
	 * Adds or updates the source_uid field in the frontmatter
	 *
	 * @param content The flashcard file content
	 * @param uid The UID to set as source_uid
	 * @returns Updated content with source_uid in frontmatter
	 */
	private updateFlashcardFrontmatterWithUid(content: string, uid: string): string {
		const uidField = FLASHCARD_CONFIG.flashcardUidField;
		const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
		const match = content.match(frontmatterRegex);

		if (match) {
			const frontmatter = match[1] ?? "";
			if (new RegExp(`^${uidField}:`, "m").test(frontmatter)) {
				// Already has source_uid, update it
				return content.replace(
					frontmatterRegex,
					`---\n${frontmatter.replace(
						new RegExp(`^${uidField}:.*$`, "m"),
						`${uidField}: "${uid}"`
					)}\n---`
				);
			} else {
				// Add source_uid to existing frontmatter
				return content.replace(
					frontmatterRegex,
					`---\n${uidField}: "${uid}"\n${frontmatter}\n---`
				);
			}
		}

		// No frontmatter, create new
		return `---\n${uidField}: "${uid}"\n---\n\n${content}`;
	}
}
