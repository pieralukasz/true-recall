/**
 * Flashcard Manager Service
 * Handles flashcard operations with SQL-only storage
 * All flashcard content is stored in SQLite, no MD files
 */
import { App, TFile, WorkspaceLeaf } from "obsidian";
import type {
	EpistemeSettings,
	FSRSCardData,
	FSRSFlashcardItem,
	CardReviewLogEntry,
	NoteFlashcardType,
	FlashcardItem,
	FlashcardChange,
	CardAddedEvent,
	CardRemovedEvent,
	CardUpdatedEvent,
	BulkChangeEvent,
} from "../../types";
import type { SqliteStoreService } from "../persistence/sqlite/SqliteStoreService";
import { createDefaultFSRSData, State } from "../../types";
import { getEventBus } from "../core/event-bus.service";
import { FrontmatterService } from "./frontmatter.service";
import { FlashcardParserService } from "./flashcard-parser.service";
import { ImageService } from "../image";

/**
 * Result of scanning vault for flashcards (legacy, kept for compatibility)
 */
export interface ScanResult {
	totalCards: number;
	newCardsProcessed: number;
	filesProcessed: number;
	orphanedRemoved: number;
}

/**
 * Flashcard file information (adapted for SQL storage)
 */
export interface FlashcardInfo {
	exists: boolean;
	cardCount: number;
	questions: string[];
	flashcards: FlashcardItem[];
	lastModified: number | null;
	sourceUid?: string;
}

/**
 * Service for managing flashcards with SQL-only storage
 */
export class FlashcardManager {
	private app: App;
	private settings: EpistemeSettings;
	private store: SqliteStoreService | null = null;
	private frontmatterService: FrontmatterService;
	private parserService: FlashcardParserService;

	constructor(app: App, settings: EpistemeSettings) {
		this.app = app;
		this.settings = settings;
		this.frontmatterService = new FrontmatterService(app);
		this.parserService = new FlashcardParserService();
	}

	/**
	 * Set the card store for FSRS data
	 */
	setStore(store: SqliteStoreService): void {
		this.store = store;
	}

	/**
	 * Check if store is available
	 */
	hasStore(): boolean {
		return this.store !== null && this.store.isReady();
	}

	/**
	 * Set FSRS data for a card (public method for external use)
	 * Prevents overwriting existing FSRS data to avoid duplicates
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
	 * Get FrontmatterService (for source note operations)
	 */
	getFrontmatterService(): FrontmatterService {
		return this.frontmatterService;
	}

	/**
	 * Parse flashcards from markdown content
	 * Used for migration and AI response parsing
	 */
	parseFlashcards(content: string): FlashcardItem[] {
		return this.parserService.extractFlashcards(content);
	}

	// ===== Compatibility Methods (for backward compatibility) =====

	/**
	 * Check if a file is a flashcard file
	 * Always returns false since we no longer have flashcard MD files
	 * Kept for file-menu handler to filter out flashcard files (legacy)
	 */
	isFlashcardFile(_file: TFile): boolean {
		return false;
	}

	/**
	 * Get note flashcard type based on tags
	 */
	async getNoteFlashcardType(sourceFile: TFile): Promise<NoteFlashcardType> {
		return this.frontmatterService.getNoteFlashcardType(sourceFile);
	}

	/**
	 * Scan vault - returns SQL card count (no file scanning)
	 * Kept for API compatibility
	 */
	async scanVault(): Promise<ScanResult> {
		if (!this.store) {
			throw new Error("Store not initialized");
		}

		const cards = await this.getAllFSRSCards();
		return {
			totalCards: cards.length,
			newCardsProcessed: 0,
			filesProcessed: 0,
			orphanedRemoved: 0,
		};
	}

	// ===== Flashcard Info Methods =====

	/**
	 * Get flashcard info for a source note (from SQL)
	 */
	async getFlashcardInfo(sourceFile: TFile): Promise<FlashcardInfo> {
		const sourceUid = await this.frontmatterService.getSourceNoteUid(sourceFile);

		if (!sourceUid) {
			return this.createEmptyFlashcardInfo(sourceFile);
		}

		const cards = this.getFlashcardsBySourceUid(sourceUid);

		return {
			exists: cards.length > 0,
			cardCount: cards.length,
			questions: cards.map((c) => c.question),
			flashcards: cards.map((c) => ({
				id: c.id,
				question: c.question,
				answer: c.answer,
			})),
			lastModified: this.getLatestCardTimestamp(cards),
			sourceUid,
		};
	}

