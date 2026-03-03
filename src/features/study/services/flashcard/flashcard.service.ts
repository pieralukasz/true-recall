/**
 * Facade for flashcard operations - delegates to specialized services:
 * CardRepository (CRUD), CardQueryService (reads), FrontmatterService,
 * SourceNoteService, FlashcardParserService
 */

import type { SqliteStoreService } from "@features/core/persistence/sqlite/SqliteStoreService";
import type { FrontmatterIndexService } from "@features/core/services/frontmatter-index.service";
import {
	generateCardsForNote,
	type GeneratedCard,
} from "@features/core/services/card-generation.service";
import {
	renderTemplate,
	deriveCardType,
} from "@features/core/services/template-engine";
import { CardQueryService } from "@features/study/services/flashcard/card-query.service";
import {
	CardRepository,
	type CreateBatchResult,
} from "@features/study/services/flashcard/card-repository.service";
import { FlashcardParserService } from "@features/study/services/flashcard/flashcard-parser.service";
import { FrontmatterService } from "@features/study/services/flashcard/frontmatter.service";
import { SourceNoteService } from "@features/study/services/flashcard/source-note.service";
import { notifyCardChange } from "@shared/services/signals";
import type {
	CardReviewLogEntry,
	FlashcardItem,
	FSRSCardData,
	FSRSFlashcardItem,
	TrueRecallSettings,
} from "@shared/types";
import { createDefaultFSRSData } from "@shared/types";
import type { Note, NoteType } from "@shared/types/note.types";
import { type App, TFile, type WorkspaceLeaf } from "obsidian";

export interface ScanResult {
	totalCards: number;
	newCardsProcessed: number;
	filesProcessed: number;
}

export interface FlashcardInfo {
	exists: boolean;
	cardCount: number;
	questions: string[];
	flashcards: FlashcardItem[];
	lastModified: number | null;
	sourceUid?: string;
}

export interface CreateNoteParams {
	noteTypeId: string;
	fields: Record<string, string>;
	sourceUid?: string;
	sourceText?: string;
	createdVia?: string;
}

export interface CreateNoteResult {
	note: Note;
	cards: FSRSCardData[];
}

export interface UpdateNoteFieldsResult {
	updatedCardIds: string[];
}

export class FlashcardManager {
	private app: App;
	private store: SqliteStoreService | null = null;
	private frontmatterService: FrontmatterService;
	private parserService: FlashcardParserService;
	private sourceNoteService: SourceNoteService;

	// Specialized services (initialized after setStore)
	private cardRepository: CardRepository | null = null;
	private cardQueryService: CardQueryService | null = null;

	constructor(
		app: App,
		_settings: TrueRecallSettings,
		frontmatterIndex?: FrontmatterIndexService,
	) {
		this.app = app;
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
		return this.store?.isReady() ?? false;
	}

	/** Returns true if card was saved, false if skipped (already exists) */
	setStoreData(cardId: string, fsrsData: FSRSCardData): boolean {
		if (!this.cardRepository) {
			throw new Error("Store not initialized");
		}
		return this.cardRepository.setIfNotExists(cardId, fsrsData);
	}

