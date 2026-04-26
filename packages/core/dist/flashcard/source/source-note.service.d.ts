/**
 * Resolves source note info using IFileSystem and IMetadataIndex for O(1) lookups.
 * Platform-agnostic replacement for Obsidian vault/metadataCache usage.
 */
import type { IFileSystem } from "@true-recall/core/interfaces/file-system";
import type { IFrontmatter } from "@true-recall/core/interfaces/frontmatter";
import type { IMetadataIndex } from "@true-recall/core/interfaces/metadata-index";
export declare class SourceNoteService {
    private frontmatterService;
    private metadataIndex;
    private frontmatterIndex;
    private fallbackUidCache;
    private fallbackCacheBuilt;
    constructor(fileSystem: IFileSystem, frontmatter: IFrontmatter, metadataIndex?: IMetadataIndex);
    setFrontmatterIndex(index: {
        getFileByValue(field: string, value: string): string | null;
    }): void;
    getOrCreateSourceUid(filePath: string): Promise<string>;
    getSourceUid(filePath: string): Promise<string | null>;
    setSourceUid(filePath: string, uid: string): Promise<void>;
    resolveSourceNote(sourceUid: string | undefined): {
        noteName?: string;
        notePath?: string;
    };
    getSourceNotePath(notePath: string): string | null;
    findSourceNoteByUid(uid: string): string | null;
    private findPathByUidSync;
    private buildFallbackCache;
    invalidateFallbackCache(): void;
    hasFlashcards(filePath: string): Promise<boolean>;
    enrichCard<T extends {
        sourceUid?: string;
    }>(card: T): T & {
        sourceNoteName: string;
        sourceNotePath: string;
    };
    enrichCards<T extends {
        sourceUid?: string;
    }>(cards: T[]): Array<T & {
        sourceNoteName: string;
        sourceNotePath: string;
    }>;
    /**
     * In-place enrichment for scheduling metadata.
     * Mutates the objects directly to avoid spread-copy overhead on large arrays.
     */
    enrichMeta<T extends {
        sourceUid?: string;
        sourceNoteName?: string;
        sourceNotePath?: string;
    }>(meta: T): T;
    enrichMetas<T extends {
        sourceUid?: string;
        sourceNoteName?: string;
        sourceNotePath?: string;
    }>(metas: T[]): T[];
}
