/**
 * FrontmatterIndexService
 * Generic frontmatter field indexer replacing UidIndexService
 *
 * Supports:
 * - String fields (unique: one file per value, like flashcard_uid)
 * - Array fields (non-unique: many files per value, like projects)
 * - Nested paths (e.g., "metadata.category")
 */
import type { App, TFile, CachedMetadata, Plugin } from "obsidian";

export interface FieldConfig {
	/** Field path in frontmatter (e.g., "flashcard_uid", "projects", "metadata.category") */
	field: string;
	/** Field type: "string" for single values, "array" for lists */
	type: "string" | "array";
	/** If true, each value maps to exactly one file (enforced) */
	unique?: boolean;
}

interface FieldIndex {
	config: FieldConfig;
	/** value → Set<path> (for non-unique) or value → path (for unique) */
	valueToPath: Map<string, string | Set<string>>;
	/** path → value (for string) or path → Set<value> (for array) */
	pathToValue: Map<string, string | Set<string>>;
}
