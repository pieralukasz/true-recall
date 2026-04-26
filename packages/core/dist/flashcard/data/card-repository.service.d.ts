import { DuplicateError } from "@true-recall/core/errors/domain.error";
import type { DomainEventBus } from "@true-recall/core/events/event-bus";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
import type { CardReviewLogEntry, CardType, FSRSCardData, FSRSFlashcardItem } from "@true-recall/core/types";
export interface DuplicateInfo {
    flashcard: {
        id: string;
        question: string;
        answer: string;
    };
    type: "batch" | "existing";
    existingCardId?: string;
    existingSourceUid?: string;
}
export declare class DuplicateQuestionError extends DuplicateError {
    existingCardId: string;
    existingSourceUid?: string | undefined;
    constructor(existingCardId: string, existingSourceUid?: string | undefined);
}
export interface CreateBatchResult {
    created: FSRSFlashcardItem[];
    duplicates: DuplicateInfo[];
}
export declare class CardRepository {
    private store;
    private bus;
    private busWarnLogged;
    constructor(store: SqliteStoreService);
    setEventBus(bus: DomainEventBus): void;
    private emit;
    /** @throws DuplicateQuestionError if card with same question already exists */
    create(question: string, answer: string, sourceUid?: string, sourceNoteName?: string, options?: {
        cardType?: CardType;
        clozeTemplate?: string;
        clozeIndex?: number;
        reverseOf?: string;
    }): FSRSFlashcardItem;
    createBatch(flashcards: Array<{
        id: string;
        question: string;
        answer: string;
        cardType?: CardType;
        clozeTemplate?: string;
        clozeIndex?: number;
        reverseOfBatchId?: string;
        sourceText?: string;
    }>, sourceUid: string, sourceNoteName?: string, createdVia?: string, sourceText?: string): CreateBatchResult;
    get(cardId: string): FSRSCardData | undefined;
    has(cardId: string): boolean;
    /** @throws Error if card not found, DuplicateQuestionError if question conflicts */
    updateContent(cardId: string, newQuestion: string, newAnswer: string): void;
    private syncReversePair;
    updateFSRS(cardId: string, newFSRSData: FSRSCardData, reviewLogEntry?: CardReviewLogEntry, options?: {
        skipNotification?: boolean;
    }): boolean;
    updateSourceUid(cardId: string, newSourceUid: string): boolean;
    updateClozeTemplate(sourceUid: string, oldTemplate: string, newTemplate: string, _sourceNoteName?: string): void;
    delete(cardId: string): boolean;
    deleteWithCascade(cardId: string): {
        removedIds: string[];
        cardsData: FSRSCardData[];
    };
    deleteBatch(cardIds: string[]): number;
    deleteBatchWithCascade(cardIds: string[]): {
        removedIds: string[];
        cardsData: FSRSCardData[];
    };
    private collectCascadeDeleteIds;
    /** Returns true if card was saved, false if skipped (already exists) */
    setIfNotExists(cardId: string, fsrsData: FSRSCardData): boolean;
}
