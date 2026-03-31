import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
import type { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import type { AnkiExportOptions } from "@true-recall/core/types";
import type { ISourceUidResolver } from "@true-recall/core/integration/csv/csv-export.service";
/**
 * Reads binary file data from the vault by filename.
 * Obsidian: wraps app.vault.getFiles() + readBinary().
 */
export interface IVaultMediaReader {
    /** Find a file by name (or path suffix) and return its binary data. Returns null if not found. */
    readBinaryByName(filename: string): Promise<ArrayBuffer | null>;
}
export declare class AnkiExportService {
    private store;
    private sourceUidResolver;
    private mediaReader?;
    constructor(store: SqliteStoreService, _fsrsService: FSRSService, sourceUidResolver: ISourceUidResolver, mediaReader?: IVaultMediaReader | undefined);
    exportApkg(options: AnkiExportOptions): Promise<{
        data: ArrayBuffer;
        filename: string;
    }>;
    private resolveAndFilter;
    private buildDeckMap;
    private getReviewLogsForCards;
    private collectMedia;
    private getCollectionCreatedAt;
}
