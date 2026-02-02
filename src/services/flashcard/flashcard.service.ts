/**
 * Facade for flashcard operations - delegates to specialized services:
 * CardRepository (CRUD), CardQueryService (reads), FrontmatterService,
 * SourceNoteService, FlashcardParserService
 */
import { App, TFile, WorkspaceLeaf } from "obsidian";
import type {
	TrueRecallSettings,
	FSRSCardData,
	FSRSFlashcardItem,
	CardReviewLogEntry,
	NoteFlashcardType,
	FlashcardItem,
} from "../../types";
import type { SqliteStoreService } from "../persistence/sqlite/SqliteStoreService";
import { FrontmatterService } from "./frontmatter.service";
import { FlashcardParserService } from "./flashcard-parser.service";
import { SourceNoteService } from "./source-note.service";
import { CardRepository } from "./card-repository.service";
import { CardQueryService } from "./card-query.service";
import type { FrontmatterIndexService } from "../core/frontmatter-index.service";

export interface ScanResult {
	totalCards: number;
	newCardsProcessed: number;
	filesProcessed: number;
	orphanedRemoved: number;
}

export interface FlashcardInfo {
	exists: boolean;
	cardCount: number;
	questions: string[];
	flashcards: FlashcardItem[];
	lastModified: number | null;
	sourceUid?: string;
}

export class FlashcardManager {
	private app: App;
	private settings: TrueRecallSettings;
	private store: SqliteStoreService | null = null;
	private frontmatterService: FrontmatterService;
	private parserService: FlashcardParserService;
	private sourceNoteService: SourceNoteService;

	// Specialized services (initialized after setStore)
	private cardRepository: CardRepository | null = null;
	private cardQueryService: CardQueryService | null = null;

	constructor(app: App, settings: TrueRecallSettings, frontmatterIndex?: FrontmatterIndexService) {
		this.app = app;
		this.settings = settings;
		this.frontmatterService = new FrontmatterService(app);
		this.parserService = new FlashcardParserService();
		this.sourceNoteService = new SourceNoteService(app, frontmatterIndex);
	}

	setStore(store: SqliteStoreService): void {
		this.store = store;
		this.cardRepository = new CardRepository(store);
		this.cardQueryService = new CardQueryService(store, this.sourceNoteService);
	}

	hasStore(): boolean {
		return this.store !== null && this.store.isReady();
	}

	/** Returns true if card was saved, false if skipped (already exists) */
	setStoreData(cardId: string, fsrsData: FSRSCardData): boolean {
		if (!this.cardRepository) {
			throw new Error("Store not initialized");
		}
		return this.cardRepository.setIfNotExists(cardId, fsrsData);
	}

	updateSettings(settings: TrueRecallSettings): void {
		this.settings = settings;
	}

	getFrontmatterService(): FrontmatterService {
		return this.frontmatterService;
	}

	getSourceNoteService(): SourceNoteService {
		return this.sourceNoteService;
	}

	parseFlashcards(content: string): FlashcardItem[] {
		return this.parserService.extractFlashcards(content);
	}

	// ===== Compatibility Methods =====

	/** @deprecated Always returns false - flashcard MD files no longer exist */
	isFlashcardFile(_file: TFile): boolean {
		return false;
	}

	async getNoteFlashcardType(sourceFile: TFile): Promise<NoteFlashcardType> {
		return this.frontmatterService.getNoteFlashcardType(sourceFile);
	}

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

	private getLatestCardTimestamp(cards: FSRSFlashcardItem[]): number | null {
		if (cards.length === 0) return null;
		const timestamps = cards.map(c => c.fsrs.createdAt).filter((t): t is number => t !== undefined);
		if (timestamps.length === 0) return null;
		return Math.max(...timestamps);
	}

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

	// ===== Source Content Methods =====

	async extractSourceContent(sourceFile: TFile): Promise<string | null> {
		try {
			return await this.app.vault.read(sourceFile);
		} catch {
			return null;
		}
	}

	// ===== SQL Card Operations =====

