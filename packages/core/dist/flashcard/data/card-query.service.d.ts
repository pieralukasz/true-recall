import type { SourceNoteService } from "@true-recall/core/flashcard/source/source-note.service";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
import type { CardSchedulingMeta, FSRSCardData, FSRSFlashcardItem } from "@true-recall/core/types";
export declare function hasDisplayableContent(card: FSRSCardData): boolean;
export declare class CardQueryService {
    private store;
    private sourceNoteService;
    constructor(store: SqliteStoreService, sourceNoteService: SourceNoteService);
    getAllMeta(): CardSchedulingMeta[];
    getMetaById(cardId: string): CardSchedulingMeta | null;
    getContent(cardId: string): FSRSFlashcardItem | null;
    getAll(): FSRSFlashcardItem[];
    getByIds(cardIds: string[]): FSRSFlashcardItem[];
    getBySourceUid(sourceUid: string): FSRSFlashcardItem[];
    getById(cardId: string): FSRSCardData | undefined;
    findByQuestion(question: string): string | undefined;
    count(): number;
    private filterAndMapCards;
}