	/**
	 * Get the latest creation timestamp from a list of cards
	 */
	private getLatestCardTimestamp(cards: FSRSFlashcardItem[]): number | null {
		if (cards.length === 0) return null;
		const timestamps = cards.map(c => c.fsrs.createdAt).filter((t): t is number => t !== undefined);
		if (timestamps.length === 0) return null;
		return Math.max(...timestamps);
	}

	/**
	 * Get flashcard info directly (same as getFlashcardInfo for SQL)
	 */
	async getFlashcardInfoDirect(sourceFile: TFile): Promise<FlashcardInfo> {
		return this.getFlashcardInfo(sourceFile);
	}

	private createEmptyFlashcardInfo(_sourceFile: TFile): FlashcardInfo {
		return {
			exists: false,
			cardCount: 0,
			questions: [],
			flashcards: [],
			lastModified: null,
			sourceUid: undefined,
		};
	}

	// ===== Source Content Methods (for AI generation) =====

	/**
	 * Extract source note content (reads the actual note content)
	 */
	async extractSourceContent(sourceFile: TFile): Promise<string | null> {
		try {
			return await this.app.vault.read(sourceFile);
		} catch {
			return null;
		}
	}

	// ===== SQL-Only Card Operations =====

	/**
	 * Save flashcards directly to SQL database
	 * Used after AI generation
	 */
	async saveFlashcardsToSql(
		sourceFile: TFile,
		flashcards: Array<{ id: string; question: string; answer: string }>
	): Promise<FSRSFlashcardItem[]> {
		if (!this.store) {
			throw new Error("Card store not initialized");
		}

		// Ensure source note has flashcard_uid
		let sourceUid = await this.frontmatterService.getSourceNoteUid(sourceFile);
		if (!sourceUid) {
			sourceUid = this.frontmatterService.generateUid();
			await this.frontmatterService.setSourceNoteUid(sourceFile, sourceUid);
		}

		// Create source note entry in SQL (v15: only UID + timestamps)
		this.store.sourceNotes.upsertSourceNote(sourceUid);

		const createdCards: FSRSFlashcardItem[] = [];

		for (const flashcard of flashcards) {
			const fsrsData = createDefaultFSRSData(flashcard.id);

			const extendedData: FSRSCardData = {
				...fsrsData,
				question: flashcard.question,
				answer: flashcard.answer,
				sourceUid: sourceUid,
			};

			this.store.set(flashcard.id, extendedData);

			// Sync image references for the new card
			this.syncCardImageRefs(flashcard.id, flashcard.question, flashcard.answer);

			const card: FSRSFlashcardItem = {
				id: flashcard.id,
				question: flashcard.question,
				answer: flashcard.answer,
				fsrs: extendedData,
				projects: [],
				sourceNoteName: sourceFile.basename,
				sourceUid: sourceUid,
			};

			createdCards.push(card);

			getEventBus().emit({
				type: "card:added",
				cardId: flashcard.id,
				sourceNoteName: sourceFile.basename,
				timestamp: Date.now(),
			} as CardAddedEvent);
		}

		return createdCards;
	}

	/**
	 * Add a single flashcard to SQL
	 * Alias for addSingleFlashcardToSql
	 */
	async addSingleFlashcard(
		question: string,
		answer: string,
		sourceUid?: string
	): Promise<FSRSFlashcardItem> {
		return this.addSingleFlashcardToSql(question, answer, sourceUid);
	}

	/**
	 * Add a single flashcard to SQL
	 */
	async addSingleFlashcardToSql(
		question: string,
		answer: string,
		sourceUid?: string
	): Promise<FSRSFlashcardItem> {
		if (!this.store) {
			throw new Error("Card store not initialized");
		}

		// Check for duplicate question
		const existingCardId = this.store.cards.getCardIdByQuestion(question);
		if (existingCardId) {
			throw new Error("A card with this question already exists");
		}

		const cardId = this.generateCardId();
		const fsrsData = createDefaultFSRSData(cardId);

		const extendedData: FSRSCardData = {
			...fsrsData,
			question,
			answer,
			sourceUid,
		};

		this.store.set(cardId, extendedData);

		// Sync image references for the new card
		this.syncCardImageRefs(cardId, question, answer);

		const card: FSRSFlashcardItem = {
			id: cardId,
			question,
			answer,
			fsrs: extendedData,
			projects: [],
			sourceUid,
		};

		getEventBus().emit({
			type: "card:added",
			cardId,
			timestamp: Date.now(),
		} as CardAddedEvent);

		return card;
	}

