/**
 * FrontmatterIndexService
 * Generic frontmatter field indexer (platform-agnostic).
 * Uses IMetadataIndex for O(1) lookups.
 *
 * Supports:
 * - String fields (unique: one file per value, like flashcard_uid)
 * - Array fields (non-unique: many files per value, like parents)
 * - Nested paths (e.g., "metadata.category")
 */
import type { IMetadataIndex } from "../../interfaces/metadata-index";
export interface FieldConfig {
    /** Field path in frontmatter (e.g., "flashcard_uid", "parents", "metadata.category") */
    field: string;
    /** Field type: "string" for single values, "array" for lists */
    type: "string" | "array";
    /** If true, each value maps to exactly one file (enforced) */
    unique?: boolean;
}
export interface FieldChangeEvent {
    field: string;
    path: string;
    oldValues: string[];
    newValues: string[];
}
export type FieldChangeCallback = (event: FieldChangeEvent) => void;
export declare class FrontmatterIndexService {
    private fields;
    private fieldChangeCallbacks;
    private metadataIndex;
    constructor(metadataIndex: IMetadataIndex);
    register(config: FieldConfig): void;
    onFieldChange(field: string, callback: FieldChangeCallback): void;
    /**
     * Get value from frontmatter using dot notation path
     */
    private getNestedValue;
    private extractValues;
    /** Rebuild index from all markdown files using the metadata index */
    rebuildIndex(): void;
    private normalizeValue;
    indexFile(path: string, frontmatter: Record<string, unknown> | undefined, silent?: boolean): void;
    private updateFieldIndex;
    private fireCallbacks;
    getFileByValue(field: string, value: string): string | null;
    getFilesByValue(field: string, value: string): string[];
    getValues(field: string, path: string): string[];
    getAllValues(field: string): Set<string>;
    getValueCount(field: string): number;
    handleMetadataChanged(path: string, frontmatter: Record<string, unknown> | undefined): void;
    handleFileDeleted(path: string): void;
    handleFileRenamed(newPath: string, oldPath: string): void;
}
