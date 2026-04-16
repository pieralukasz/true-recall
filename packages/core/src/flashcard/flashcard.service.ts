/**
 * Facade for flashcard operations - delegates to specialized services:
 * CardRepository (CRUD), CardQueryService (reads), FrontmatterService,
 * SourceNoteService
 *
 * Platform-agnostic version: uses IFileSystem, IFrontmatter, IMetadataIndex
 * instead of Obsidian's App.
 */

import { FLASHCARD_CONFIG } from "../constants";
import type { DomainEventBus } from "../events/event-bus";
import type { IFileSystem } from "../interfaces/file-system";
import type { IFrontmatter } from "../interfaces/frontmatter";
import type { IMetadataIndex } from "../interfaces/metadata-index";
import type { SqliteStoreService } from "../persistence/sqlite/SqliteStoreService";
import {
	type GeneratedCard,
	generateCardsForNote,
} from "../services/cards/card-generation.service";
import {
	deriveCardType,
	renderTemplate,
} from "../services/cards/template-engine";
import { NoteReviewService } from "../services/note-review/note-review.service";
import type { FrontmatterIndexService } from "../services/notes/frontmatter-index.service";
import type {
	CardReviewLogEntry,
	CardType,
	FlashcardItem,
	FSRSCardData,
	FSRSFlashcardItem,
	TrueRecallSettings,
} from "../types";
import { createDefaultFSRSData } from "../types";
import type { IODefinition } from "../types/image-occlusion.types";
import {
	BUILTIN_IMAGE_OCCLUSION_ID,
	BUILTIN_NOTE_REVIEW_ID,
	type Note,
	type NoteType,
} from "../types/note.types";
import {
	normalizeIOImagePath,
	serializeIODefinition,
} from "../utils/io-definition";
import { CardQueryService } from "./data/card-query.service";
import {
	CardRepository,
	type CreateBatchResult,
} from "./data/card-repository.service";
import type { ISessionPersistence } from "./lifecycle/deletion-handler.service";
import { FrontmatterService } from "./source/frontmatter.service";
import { SourceNoteService } from "./source/source-note.service";

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
	alwaysTypeIn?: boolean;
	sourceUid?: string;
	sourceText?: string;
	createdVia?: string;
	createdAt?: number;
}

export interface CreateNoteResult {
	note: Note;
	cards: FSRSCardData[];
}

export interface UpdateNoteFieldsResult {
	updatedCardIds: string[];
}

export interface ChangeNoteTypeResult {
	keptCardIds: string[];
	createdCardIds: string[];
	deletedCardIds: string[];
}

export interface DeleteFlashcardsResult {
	ok: boolean;
	affectedIds: string[];
	affectedCount: number;
	deletedCardsData: FSRSCardData[];
}

export interface CreateImageOcclusionNoteParams {
	imagePath: string;
	definition: IODefinition;
	sourceUid?: string;
	sourceText?: string;
	createdVia?: string;
}

export interface UpdateImageOcclusionNoteParams {
	imagePath: string;
	definition: IODefinition;
}

export class FlashcardManager {
	private store: SqliteStoreService | null = null;
	private sessionPersistence: ISessionPersistence | null = null;
	private frontmatterService: FrontmatterService;
	private sourceNoteService: SourceNoteService;
	private bus: DomainEventBus | null = null;
	private busWarnLogged = false;

	// Specialized services (initialized after setStore)
	private cardRepository: CardRepository | null = null;
	private cardQueryService: CardQueryService | null = null;
	private _noteReview: NoteReviewService | null = null;

	constructor(
		fileSystem: IFileSystem,
		frontmatter: IFrontmatter,
		_settings: TrueRecallSettings,
		metadataIndex?: IMetadataIndex,
		frontmatterIndex?: FrontmatterIndexService,
	) {
		this.frontmatterService = new FrontmatterService(fileSystem, frontmatter);
		this.sourceNoteService = new SourceNoteService(
			fileSystem,
			frontmatter,
			metadataIndex,
		);
		void frontmatterIndex;
	}

	setEventBus(bus: DomainEventBus): void {
		this.bus = bus;
		this.cardRepository?.setEventBus(bus);
	}

