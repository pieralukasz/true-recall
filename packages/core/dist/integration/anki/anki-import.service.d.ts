import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
import type { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import { type IVaultFileReader } from "./anki-media.service";
import type { IPersistence } from "@true-recall/core/interfaces/persistence";
import type { AnkiImportOptions, AnkiImportResult } from "@true-recall/core/types";
/**
 * Handles vault-level file operations needed for Anki import (creating notes, frontmatter, etc.).
 * Obsidian: wraps app.vault, app.metadataCache, app.fileManager.
 */
export interface IAnkiImportVault {
    /** Check if a file/folder exists at path. */
    exists(path: string): Promise<boolean>;
    /** Create a folder (and parents if needed). */
    ensureFolderRecursive(folderPath: string): Promise<void>;
    /** Create a file with content. */
    createFile(path: string, content: string): Promise<void>;
    /** Read file content. */
    readFile(path: string): Promise<string>;
    /** Append content to an existing file. */
    appendToFile(path: string, content: string): Promise<void>;
    /** Prepend content to an existing file. */
    prependToFile(path: string, content: string): Promise<void>;
    /** Get the flashcard_uid from frontmatter of a file. Returns null if not present. */
    getFrontmatterUid(path: string): Promise<string | null>;
    /** Add a parent link to an existing file's frontmatter. */
    addParentToFrontmatter(path: string, parentName: string): Promise<void>;
}
/** Callback for notifying card changes after import. */
export type CardChangeNotifier = (change: {
    type: "bulk";
    cardIds: string[];
    action: "added";
}) => void;
export declare class AnkiImportService {
    private store;
    private fsrsService;
    private persistence;
    private vault;
    private fileReader?;
    private onCardChange?;
    constructor(store: SqliteStoreService, fsrsService: FSRSService, persistence: IPersistence, vault: IAnkiImportVault, fileReader?: IVaultFileReader | undefined, onCardChange?: CardChangeNotifier | undefined);
    importApkg(fileData: ArrayBuffer, options: AnkiImportOptions): Promise<AnkiImportResult>;
    private importSingleCard;
    private importReviewLogs;
    /**
     * Creates a hierarchical note structure matching the Anki deck hierarchy.
     *
     * For deck "Math::Calculus::Integrals":
     *   Anki Import/Math.md             (MOC, tag: Math)
     *   Anki Import/Math/Calculus.md    (MOC, tag: Math/Calculus)
     *   Anki Import/Math/Calculus/Integrals.md  (leaf, tag: Math/Calculus/Integrals)
     *
     * Only leaf decks (those with actual cards) get cards linked via source_uid.
     * Parent-only decks become MOC notes with [[child]] links.
     */
    private createSourceNotesForDecks;
    private createOrUpdateNote;
    private buildFrontmatter;
    private updateChildLinks;
    private generateUid;
    private buildMinimalAnkiCard;
}
