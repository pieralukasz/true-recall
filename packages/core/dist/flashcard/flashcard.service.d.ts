/**
 * Facade for flashcard operations - delegates to specialized services:
 * CardRepository (CRUD), CardQueryService (reads), FrontmatterService,
 * SourceNoteService
 *
 * Platform-agnostic version: uses IFileSystem, IFrontmatter, IMetadataIndex
 * instead of Obsidian's App.
 */
import type { DomainEventBus } from "../events/event-bus";
import type { IFileSystem } from "../interfaces/file-system";
import type { IFrontmatter } from "../interfaces/frontmatter";
import type { IMetadataIndex } from "../interfaces/metadata-index";
import type { SqliteStoreService } from "../persistence/sqlite/SqliteStoreService";
import { NoteReviewService } from "../services/note-review/note-review.service";
import type { FrontmatterIndexService } from "../services/notes/frontmatter-index.service";
import type { CardReviewLogEntry, CardType, FlashcardItem, FSRSCardData, FSRSFlashcardItem, TrueRecallSettings } from "../types";
import type { IODefinition } from "../types/image-occlusion.types";
import { type Note, type NoteType } from "../types/note.types";
import { CardQueryService } from "./data/card-query.service";
import { type CreateBatchResult } from "./data/card-repository.service";
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
export declare class FlashcardManager {
    private store;
    private sessionPersistence;
    private frontmatterService;
    private sourceNoteService;
    private bus;
    private busWarnLogged;
    private cardRepository;
    private cardQueryService;
    private _noteReview;
    constructor(fileSystem: IFileSystem, frontmatter: IFrontmatter, _settings: TrueRecallSettings, metadataIndex?: IMetadataIndex, frontmatterIndex?: FrontmatterIndexService);
    setEventBus(bus: DomainEventBus): void;
    setStore(store: SqliteStoreService): void;
    setSessionPersistence(sessionPersistence: ISessionPersistence): void;
    hasStore(): boolean;
    getCardQueryService(): CardQueryService;
    /** Returns true if card was saved, false if skipped (already exists) */
    setStoreData(cardId: string, fsrsData: FSRSCardData): boolean;
    updateSettings(_settings: TrueRecallSettings): void;
    getNoteTypeBySlug(slug: string): NoteType | null;
    getNoteTypeById(id: string): NoteType | null;
    getFrontmatterService(): FrontmatterService;
    getSourceNoteService(): SourceNoteService;
    getEventBus(): DomainEventBus | null;
    private emitEvent;
    scanVault(): ScanResult;
    getFlashcardInfo(filePath: string): Promise<FlashcardInfo>;
    private getLatestCardTimestamp;
    private createEmptyFlashcardInfo;
    extractSourceContent(filePath: string, fileSystem: IFileSystem): Promise<string | null>;
    saveFlashcardsToSql(filePath: string, fileBasename: string, flashcards: Array<{
        id: string;
        question: string;
        answer: string;
        cardType?: CardType;
        clozeTemplate?: string;
        clozeIndex?: number;
        reverseOfBatchId?: string;
        sourceText?: string;
    }>, createdVia?: string, sourceText?: string): Promise<CreateBatchResult>;
    addSingleFlashcard(question: string, answer: string, sourceUid?: string): FSRSFlashcardItem;
    addSingleFlashcardToSql(question: string, answer: string, sourceUid?: string): FSRSFlashcardItem;
    removeFlashcard(cardId: string): boolean;
    removeFlashcardById(cardId: string): boolean;
    removeFlashcardByIdWithDetails(cardId: string): DeleteFlashcardsResult;
    removeFlashcardsByIds(cardIds: string[]): number;
    removeFlashcardsByIdsWithDetails(cardIds: string[]): DeleteFlashcardsResult;
    removeFlashcardFromSql(cardId: string): void;
    getAllFSRSCards(): FSRSFlashcardItem[];
    getCardsByIds(cardIds: string[]): FSRSFlashcardItem[];
    updateCardFSRS(cardId: string, newFSRSData: FSRSCardData, reviewLogEntry?: CardReviewLogEntry, options?: {
        skipNotification?: boolean;
    }): boolean;
    updateCardContent(cardId: string, newQuestion: string, newAnswer: string): void;
    updateClozeTemplate(sourceUid: string, oldTemplate: string, newTemplate: string, sourceNoteName?: string): void;
    getFlashcardsBySourceUid(sourceUid: string): FSRSFlashcardItem[];
    assignCardToSourceNote(cardId: string, targetNotePath: string): Promise<boolean>;
    assignCardsToSourceNote(cardIds: string[], targetNotePath: string): Promise<number>;
    moveCard(cardId: string, targetNotePath: string): Promise<boolean>;
    /**
     * Create a Note + generate its cards via the note type's templates.
     * This is the v26 replacement for legacy card creation methods.
     */
    createNote(params: CreateNoteParams): CreateNoteResult;
    createImageOcclusionNote(params: CreateImageOcclusionNoteParams): CreateNoteResult;
    updateImageOcclusionNote(noteId: string, params: UpdateImageOcclusionNoteParams): UpdateNoteFieldsResult;
    /**
     * Create multiple Notes from parsed cards in bulk.
     * Returns all created cards for notification.
     */
    createNoteBatch(parsedCards: CreateNoteParams[]): {
        notes: Note[];
        cards: FSRSCardData[];
    };
    get noteReview(): NoteReviewService;
    enableNoteReview(sourceUid: string): CreateNoteResult;
    disableNoteReview(sourceUid: string): boolean;
    hasNoteReview(sourceUid: string): boolean;
    /**
     * Update a Note's fields and recompute Q/A for all its cards.
     * Returns the IDs of cards that were updated.
     */
    updateNoteFields(noteId: string, fields: Record<string, string>): UpdateNoteFieldsResult;
    changeNoteType(noteId: string, newNoteTypeId: string, fieldMapping: Record<string, string>): ChangeNoteTypeResult;
    private reconcileImageOcclusionCards;
    private createCardFromGenerated;
}
