import type { DomainEventBus } from "../events/event-bus";
import type { IFileSystem } from "../interfaces/file-system";
import type { IFrontmatter } from "../interfaces/frontmatter";
import type { IMetadataIndex } from "../interfaces/metadata-index";
import type { SqliteStoreService } from "../persistence/sqlite/SqliteStoreService";
import { NoteReviewService } from "../services/note-review/note-review.service";
import type { FrontmatterIndexService } from "../services/notes/frontmatter-index.service";
import type {
	CardReviewLogEntry,
	CardType,
	FSRSCardData,
	FSRSFlashcardItem,
	TrueRecallSettings,
} from "../types";
import {
	BUILTIN_NOTE_REVIEW_ID,
	type Note,
	type NoteEditSource,
	type NoteType,
} from "../types/note.types";
import { CardAssignmentService } from "./card-assignment.service";
import { CardLifecycleService } from "./card-lifecycle.service";
import { CardQueryService } from "./data/card-query.service";
import {
	CardRepository,
	type CreateBatchResult,
} from "./data/card-repository.service";
import type {
	ChangeNoteTypeResult,
	CreateImageOcclusionNoteParams,
	CreateNoteParams,
	CreateNoteResult,
	DeleteFlashcardsResult,
	FlashcardInfo,
	ScanResult,
	UpdateImageOcclusionNoteParams,
	UpdateNoteFieldsResult,
} from "./flashcard.types";
import { ImageOcclusionReconciler } from "./image-occlusion-reconciler";
import type { ISessionPersistence } from "./lifecycle/deletion-handler.service";
import { NoteCreationService } from "./note-creation.service";
import { NoteMutationService } from "./note-mutation.service";
import { FrontmatterService } from "./source/frontmatter.service";
import { SourceNoteService } from "./source/source-note.service";

export type {
	ChangeNoteTypeResult,
	CreateImageOcclusionNoteParams,
	CreateNoteParams,
	CreateNoteResult,
	DeleteFlashcardsResult,
	FlashcardInfo,
	ScanResult,
	UpdateImageOcclusionNoteParams,
	UpdateNoteFieldsResult,
} from "./flashcard.types";

export class FlashcardManager {
	private cardLifecycle: CardLifecycleService;
	private cardAssignment: CardAssignmentService;
	private noteCreation: NoteCreationService;
	private imageOcclusion: ImageOcclusionReconciler;
	private noteMutation: NoteMutationService;
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
		const getStore = () => this.store;
		const getRepository = () => this.cardRepository;
		const removeReviewedCards = (ids: string[]) =>
			this.sessionPersistence?.removeReviewedCards(ids);
		const emit: DomainEventBus["emit"] = (event, payload) =>
			this.emitEvent(event, payload);
		this.cardLifecycle = new CardLifecycleService(
			getRepository,
			removeReviewedCards,
		);
		this.cardAssignment = new CardAssignmentService(
			getRepository,
			this.frontmatterService,
		);
		this.noteCreation = new NoteCreationService(getStore, emit);
		this.imageOcclusion = new ImageOcclusionReconciler(
			getStore,
			this.noteCreation,
			(id, fields) => this.noteMutation.updateNoteFields(id, fields),
			removeReviewedCards,
			emit,
		);
		this.noteMutation = new NoteMutationService(
			getStore,
			this.noteCreation,
			this.imageOcclusion,
			removeReviewedCards,
			emit,
		);
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
		return this.cardLifecycle.removeFlashcard(cardId);
	}

	removeFlashcardById(cardId: string): boolean {
		return this.cardLifecycle.removeFlashcardById(cardId);
	}

	removeFlashcardByIdWithDetails(cardId: string): DeleteFlashcardsResult {
		return this.cardLifecycle.removeFlashcardByIdWithDetails(cardId);
	}

	removeFlashcardsByIds(cardIds: string[]): number {
		return this.cardLifecycle.removeFlashcardsByIds(cardIds);
	}

	getCascadeDeleteIds(cardId: string): string[] {
		return this.cardLifecycle.getCascadeDeleteIds(cardId);
	}

	removeFlashcardsByIdsWithDetails(cardIds: string[]): DeleteFlashcardsResult {
		return this.cardLifecycle.removeFlashcardsByIdsWithDetails(cardIds);
	}

	removeFlashcardFromSql(cardId: string): void {
		this.cardLifecycle.removeFlashcardFromSql(cardId);
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
		options?: { skipDuplicateCheck?: boolean; editSource?: NoteEditSource },
	): void {
		if (!this.cardRepository) {
			throw new Error("Store not initialized");
		}
		this.cardRepository.updateContent(cardId, newQuestion, newAnswer, options);
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

	restoreClozeTemplate(
		sourceUid: string,
		currentTemplate: string,
		previousTemplate: string,
		previousSiblingIds: readonly string[],
	): void {
		if (!this.cardRepository) {
			throw new Error("Store not initialized");
		}
		this.cardRepository.restoreClozeTemplate(
			sourceUid,
			currentTemplate,
			previousTemplate,
			previousSiblingIds,
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
		return this.cardAssignment.assignCardToSourceNote(cardId, targetNotePath);
	}

	async assignCardsToSourceNote(
		cardIds: string[],
		targetNotePath: string,
	): Promise<number> {
		return this.cardAssignment.assignCardsToSourceNote(cardIds, targetNotePath);
	}

	async moveCard(cardId: string, targetNotePath: string): Promise<boolean> {
		return this.cardAssignment.moveCard(cardId, targetNotePath);
	}

	createNote(params: CreateNoteParams): CreateNoteResult {
		return this.noteCreation.createNote(params);
	}

	createImageOcclusionNote(
		params: CreateImageOcclusionNoteParams,
	): CreateNoteResult {
		return this.imageOcclusion.createImageOcclusionNote(params);
	}

	updateImageOcclusionNote(
		noteId: string,
		params: UpdateImageOcclusionNoteParams,
	): UpdateNoteFieldsResult {
		return this.imageOcclusion.updateImageOcclusionNote(noteId, params);
	}

	createNoteBatch(parsedCards: CreateNoteParams[]): {
		notes: Note[];
		cards: FSRSCardData[];
	} {
		return this.noteCreation.createNoteBatch(parsedCards);
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

	updateNoteFields(
		noteId: string,
		fields: Record<string, string>,
		editSource: NoteEditSource = "manual",
	): UpdateNoteFieldsResult {
		return this.noteMutation.updateNoteFields(noteId, fields, editSource);
	}

	updateNoteComment(noteId: string, userComment: string): string[] {
		return this.noteMutation.updateNoteComment(noteId, userComment);
	}

	changeNoteType(
		noteId: string,
		newNoteTypeId: string,
		fieldMapping: Record<string, string>,
	): ChangeNoteTypeResult {
		return this.noteMutation.changeNoteType(
			noteId,
			newNoteTypeId,
			fieldMapping,
		);
	}
}