	updateSettings(_settings: TrueRecallSettings): void {
		// Settings consumed by sub-services, not directly by FlashcardManager
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

	async scanVault(): Promise<ScanResult> {
		if (!this.store) {
			throw new Error("Store not initialized");
		}

		const cards = this.getAllFSRSCards();
		return {
			totalCards: cards.length,
			newCardsProcessed: 0,
			filesProcessed: 0,
		};
	}

	async getFlashcardInfo(sourceFile: TFile): Promise<FlashcardInfo> {
		const sourceUid =
			await this.frontmatterService.getSourceNoteUid(sourceFile);

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
				cardType: c.cardType,
				clozeTemplate: c.clozeTemplate,
				clozeIndex: c.clozeIndex,
				reverseOfBatchId: c.reverseOf,
				sourceText: c.sourceText,
			})),
			lastModified: this.getLatestCardTimestamp(cards),
			sourceUid,
		};
	}

	private getLatestCardTimestamp(cards: FSRSFlashcardItem[]): number | null {
		if (cards.length === 0) return null;
		const timestamps = cards
			.map((c) => c.fsrs.createdAt)
			.filter((t): t is number => t !== undefined);
		if (timestamps.length === 0) return null;
		return Math.max(...timestamps);
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

	async extractSourceContent(sourceFile: TFile): Promise<string | null> {
		try {
			return await this.app.vault.read(sourceFile);
		} catch (error) {
			console.error(
				`[FlashcardManager] Failed to read file ${sourceFile.path}:`,
				error,
			);
			return null;
		}
	}

	async saveFlashcardsToSql(
		sourceFile: TFile,
		flashcards: Array<{
			id: string;
			question: string;
			answer: string;
			cardType?: import("@shared/types").CardType;
			clozeTemplate?: string;
			clozeIndex?: number;
			reverseOfBatchId?: string;
			sourceText?: string;
		}>,
		createdVia?: string,
		sourceText?: string,
	): Promise<CreateBatchResult> {
		if (!this.cardRepository) {
			throw new Error("Card store not initialized");
		}

		// Ensure source note has flashcard_uid
		let sourceUid = await this.frontmatterService.getSourceNoteUid(sourceFile);
		if (!sourceUid) {
			sourceUid = this.frontmatterService.generateUid();
			await this.frontmatterService.setSourceNoteUid(sourceFile, sourceUid);
		}

		return this.cardRepository.createBatch(
			flashcards,
			sourceUid,
			sourceFile.basename,
			createdVia,
			sourceText,
		);
	}

	async addSingleFlashcard(
		question: string,
		answer: string,
		sourceUid?: string,
	): Promise<FSRSFlashcardItem> {
		return this.addSingleFlashcardToSql(question, answer, sourceUid);
	}

	async addSingleFlashcardToSql(
		question: string,
		answer: string,
		sourceUid?: string,
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

	removeFlashcardsByIds(cardIds: string[]): number {
		if (!this.cardRepository) return 0;
		return this.cardRepository.deleteBatch(cardIds);
	}

	removeFlashcardFromSql(cardId: string): void {
		void this.removeFlashcardById(cardId);
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
		reviewLogEntry?: CardReviewLogEntry,
	): void {
		if (!this.cardRepository) {
			throw new Error("Store not initialized");
		}
		this.cardRepository.updateFSRS(cardId, newFSRSData, reviewLogEntry);
	}

	updateCardContent(
		cardId: string,
		newQuestion: string,
		newAnswer: string,
	): void {
		if (!this.cardRepository) {
			throw new Error("Store not initialized");
		}
		this.cardRepository.updateContent(cardId, newQuestion, newAnswer);
	}

	updateClozeTemplate(
		sourceUid: string,
		oldTemplate: string,
		newTemplate: string,
		sourceNoteName?: string,
	): void {
		if (!this.cardRepository) {
			throw new Error("Store not initialized");
		}
		this.cardRepository.updateClozeTemplate(
			sourceUid,
			oldTemplate,
			newTemplate,
			sourceNoteName,
		);
	}

	getFlashcardsBySourceUid(sourceUid: string): FSRSFlashcardItem[] {
		if (!this.cardQueryService) {
			return [];
		}
		return this.cardQueryService.getBySourceUid(sourceUid);
	}

	async assignCardToSourceNote(
		cardId: string,
		targetNotePath: string,
	): Promise<boolean> {
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
		let targetSourceUid =
			await this.frontmatterService.getSourceNoteUid(targetNote);
		if (!targetSourceUid) {
			targetSourceUid = this.frontmatterService.generateUid();
			await this.frontmatterService.setSourceNoteUid(
				targetNote,
				targetSourceUid,
			);
		}

		// Update card's source UID (CardRepository calls notifyCardChange)
		return this.cardRepository.updateSourceUid(cardId, targetSourceUid);
	}

	async assignCardsToSourceNote(
		cardIds: string[],
		targetNotePath: string,
	): Promise<number> {
		let successCount = 0;
		for (const cardId of cardIds) {
			const success = await this.assignCardToSourceNote(cardId, targetNotePath);
			if (success) {
				successCount++;
			}
		}
		return successCount;
	}

	async moveCard(cardId: string, targetNotePath: string): Promise<boolean> {
		return this.assignCardToSourceNote(cardId, targetNotePath);
	}

	// ── Note-based creation (v26) ─────────────────────────────

	/**
	 * Create a Note + generate its cards via the note type's templates.
	 * This is the v26 replacement for legacy card creation methods.
	 */
	createNote(params: CreateNoteParams): CreateNoteResult {
		if (!this.store) {
			throw new Error("Store not initialized");
		}

		const noteType = this.store.noteTypes.getById(params.noteTypeId);
		if (!noteType) {
			throw new Error(`Note type "${params.noteTypeId}" not found`);
		}

		const note: Note = {
			id: crypto.randomUUID(),
			noteTypeId: params.noteTypeId,
			fields: params.fields,
			tags: [],
			sourceUid: params.sourceUid,
			sourceText: params.sourceText,
			createdVia: params.createdVia ?? "manual",
		};

		this.store.notes.create(note);

		const generated = generateCardsForNote(note, noteType);
		const cards: FSRSCardData[] = [];

		for (const gen of generated) {
			const fsrsData = this.createCardFromGenerated(gen, note, noteType);
			cards.push(fsrsData);
		}

		if (cards.length > 0) {
			notifyCardChange({
				type: "bulk",
				cardIds: cards.map((c) => c.id),
			});
		}

		return { note, cards };
	}

	/**
	 * Create multiple Notes from parsed cards in bulk.
	 * Returns all created cards for notification.
	 */
	createNoteBatch(
		parsedCards: CreateNoteParams[],
	): { notes: Note[]; cards: FSRSCardData[] } {
		if (!this.store) {
			throw new Error("Store not initialized");
		}

		const notes: Note[] = [];
		const cards: FSRSCardData[] = [];

		for (const params of parsedCards) {
			const noteType = this.store.noteTypes.getById(params.noteTypeId);
			if (!noteType) continue;

			const note: Note = {
				id: crypto.randomUUID(),
				noteTypeId: params.noteTypeId,
				fields: params.fields,
				tags: [],
				sourceUid: params.sourceUid,
				sourceText: params.sourceText,
				createdVia: params.createdVia ?? "manual",
			};

			this.store.notes.create(note);
			notes.push(note);

			const generated = generateCardsForNote(note, noteType);
			for (const gen of generated) {
				cards.push(this.createCardFromGenerated(gen, note, noteType));
			}
		}

		if (cards.length > 0) {
			notifyCardChange({
				type: "bulk",
				cardIds: cards.map((c) => c.id),
			});
		}

		return { notes, cards };
	}

	/**
	 * Update a Note's fields and recompute Q/A for all its cards.
	 * Returns the IDs of cards that were updated.
	 */
	updateNoteFields(
		noteId: string,
		fields: Record<string, string>,
	): UpdateNoteFieldsResult {
		if (!this.store) {
			throw new Error("Store not initialized");
		}

		const note = this.store.notes.getById(noteId);
		if (!note) {
			throw new Error(`Note "${noteId}" not found`);
		}

		const noteType = this.store.noteTypes.getById(note.noteTypeId);
		if (!noteType) {
			throw new Error(`Note type "${note.noteTypeId}" not found`);
		}

		// Update the note
		this.store.notes.update(noteId, { fields });

		// Recompute Q/A for all cards belonging to this note
		// Cards are stored with note_id and template_ord; Q/A is computed at read
		// time via JOIN. But we need to handle incremental card generation if new
		// cloze indices were added.
		const updatedNote: Note = { ...note, fields };

		// Check if new cards need to be generated (e.g. new cloze indices)
		const existingCards = this.store.cards.getCardsByNoteId(noteId);
		const existingOrds = existingCards.map((c) => c.templateOrd ?? 0);
		const newGenerated = generateCardsForNote(
			updatedNote,
			noteType,
			existingOrds,
		);

		const updatedCardIds = existingCards.map((c) => c.id);

		// Create any newly needed cards
		for (const gen of newGenerated) {
			const fsrsData = this.createCardFromGenerated(gen, updatedNote, noteType);
			updatedCardIds.push(fsrsData.id);
		}

		if (updatedCardIds.length > 0) {
			notifyCardChange({
				type: "bulk",
				cardIds: updatedCardIds,
			});
		}

		return { updatedCardIds };
	}

	private createCardFromGenerated(
		gen: GeneratedCard,
		note: Note,
		noteType: NoteType,
	): FSRSCardData {
		const template = noteType.templates.find(
			(t) => t.ordinal === gen.templateOrd,
		) ?? noteType.templates[0]!;

		const question = renderTemplate(template.qfmt, {
			fields: note.fields,
			clozeIndex: gen.templateOrd,
		});
		const answer = renderTemplate(template.afmt, {
			fields: note.fields,
			frontSide: question,
			clozeIndex: gen.templateOrd,
		});

		const fsrsData: FSRSCardData = {
			...createDefaultFSRSData(gen.id),
			question,
			answer,
			sourceUid: gen.sourceUid,
			noteId: gen.noteId,
			templateOrd: gen.templateOrd,
			noteTypeId: note.noteTypeId,
			cardType: deriveCardType(noteType, gen.templateOrd),
			createdVia: note.createdVia,
			sourceText: note.sourceText,
		};

		this.store!.set(gen.id, fsrsData);
		return fsrsData;
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
}