	/**
	 * Remove a flashcard by ID
	 * Alias for removeFlashcardById
	 */
	async removeFlashcard(cardId: string): Promise<boolean> {
		return this.removeFlashcardById(cardId);
	}

	/**
	 * Remove a flashcard directly by ID
	 */
	async removeFlashcardById(cardId: string): Promise<boolean> {
		if (!this.store) {
			return false;
		}

		const card = this.store.get(cardId);
		if (!card) {
			return false;
		}

		// Soft delete card with cascade (also soft-deletes review_log and card_image_refs)
		this.store.cards.softDeleteWithCascade(cardId);

		getEventBus().emit({
			type: "card:removed",
			cardId,
			timestamp: Date.now(),
		} as CardRemovedEvent);

		return true;
	}

	/**
	 * Remove a flashcard from SQL (alias)
	 */
	removeFlashcardFromSql(cardId: string): void {
		this.removeFlashcardById(cardId);
	}

	/**
	 * Get all flashcards from SQL
	 */
	async getAllFSRSCards(): Promise<FSRSFlashcardItem[]> {
		if (!this.store) {
			throw new Error("Store not initialized. Please restart Obsidian.");
		}

		const cardsWithContent = this.store.getCardsWithContent();

		return cardsWithContent
			.filter((card): card is FSRSCardData & { question: string; answer: string } =>
				Boolean(card.question && card.answer)
			)
			.map((card) => ({
				id: card.id,
				question: card.question,
				answer: card.answer,
				fsrs: card,
				projects: card.projects || [],
				sourceNoteName: card.sourceNoteName,
				sourceUid: card.sourceUid,
				sourceNotePath: card.sourceNotePath,
			}));
	}

	/**
	 * Update FSRS data for a card
	 */
	updateCardFSRS(
		cardId: string,
		newFSRSData: FSRSCardData,
		reviewLogEntry?: CardReviewLogEntry
	): void {
		if (!this.store) {
			throw new Error("Store not initialized");
		}

		const existing = this.store.get(cardId);
		const entry: FSRSCardData = { ...newFSRSData };

		// Append review to history if provided
		if (reviewLogEntry) {
			const history: CardReviewLogEntry[] =
				(existing?.history as CardReviewLogEntry[] | undefined) || [];
			history.push(reviewLogEntry);
			// Keep only last 20 entries
			entry.history = history.length > 20 ? history.slice(-20) : history;
		} else if (existing?.history) {
			entry.history = existing.history;
		}

		// Preserve question/answer if not in newFSRSData
		if (existing?.question && !entry.question) {
			entry.question = existing.question;
		}
		if (existing?.answer && !entry.answer) {
			entry.answer = existing.answer;
		}
		if (existing?.sourceUid && !entry.sourceUid) {
			entry.sourceUid = existing.sourceUid;
		}

		this.store.set(cardId, entry);

		getEventBus().emit({
			type: "card:updated",
			cardId,
			changes: { fsrs: true },
			timestamp: Date.now(),
		} as CardUpdatedEvent);
	}

	/**
	 * Update card content (question and answer) in SQL
	 */
	updateCardContent(cardId: string, newQuestion: string, newAnswer: string): void {
		if (!this.store) {
			throw new Error("Store not initialized");
		}

		const existing = this.store.get(cardId);
		if (!existing) {
			throw new Error(`Card ${cardId} not found`);
		}

		const updated: FSRSCardData = {
			...existing,
			question: newQuestion,
			answer: newAnswer,
		};

		this.store.set(cardId, updated);

		// Sync image references
		this.syncCardImageRefs(cardId, newQuestion, newAnswer);

		getEventBus().emit({
			type: "card:updated",
			cardId,
			changes: { question: true, answer: true },
			timestamp: Date.now(),
		} as CardUpdatedEvent);
	}

