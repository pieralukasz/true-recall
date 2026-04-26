import type { IPersistence } from "@true-recall/core/interfaces/persistence";
/**
 * Reads binary file data from the vault by filename or path.
 * Obsidian: wraps app.vault.adapter + getFiles().
 */
export interface IVaultFileReader {
    /** Check if a file exists at the given path. */
    exists(path: string): Promise<boolean>;
    /** Read binary data from a path. */
    readBinary(path: string): Promise<ArrayBuffer>;
    /** Find a file path by its basename across the vault. Returns null if not found. */
    findByName(filename: string): string | null;
}
export declare class AnkiMediaService {
    private persistence;
    private fileReader?;
    constructor(persistence: IPersistence, fileReader?: IVaultFileReader | undefined);
    importMedia(media: Map<string, ArrayBuffer>, mediaMap: Record<string, string>, targetFolder: string): Promise<Map<string, string>>;
    /**
     * Build a single regex that matches all media wikilink embeds at once,
     * replacing each with its vault path in one pass instead of N split/join calls.
     */
    buildContentReplacer(pathMapping: Map<string, string>): (content: string) => string;
    updateImportedContent(content: string, pathMapping: Map<string, string>): string;
    collectExportMedia(cards: {
        question: string;
        answer: string;
    }[]): Promise<{
        mediaFiles: Map<string, ArrayBuffer>;
        mediaMap: Record<string, string>;
    }>;
    convertContentForExport(content: string): string;
    private extractMediaRefs;
    private readVaultFile;
    private ensureFolder;
    private basenameOf;
    private isMediaFile;
}
