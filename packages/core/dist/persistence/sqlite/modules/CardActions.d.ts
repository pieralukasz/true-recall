import type { CardSchedulingMeta, FSRSCardData } from "../../../types";
import type { SqliteDatabase } from "../SqliteDatabase";
export declare class CardActions {
    private db;
    private fts5Available;
    constructor(db: SqliteDatabase);
    private isFts5Available;
    private noteMatchCondition;
    getAllSchedulingMeta(): CardSchedulingMeta[];
    getSchedulingMetaById(cardId: string): CardSchedulingMeta | null;
    get(cardId: string): FSRSCardData | undefined;
    getAll(): FSRSCardData[];
    getByIds(cardIds: string[]): FSRSCardData[];
    getCardsBySourceUid(sourceUid: string): FSRSCardData[];
    getBySourceUid(sourceUid: string): FSRSCardData[];
    getCardsWithContent(): FSRSCardData[];
    getAllIncludingDeleted(): FSRSCardData[];
    getModifiedSince(timestamp: number): (FSRSCardData & {
        updatedAt?: number;
        deletedAt?: number | null;
    })[];
    getDueCardsByDateRange(startDate: string, endDate: string): FSRSCardData[];
    browserQuery(where: string, params: (string | number)[], orderBy: string, limit: number, offset: number): FSRSCardData[];
    browserCount(where: string, params: (string | number)[]): number;
    getCardByReverseOf(originalCardId: string): FSRSCardData | undefined;
    getCardsByNoteId(noteId: string): FSRSCardData[];
    getNoteInfoForCardIds(cardIds: string[]): Array<{
        noteId: string;
        noteTypeId: string;
    }>;
    findClozeCard(sourceUid: string, _clozeTemplate: string, clozeIndex: number): string | undefined;
    getIOChildren(parentId: string): FSRSCardData[];
    softDeleteIOFamily(parentId: string): string[];
    getClozeSiblings(sourceUid: string, _clozeTemplate: string): FSRSCardData[];
    set(cardId: string, data: FSRSCardData): void;
    updateCardContent(cardId: string, question: string, answer: string): void;
    updateClozeCardContent(cardId: string, _question: string, _answer: string, clozeTemplate: string): void;
    upsertFromRemote(data: FSRSCardData & {
        updatedAt?: number;
        deletedAt?: number | null;
    }): void;
    getCardIdByQuestion(question: string): string | undefined;
    getCardInfoByQuestion(question: string, excludeCardId?: string): {
        id: string;
        sourceUid?: string;
    } | undefined;
    getCardIdByQuestionAndClozeIndex(question: string, clozeIndex: number): string | undefined;
    hasCardContent(cardId: string): boolean;
    hasAnyCardContent(): boolean;
    getCardsWithContentCount(): number;
    has(cardId: string): boolean;
    keys(): string[];
    size(): number;
    softDelete(cardId: string): void;
    /** @deprecated Use softDelete() instead for sync compatibility */
    delete(cardId: string): void;
    updateCardSourceUid(cardId: string, sourceUid: string): void;
    softDeleteWithCascade(cardId: string): void;
    updateCardDue(cardId: string, newDue: string): void;
    updateCardScheduling(cardId: string, data: {
        due: string;
        scheduledDays: number;
    }): void;
    getSyncMetadata(key: string): string | null;
    setSyncMetadata(key: string, value: string): void;
    deleteAllForSync(): void;
    bulkSuspend(cardIds: string[]): number;
    bulkUnsuspend(cardIds: string[]): number;
    bulkBury(cardIds: string[], untilDate: string): number;
    bulkUnbury(cardIds: string[]): number;
    bulkSoftDelete(cardIds: string[]): number;
    /** @deprecated Use bulkSoftDelete() instead for sync compatibility */
    bulkDelete(cardIds: string[]): number;
    /** @deprecated Use bulkForget() instead — it also clears review history */
    bulkReset(cardIds: string[]): number;
    bulkForget(cardIds: string[]): number;
    bulkReschedule(cardIds: string[], dueDate: string): number;
}