	/**
	 * Sync image references for a card based on its content
	 */
	private syncCardImageRefs(cardId: string, question: string, answer: string): void {
		if (!this.store) return;

		const imageService = new ImageService(this.app);
		const questionRefs = imageService.extractImageRefs(question);
		const answerRefs = imageService.extractImageRefs(answer);

		this.store.sourceNotes.syncCardImageRefs(cardId, questionRefs, answerRefs);
	}

	/**
	 * Get flashcards by source note UID
	 * v15: Projects are resolved from frontmatter at runtime (not stored in DB)
	 */
	getFlashcardsBySourceUid(sourceUid: string): FSRSFlashcardItem[] {
		if (!this.store) {
			return [];
		}

		const cards = this.store.getCardsBySourceUid(sourceUid);

		return cards
			.filter((card): card is FSRSCardData & { question: string; answer: string } =>
				Boolean(card.question && card.answer)
			)
			.map((card) => ({
				id: card.id,
				question: card.question,
				answer: card.answer,
				fsrs: card,
				projects: card.projects || [],
				sourceUid: card.sourceUid,
			}));
	}

	// ===== Orphaned Cards Methods =====

	/**
	 * Get all orphaned cards (cards without source_uid)
	 */
	getOrphanedCards(): FSRSFlashcardItem[] {
		if (!this.store) {
			return [];
		}

		const cards = this.store.getOrphanedCards();

		return cards
			.filter((card): card is FSRSCardData & { question: string; answer: string } =>
				Boolean(card.question && card.answer)
			)
			.map((card) => ({
				id: card.id,
				question: card.question,
				answer: card.answer,
				fsrs: card,
				projects: card.projects || [],
				sourceUid: undefined,
			}));
	}

	/**
	 * Assign a card to a source note
	 * @param cardId - The card ID to assign
	 * @param targetNotePath - Path to the target note
	 * @returns true if successful
	 */
	async assignCardToSourceNote(cardId: string, targetNotePath: string): Promise<boolean> {
		if (!this.store) {
			throw new Error("Store not initialized");
		}

		const existing = this.store.get(cardId);
		if (!existing) {
			return false;
		}

		// Get target note
		const targetNote = this.app.vault.getAbstractFileByPath(targetNotePath);
		if (!(targetNote instanceof TFile)) {
			return false;
		}

		// Get or create source UID for target note
		let targetSourceUid = await this.frontmatterService.getSourceNoteUid(targetNote);
		if (!targetSourceUid) {
			targetSourceUid = this.frontmatterService.generateUid();
			await this.frontmatterService.setSourceNoteUid(targetNote, targetSourceUid);
		}

		// Ensure source note entry exists in SQL (v15: only UID + timestamps)
		this.store.sourceNotes.upsertSourceNote(targetSourceUid);

		// Update card's source UID
		this.store.cards.updateCardSourceUid(cardId, targetSourceUid);

		getEventBus().emit({
			type: "card:updated",
			cardId,
			changes: { sourceUid: true },
			timestamp: Date.now(),
		} as CardUpdatedEvent);

		return true;
	}

	/**
	 * Assign multiple cards to a source note
	 * @param cardIds - Array of card IDs to assign
	 * @param targetNotePath - Path to the target note
	 * @returns Number of successfully assigned cards
	 */
	async assignCardsToSourceNote(cardIds: string[], targetNotePath: string): Promise<number> {
		let successCount = 0;
		for (const cardId of cardIds) {
			const success = await this.assignCardToSourceNote(cardId, targetNotePath);
			if (success) {
				successCount++;
			}
		}
		return successCount;
	}

	// ===== Diff Methods (SQL-based) =====

