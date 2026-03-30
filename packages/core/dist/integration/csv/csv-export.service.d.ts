import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
export type CsvSeparator = "," | "\t" | ";";
export interface CsvExportOptions {
    sourceUids?: string[];
    includeScheduling: boolean;
    separator: CsvSeparator;
}
/**
 * Resolves flashcard_uid → note name mapping from the vault/frontmatter.
 * Obsidian: implemented by scanning app.vault + metadataCache.
 */
export interface ISourceUidResolver {
    resolveSourceUids(): Map<string, {
        name: string;
    }>;
}
export declare class CsvExportService {
    private store;
    private sourceUidResolver;
    constructor(store: SqliteStoreService, sourceUidResolver: ISourceUidResolver);
    export(options: CsvExportOptions): {
        content: string;
        filename: string;
    };
    private escapeField;
    private filterAndEnrich;
}