	async saveFlashcardsToSql(
		sourceFile: TFile,
		flashcards: Array<{ id: string; question: string; answer: string }>
	): Promise<FSRSFlashcardItem[]> {
		if (!this.cardRepository) {
			throw new Error("Card store not initialized");
		}

		// Ensure source note has flashcard_uid
		let sourceUid = await this.frontmatterService.getSourceNoteUid(sourceFile);
		if (!sourceUid) {
			sourceUid = this.frontmatterService.generateUid();
			await this.frontmatterService.setSourceNoteUid(sourceFile, sourceUid);
		}

		return this.cardRepository.createBatch(flashcards, sourceUid, sourceFile.basename);
	}

	async addSingleFlashcard(
		question: string,
		answer: string,
		sourceUid?: string
	): Promise<FSRSFlashcardItem> {
		return this.addSingleFlashcardToSql(question, answer, sourceUid);
	}

	async addSingleFlashcardToSql(
		question: string,
		answer: string,
		sourceUid?: string
	): Promise<FSRSFlashcardItem> {
		if (!this.cardRepository) {
			throw new Error("Card store not initialized");
		}
		return this.cardRepository.create(question, answer, sourceUid);
	}

	async removeFlashcard(cardId: string): Promise<boolean> {
		return this.removeFlashcardById(cardId);
	}

	async removeFlashcardById(cardId: string): Promise<boolean> {
		if (!this.cardRepository) {
			return false;
		}
		return this.cardRepository.delete(cardId);
	}

	removeFlashcardFromSql(cardId: string): void {
		this.removeFlashcardById(cardId);
	}

	getAllFSRSCards(): FSRSFlashcardItem[] {
		if (!this.cardQueryService) {
			throw new Error("Store not initialized. Please restart Obsidian.");
		}
		return this.cardQueryService.getAll();
	}

	getCardsByIds(cardIds: string[]): FSRSFlashcardItem[] {
		if (!this.cardQueryService) {
			throw new Error("Store not initialized. Please restart Obsidian.");
		}
		return this.cardQueryService.getByIds(cardIds);
	}

	updateCardFSRS(
		cardId: string,
		newFSRSData: FSRSCardData,
		reviewLogEntry?: CardReviewLogEntry
	): void {
		if (!this.cardRepository) {
			throw new Error("Store not initialized");
		}
		this.cardRepository.updateFSRS(cardId, newFSRSData, reviewLogEntry);
	}

	updateCardContent(cardId: string, newQuestion: string, newAnswer: string): void {
		if (!this.cardRepository) {
			throw new Error("Store not initialized");
		}
		this.cardRepository.updateContent(cardId, newQuestion, newAnswer);
	}

	getFlashcardsBySourceUid(sourceUid: string): FSRSFlashcardItem[] {
		if (!this.cardQueryService) {
			return [];
		}
		return this.cardQueryService.getBySourceUid(sourceUid);
	}

	// ===== Orphaned Cards Methods =====

	getOrphanedCards(): FSRSFlashcardItem[] {
		if (!this.cardQueryService) {
			return [];
		}
		return this.cardQueryService.getOrphaned();
	}

	async assignCardToSourceNote(cardId: string, targetNotePath: string): Promise<boolean> {
		if (!this.cardRepository) {
			throw new Error("Store not initialized");
		}

		// Check card exists
		if (!this.cardRepository.has(cardId)) {
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

		// Update card's source UID (CardRepository emits event)
		return this.cardRepository.updateSourceUid(cardId, targetSourceUid);
	}

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

	// ===== Move Card Methods =====

	async moveCard(
		cardId: string,
		targetNotePath: string
	): Promise<boolean> {
		return this.assignCardToSourceNote(cardId, targetNotePath);
	}

	// ===== Navigation Methods =====

	async openFileAtCard(file: TFile, _cardId: string): Promise<void> {
		const leaf = this.getLeafForFile(file);
		await leaf.openFile(file);
		this.app.workspace.setActiveLeaf(leaf, { focus: true });
	}

	/** @deprecated Use openSourceNote instead */
	async openFlashcardFileAtCard(sourceFile: TFile, _cardId: string): Promise<void> {
		await this.openSourceNote(sourceFile);
	}

	/** @deprecated Use openSourceNote instead */
	async openFlashcardFile(sourceFile: TFile): Promise<void> {
		await this.openSourceNote(sourceFile);
	}

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

	private generateCardId(): string {
		return crypto.randomUUID();
	}
}
