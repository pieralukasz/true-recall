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

export class FrontmatterIndexService {
	private app: App;
	private fields: Map<string, FieldIndex> = new Map();

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Register a field to be indexed
	 */
	register(config: FieldConfig): void {
		if (this.fields.has(config.field)) {
			console.warn(`[FrontmatterIndex] Field "${config.field}" already registered`);
			return;
		}

		this.fields.set(config.field, {
			config,
			valueToPath: new Map(),
			pathToValue: new Map(),
		});
	}

	/**
	 * Get value from frontmatter using dot notation path
	 * e.g., "metadata.category" extracts frontmatter.metadata.category
	 */
	private getNestedValue(frontmatter: Record<string, unknown>, path: string): unknown {
		const parts = path.split(".");
		let current: unknown = frontmatter;

		for (const part of parts) {
			if (current === null || current === undefined || typeof current !== "object") {
				return undefined;
			}
			current = (current as Record<string, unknown>)[part];
		}

		return current;
	}

	/**
	 * Extract and normalize values from frontmatter for a field
	 */
	private extractValues(frontmatter: Record<string, unknown> | undefined, config: FieldConfig): string[] {
		if (!frontmatter) return [];

		const raw = this.getNestedValue(frontmatter, config.field);
		if (raw === undefined || raw === null) return [];

		if (config.type === "array") {
			if (Array.isArray(raw)) {
				return raw.filter((v): v is string => typeof v === "string" && v.length > 0);
			}
			return [];
		}

		// String type
		if (typeof raw === "string" && raw.length > 0) {
			return [raw];
		}

		return [];
	}
}