	setStore(store: SqliteStoreService): void {
		this.store = store;
		this.cardRepository = new CardRepository(store);
		if (this.bus) this.cardRepository.setEventBus(this.bus);
		this.cardQueryService = new CardQueryService(store, this.sourceNoteService);
		this._noteReview = new NoteReviewService(store);
	}

	setSessionPersistence(sessionPersistence: ISessionPersistence): void {
		this.sessionPersistence = sessionPersistence;
	}

	hasStore(): boolean {
		return this.store?.isReady() ?? false;
	}

	getCardQueryService(): CardQueryService {
		if (!this.cardQueryService) {
			throw new Error("Store not initialized.");
		}
		return this.cardQueryService;
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

	getNoteTypeBySlug(slug: string): NoteType | null {
		return this.store?.noteTypes.getBySlug(slug) ?? null;
	}

	getNoteTypeById(id: string): NoteType | null {
		return this.store?.noteTypes.getById(id) ?? null;
	}

	getFrontmatterService(): FrontmatterService {
		return this.frontmatterService;
	}

	getSourceNoteService(): SourceNoteService {
		return this.sourceNoteService;
	}

	getEventBus(): DomainEventBus | null {
		return this.bus;
	}

	private emitEvent<K extends import("../events/event-types").DomainEventType>(
		event: K,
		payload: import("../events/event-types").DomainEventMap[K],
	): void {
		if (!this.bus) {
			if (!this.busWarnLogged) {
				console.warn(
					"[FlashcardManager] Event bus not wired — events will not propagate to UI",
				);
				this.busWarnLogged = true;
			}
			return;
		}
		this.bus.emit(event, payload);
	}

	scanVault(): ScanResult {
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

	async getFlashcardInfo(filePath: string): Promise<FlashcardInfo> {
		const sourceUid = await this.frontmatterService.getSourceNoteUid(filePath);

		if (!sourceUid) {
			return this.createEmptyFlashcardInfo();
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
				alwaysTypeIn: c.alwaysTypeIn,
				noteId: c.noteId,
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

	private createEmptyFlashcardInfo(): FlashcardInfo {
		return {
			exists: false,
			cardCount: 0,
			questions: [],
			flashcards: [],
			lastModified: null,
			sourceUid: undefined,
		};
	}

	async extractSourceContent(
		filePath: string,
		fileSystem: IFileSystem,
	): Promise<string | null> {
		try {
			return await fileSystem.read(filePath);
		} catch (error) {
			console.error(
				`[FlashcardManager] Failed to read file ${filePath}:`,
				error,
			);
			return null;
		}
	}

	async saveFlashcardsToSql(
		filePath: string,
		fileBasename: string,
		flashcards: Array<{
			id: string;
			question: string;
			answer: string;
			cardType?: CardType;
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
		let sourceUid = await this.frontmatterService.getSourceNoteUid(filePath);
		if (!sourceUid) {
			sourceUid = this.frontmatterService.generateUid();
			await this.frontmatterService.setSourceNoteUid(filePath, sourceUid);
		}

		return this.cardRepository.createBatch(
			flashcards,
			sourceUid,
			fileBasename,
			createdVia,
			sourceText,
		);
	}

	addSingleFlashcard(
		question: string,
		answer: string,
		sourceUid?: string,
	): FSRSFlashcardItem {
		return this.addSingleFlashcardToSql(question, answer, sourceUid);
	}

	addSingleFlashcardToSql(
		question: string,
		answer: string,
		sourceUid?: string,
	): FSRSFlashcardItem {
		if (!this.cardRepository) {
			throw new Error("Card store not initialized");
		}
		return this.cardRepository.create(question, answer, sourceUid);
	}

	removeFlashcard(cardId: string): boolean {
		return this.removeFlashcardById(cardId);
	}

	removeFlashcardById(cardId: string): boolean {
		const result = this.removeFlashcardByIdWithDetails(cardId);
		return result.ok;
	}

	removeFlashcardByIdWithDetails(cardId: string): DeleteFlashcardsResult {
		if (!this.cardRepository) {
			return {
				ok: false,
				affectedIds: [],
				affectedCount: 0,
				deletedCardsData: [],
			};
		}
		const { removedIds, cardsData } =
			this.cardRepository.deleteWithCascade(cardId);
		if (removedIds.length > 0) {
			this.sessionPersistence?.removeReviewedCards(removedIds);
			return {
				ok: true,
				affectedIds: removedIds,
				affectedCount: removedIds.length,
				deletedCardsData: cardsData,
			};
		}
		return {
			ok: false,
			affectedIds: [],
			affectedCount: 0,
			deletedCardsData: [],
		};
	}

	removeFlashcardsByIds(cardIds: string[]): number {
		const result = this.removeFlashcardsByIdsWithDetails(cardIds);
		return result.affectedCount;
	}

	removeFlashcardsByIdsWithDetails(cardIds: string[]): DeleteFlashcardsResult {
		if (!this.cardRepository) {
			return {
				ok: false,
				affectedIds: [],
				affectedCount: 0,
				deletedCardsData: [],
			};
		}
		const { removedIds, cardsData } =
			this.cardRepository.deleteBatchWithCascade(cardIds);
		if (removedIds.length > 0) {
			this.sessionPersistence?.removeReviewedCards(removedIds);
		}
		return {
			ok: removedIds.length > 0,
			affectedIds: removedIds,
			affectedCount: removedIds.length,
			deletedCardsData: cardsData,
		};
	}

	removeFlashcardFromSql(cardId: string): void {
		void this.removeFlashcardById(cardId);
	}

	getAllFSRSCards(): FSRSFlashcardItem[] {
		if (!this.cardQueryService) {
			throw new Error("Store not initialized.");
		}
		return this.cardQueryService.getAll();
	}

	getCardsByIds(cardIds: string[]): FSRSFlashcardItem[] {
		if (!this.cardQueryService) {
			throw new Error("Store not initialized.");
		}
		return this.cardQueryService.getByIds(cardIds);
	}

	updateCardFSRS(
		cardId: string,
		newFSRSData: FSRSCardData,
		reviewLogEntry?: CardReviewLogEntry,
		options?: { skipNotification?: boolean },
	): boolean {
		if (!this.cardRepository) {
			throw new Error("Store not initialized");
		}
		return this.cardRepository.updateFSRS(
			cardId,
			newFSRSData,
			reviewLogEntry,
			options,
		);
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

		if (!this.cardRepository.has(cardId)) {
			return false;
		}

		let targetSourceUid =
			await this.frontmatterService.getSourceNoteUid(targetNotePath);
		if (!targetSourceUid) {
			targetSourceUid = this.frontmatterService.generateUid();
			await this.frontmatterService.setSourceNoteUid(
				targetNotePath,
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

	// ---- Note-based creation (v26) ----

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
			tags: params.alwaysTypeIn ? [FLASHCARD_CONFIG.alwaysTypeInTag] : [],
			sourceUid: params.sourceUid,
			sourceText: params.sourceText,
			createdVia: params.createdVia ?? "manual",
		};

		this.store.notes.create(note);

		const generated = generateCardsForNote(note, noteType);
		const cards: FSRSCardData[] = [];

		for (const gen of generated) {
			const fsrsData = this.createCardFromGenerated(
				gen,
				note,
				noteType,
				params.createdAt,
			);
			cards.push(fsrsData);
		}

		if (cards.length > 0) {
			this.emitEvent("cards:bulk", {
				cardIds: cards.map((c) => c.id),
				action: "added",
			});
		}

		return { note, cards };
	}

	createImageOcclusionNote(
		params: CreateImageOcclusionNoteParams,
	): CreateNoteResult {
		const imagePath = normalizeIOImagePath(params.imagePath);
		if (!imagePath) {
			throw new Error("Image path is required");
		}

		return this.createNote({
			noteTypeId: BUILTIN_IMAGE_OCCLUSION_ID,
			fields: {
				Image: imagePath,
				Regions: serializeIODefinition(params.definition),
			},
			sourceUid: params.sourceUid,
			sourceText: params.sourceText,
			createdVia: params.createdVia ?? "manual",
		});
	}

	updateImageOcclusionNote(
		noteId: string,
		params: UpdateImageOcclusionNoteParams,
	): UpdateNoteFieldsResult {
		const imagePath = normalizeIOImagePath(params.imagePath);
		if (!imagePath) {
			throw new Error("Image path is required");
		}

		return this.updateNoteFields(noteId, {
			Image: imagePath,
			Regions: serializeIODefinition(params.definition),
		});
	}

	/**
	 * Create multiple Notes from parsed cards in bulk.
	 * Returns all created cards for notification.
	 */
	createNoteBatch(parsedCards: CreateNoteParams[]): {
		notes: Note[];
		cards: FSRSCardData[];
	} {
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
				tags: params.alwaysTypeIn ? [FLASHCARD_CONFIG.alwaysTypeInTag] : [],
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
			this.emitEvent("cards:bulk", {
				cardIds: cards.map((c) => c.id),
				action: "added",
			});
		}

		return { notes, cards };
	}

	// ---- Note-level review ----

	get noteReview(): NoteReviewService {
		if (!this._noteReview) throw new Error("Store not initialized");
		return this._noteReview;
	}

	enableNoteReview(sourceUid: string): CreateNoteResult {
		if (!this.store) {
			throw new Error("Store not initialized");
		}

		const existing = this.noteReview.findNote(sourceUid);
		if (existing) {
			const cards = this.store.cards.getCardsByNoteId(existing.id);
			return { note: existing, cards };
		}

		return this.createNote({
			noteTypeId: BUILTIN_NOTE_REVIEW_ID,
			fields: { Content: "" },
			sourceUid,
			createdVia: "manual",
		});
	}

	disableNoteReview(sourceUid: string): boolean {
		if (!this.store) {
			throw new Error("Store not initialized");
		}

		const existing = this.noteReview.findNote(sourceUid);
		if (!existing) return false;

		const cards = this.store.cards.getCardsByNoteId(existing.id);
		if (cards.length > 0) {
			this.removeFlashcardsByIds(cards.map((c) => c.id));
		}
		this.store.notes.delete(existing.id);
		return true;
	}

	hasNoteReview(sourceUid: string): boolean {
		return this.noteReview.has(sourceUid);
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

		this.store.notes.update(noteId, { fields });

		if (noteType.id === BUILTIN_IMAGE_OCCLUSION_ID) {
			return this.reconcileImageOcclusionCards(note, noteType, fields);
		}

		const updatedNote: Note = { ...note, fields };

		const existingCards = this.store.cards.getCardsByNoteId(noteId);
		const existingOrds = existingCards.map((c) => c.templateOrd ?? 0);
		const newGenerated = generateCardsForNote(
			updatedNote,
			noteType,
			existingOrds,
		);

		const updatedCardIds = existingCards.map((c) => c.id);

		for (const gen of newGenerated) {
			const fsrsData = this.createCardFromGenerated(gen, updatedNote, noteType);
			updatedCardIds.push(fsrsData.id);
		}

		if (updatedCardIds.length > 0) {
			this.emitEvent("cards:bulk", {
				cardIds: updatedCardIds,
			});
		}

		return { updatedCardIds };
	}

	changeNoteType(
		noteId: string,
		newNoteTypeId: string,
		fieldMapping: Record<string, string>,
	): ChangeNoteTypeResult {
		if (!this.store) throw new Error("Store not initialized");

		const note = this.store.notes.getById(noteId);
		if (!note) throw new Error(`Note "${noteId}" not found`);

		const newNoteType = this.store.noteTypes.getById(newNoteTypeId);
		if (!newNoteType) throw new Error(`Note type "${newNoteTypeId}" not found`);

		if (note.noteTypeId === newNoteTypeId) {
			return { keptCardIds: [], createdCardIds: [], deletedCardIds: [] };
		}

		// Remap fields: fieldMapping is newFieldName -> oldFieldName
		const newFields: Record<string, string> = {};
		for (const field of newNoteType.fields) {
			const oldFieldName = fieldMapping[field];
			newFields[field] = oldFieldName ? (note.fields[oldFieldName] ?? "") : "";
		}

		this.store.notes.update(noteId, {
			noteTypeId: newNoteTypeId,
			fields: newFields,
		});

		// Reconcile cards
		const updatedNote: Note = {
			...note,
			noteTypeId: newNoteTypeId,
			fields: newFields,
		};
		const existingCards = this.store.cards.getCardsByNoteId(noteId);
		const existingOrds = new Set(existingCards.map((c) => c.templateOrd ?? 0));

		const desiredGenerated = generateCardsForNote(updatedNote, newNoteType);
		const desiredOrds = new Set(desiredGenerated.map((g) => g.templateOrd));

		// Keep cards whose templateOrd still exists
		const keptCardIds = existingCards
			.filter((c) => desiredOrds.has(c.templateOrd ?? 0))
			.map((c) => c.id);

		const deletedCardIds = existingCards
			.filter((c) => !desiredOrds.has(c.templateOrd ?? 0))
			.map((c) => c.id);

		if (deletedCardIds.length > 0) {
			this.store.cards.bulkSoftDelete(deletedCardIds);
			this.sessionPersistence?.removeReviewedCards(deletedCardIds);
		}

		const createdCardIds: string[] = [];
		for (const gen of desiredGenerated) {
			if (existingOrds.has(gen.templateOrd)) continue;
			const card = this.createCardFromGenerated(gen, updatedNote, newNoteType);
			createdCardIds.push(card.id);
		}

		const allAffectedIds = [
			...keptCardIds,
			...createdCardIds,
			...deletedCardIds,
		];
		if (allAffectedIds.length > 0) {
			this.emitEvent("cards:bulk", { cardIds: allAffectedIds });
		}

		return { keptCardIds, createdCardIds, deletedCardIds };
	}

	private reconcileImageOcclusionCards(
		note: Note,
		noteType: NoteType,
		fields: Record<string, string>,
	): UpdateNoteFieldsResult {
		const updatedNote: Note = { ...note, fields };
		const existingCards = this.store?.cards.getCardsByNoteId(note.id) ?? [];
		const existingOrds = new Set(
			existingCards.map((card) => card.templateOrd ?? 0),
		);

		const desiredGenerated = generateCardsForNote(updatedNote, noteType);
		const desiredOrds = new Set(
			desiredGenerated.map((card) => card.templateOrd),
		);

		// Keep existing cards whose ord still exists in new definition.
		const keptCards = existingCards.filter((card) =>
			desiredOrds.has(card.templateOrd ?? 0),
		);

		const removedCardIds = existingCards
			.filter((card) => !desiredOrds.has(card.templateOrd ?? 0))
			.map((card) => card.id);

		const createdCards: FSRSCardData[] = [];
		for (const gen of desiredGenerated) {
			if (existingOrds.has(gen.templateOrd)) continue;
			createdCards.push(
				this.createCardFromGenerated(gen, updatedNote, noteType),
			);
		}

		if (removedCardIds.length > 0) {
			this.store?.cards.bulkSoftDelete(removedCardIds);
			this.sessionPersistence?.removeReviewedCards(removedCardIds);
			this.emitEvent("cards:bulk", {
				cardIds: removedCardIds,
				action: "removed",
			});
		}

		const updatedCardIds = [
			...keptCards.map((card) => card.id),
			...createdCards.map((card) => card.id),
		];

		if (updatedCardIds.length > 0) {
			this.emitEvent("cards:bulk", {
				cardIds: updatedCardIds,
			});
		}

		return { updatedCardIds };
	}

	private createCardFromGenerated(
		gen: GeneratedCard,
		note: Note,
		noteType: NoteType,
		createdAt?: number,
	): FSRSCardData {
		const template =
			noteType.templates.find((t) => t.ordinal === gen.templateOrd) ??
			noteType.templates[0];
		if (!template)
			throw new Error(`Note type "${noteType.name}" has no templates`);

		const question = renderTemplate(template.qfmt, {
			fields: note.fields,
			clozeIndex: gen.templateOrd,
		});
		const answer = renderTemplate(template.afmt, {
			fields: note.fields,
			frontSide: "",
			clozeIndex: gen.templateOrd,
		});

		const defaultData = createDefaultFSRSData(gen.id);
		const fsrsData: FSRSCardData = {
			...defaultData,
			question,
			answer,
			sourceUid: gen.sourceUid,
			noteId: gen.noteId,
			templateOrd: gen.templateOrd,
			noteTypeId: note.noteTypeId,
			cardType: deriveCardType(noteType, gen.templateOrd),
			createdVia: note.createdVia,
			sourceText: note.sourceText,
			alwaysTypeIn: note.tags.includes(FLASHCARD_CONFIG.alwaysTypeInTag),
			...(createdAt != null && { createdAt }),
		};

		this.store?.set(gen.id, fsrsData);
		return fsrsData;
	}
}