	/**
	 * Apply accepted diff changes to SQL
	 * - DELETED: remove card from SQL
	 * - MODIFIED: update question/answer in SQL
	 * - NEW: add new card to SQL
	 */
	async applyDiffChanges(
		sourceFile: TFile,
		changes: FlashcardChange[],
		_existingFlashcards: FlashcardItem[]
	): Promise<void> {
		if (!this.store) {
			throw new Error("Store not initialized");
		}

		// Get source UID for new cards
		let sourceUid = await this.frontmatterService.getSourceNoteUid(sourceFile);
		if (!sourceUid) {
			sourceUid = this.frontmatterService.generateUid();
			await this.frontmatterService.setSourceNoteUid(sourceFile, sourceUid);
		}

		// Process DELETED changes
		const deletedChanges = changes.filter((c) => c.type === "DELETED" && c.accepted && c.originalCardId);
		for (const change of deletedChanges) {
			await this.removeFlashcardById(change.originalCardId!);
		}

		// Process MODIFIED changes
		const modifiedChanges = changes.filter((c) => c.type === "MODIFIED" && c.accepted && c.originalCardId);
		for (const change of modifiedChanges) {
			this.updateCardContent(change.originalCardId!, change.question, change.answer);
		}

		// Process NEW changes
		const newChanges = changes.filter((c) => c.type === "NEW" && c.accepted);
		for (const change of newChanges) {
			await this.addSingleFlashcardToSql(change.question, change.answer, sourceUid);
		}

		// Emit bulk change events
		if (deletedChanges.length > 0) {
			getEventBus().emit({
				type: "cards:bulk-change",
				action: "removed",
				cardIds: deletedChanges.map((c) => c.originalCardId!),
				timestamp: Date.now(),
			} as BulkChangeEvent);
		}
		if (newChanges.length > 0) {
			getEventBus().emit({
				type: "cards:bulk-change",
				action: "added",
				cardIds: [],
				timestamp: Date.now(),
			} as BulkChangeEvent);
		}
		if (modifiedChanges.length > 0) {
			getEventBus().emit({
				type: "cards:bulk-change",
				action: "updated",
				cardIds: modifiedChanges.map((c) => c.originalCardId!),
				timestamp: Date.now(),
			} as BulkChangeEvent);
		}
	}

	// ===== Move Card Methods (SQL-based) =====

	/**
	 * Move a flashcard to a different source note
	 *
	 * @param cardId - UUID of the flashcard to move
	 * @param targetNotePath - Path to the target note
	 * @returns true if successful, false otherwise
	 */
	async moveCard(
		cardId: string,
		targetNotePath: string
	): Promise<boolean> {
		if (!this.store) {
			throw new Error("Store not initialized");
		}

		const existing = this.store.get(cardId);
		if (!existing) {
			return false;
		}

		// Get target note to determine deck and source UID
		const targetNote = this.app.vault.getAbstractFileByPath(targetNotePath);
		if (!(targetNote instanceof TFile)) {
			return false;
		}

		// Get or create source UID for target note
		let targetSourceUid = await this.frontmatterService.getSourceNoteUid(targetNote);
		if (!targetSourceUid) {
			targetSourceUid = this.frontmatterService.generateUid();
			await this.frontmatterService.setSourceNoteUid(targetNote, targetSourceUid);
		}

		// Update card's source UID
		const updated: FSRSCardData = {
			...existing,
			sourceUid: targetSourceUid,
		};

		this.store.set(cardId, updated);

		getEventBus().emit({
			type: "card:updated",
			cardId,
			changes: { sourceUid: true },
			timestamp: Date.now(),
		} as CardUpdatedEvent);

		return true;
	}

	// ===== Navigation Methods =====

	/**
	 * Open source note at card reference (if possible)
	 * Since cards are in SQL, we open the source note
	 */
	async openFileAtCard(file: TFile, _cardId: string): Promise<void> {
		const leaf = this.getLeafForFile(file);
		await leaf.openFile(file);
		this.app.workspace.setActiveLeaf(leaf, { focus: true });
	}

	/**
	 * Open flashcard file at a specific card (opens source note instead)
	 * @deprecated Use openSourceNote instead
	 */
	async openFlashcardFileAtCard(sourceFile: TFile, _cardId: string): Promise<void> {
		await this.openSourceNote(sourceFile);
	}

	/**
	 * Open flashcard file (opens source note instead)
	 * @deprecated Use openSourceNote instead
	 */
	async openFlashcardFile(sourceFile: TFile): Promise<void> {
		await this.openSourceNote(sourceFile);
	}

	/**
	 * Open source note
	 */
	async openSourceNote(sourceFile: TFile): Promise<void> {
		const leaf = this.getLeafForFile(sourceFile);
		await leaf.openFile(sourceFile);
		this.app.workspace.setActiveLeaf(leaf, { focus: true });
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

	/**
	 * Generate unique card ID
	 */
	private generateCardId(): string {
		return crypto.randomUUID();
	}
}
