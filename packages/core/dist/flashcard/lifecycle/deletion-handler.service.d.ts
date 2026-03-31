import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
import type { FrontmatterIndexService } from "@true-recall/core/services/notes/frontmatter-index.service";
/**
 * Platform-agnostic session persistence interface.
 * The concrete implementation is injected from the platform layer.
 */
export interface ISessionPersistence {
    removeReviewedCards(cardIds: string[]): void;
}
export interface DeletionHandlerDeps {
    frontmatterIndex: FrontmatterIndexService;
    store: SqliteStoreService;
    sessionPersistence: ISessionPersistence;
    notification?: {
        cardsDeleted(count: number): void;
    };
}
/**
 * Auto-deletes all flashcards when their source note is deleted.
 * Cards are permanently bound to notes -- no orphans possible.
 */
export declare class DeletionHandlerService {
    private deps;
    constructor(deps: DeletionHandlerDeps);
    /**
     * Called BEFORE FrontmatterIndexService updates its index,
     * so the UID is still available for lookup.
     * @param filePath - path of the deleted file (must be a .md file)
     */
    handleFileDeletion(filePath: string): void;
}
