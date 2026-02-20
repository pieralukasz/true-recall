/**
 * FrontmatterIndexService
 * Generic frontmatter field indexer replacing UidIndexService
 *
 * Supports:
 * - String fields (unique: one file per value, like flashcard_uid)
 * - Array fields (non-unique: many files per value, like projects)
 * - Nested paths (e.g., "metadata.category")
 */

import { stripWikiLinkSyntax } from "@shared/utils";
import { type App, type CachedMetadata, type Plugin, TFile } from "obsidian";

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
	// Track direct event handlers for cleanup
	private directEventHandlers: {
		changed?: (file: TFile, data: string, cache: CachedMetadata) => void;
		delete?: (file: TFile) => void;
		rename?: (file: TFile, oldPath: string) => void;
	} = {};

	constructor(app: App) {
		this.app = app;
	}

	register(config: FieldConfig): void {
		if (this.fields.has(config.field)) {
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
	private getNestedValue(
		frontmatter: Record<string, unknown>,
		path: string,
	): unknown {
		const parts = path.split(".");
		let current: unknown = frontmatter;

		for (const part of parts) {
			if (
				current === null ||
				current === undefined ||
				typeof current !== "object"
			) {
				return undefined;
			}
			current = (current as Record<string, unknown>)[part];
		}

		return current;
	}

	private stripWikiLinkSyntax(value: string): string {
		return stripWikiLinkSyntax(value);
	}

	private extractValues(
		frontmatter: Record<string, unknown> | undefined,
		config: FieldConfig,
	): string[] {
		if (!frontmatter) return [];

		const raw = this.getNestedValue(frontmatter, config.field);
		if (raw === undefined || raw === null) return [];

		if (config.type === "array") {
			if (Array.isArray(raw)) {
				return raw
					.filter((v): v is string => typeof v === "string" && v.length > 0)
					.map((v) => this.stripWikiLinkSyntax(v));
			}
			return [];
		}

		// String type
		if (typeof raw === "string" && raw.length > 0) {
			return [raw];
		}

		return [];
	}

	/** Call after metadataCache is fully loaded (e.g., in onLayoutReady) */
	rebuildIndex(): void {
		// Clear all indexes
		for (const index of this.fields.values()) {
			index.valueToPath.clear();
			index.pathToValue.clear();
		}

		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			this.indexFile(file.path, cache?.frontmatter);
		}
	}

	private indexFile(
		path: string,
		frontmatter: Record<string, unknown> | undefined,
	): void {
		for (const index of this.fields.values()) {
			const values = this.extractValues(frontmatter, index.config);
			this.updateFieldIndex(index, path, values);
		}
	}

	private updateFieldIndex(
		index: FieldIndex,
		path: string,
		newValues: string[],
	): void {
		const { config, valueToPath, pathToValue } = index;

		// Get old values for this path
		const oldEntry = pathToValue.get(path);
		const oldValues: string[] = oldEntry
			? oldEntry instanceof Set
				? Array.from(oldEntry)
				: [oldEntry]
			: [];

		// Remove old mappings
		for (const oldVal of oldValues) {
			if (config.unique) {
				valueToPath.delete(oldVal);
			} else {
				const paths = valueToPath.get(oldVal);
				if (paths instanceof Set) {
					paths.delete(path);
					if (paths.size === 0) {
						valueToPath.delete(oldVal);
					}
				}
			}
		}

		// Clear path entry if no new values
		if (newValues.length === 0) {
			pathToValue.delete(path);
			return;
		}

		// Add new mappings
		if (config.type === "array") {
			pathToValue.set(path, new Set(newValues));
		} else {
			const firstValue = newValues[0];
			if (firstValue !== undefined) {
				pathToValue.set(path, firstValue);
			}
		}

		for (const val of newValues) {
			if (config.unique) {
				valueToPath.set(val, path);
			} else {
				let paths = valueToPath.get(val);
				if (!(paths instanceof Set)) {
					paths = new Set();
					valueToPath.set(val, paths);
				}
				paths.add(path);
			}
		}
	}

	getFileByValue(field: string, value: string): TFile | null {
		const index = this.fields.get(field);
		if (!index || !index.config.unique) return null;

		const path = index.valueToPath.get(value);
		if (typeof path !== "string") return null;

		const file = this.app.vault.getAbstractFileByPath(path);
		// Use instanceof for production, "extension" property check for test mocks
		if (file instanceof TFile) return file;
		// Fallback for test mocks that aren't actual TFile instances
		if (file && typeof file === "object" && "extension" in file) {
			// eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast -- Fallback for test mocks only
			return file as unknown as TFile;
		}
		return null;
	}

	getFilesByValue(field: string, value: string): TFile[] {
		const index = this.fields.get(field);
		if (!index) return [];

		const entry = index.valueToPath.get(value);
		if (!entry) return [];

		const paths = entry instanceof Set ? Array.from(entry) : [entry];
		return paths
			.map((p) => this.app.vault.getAbstractFileByPath(p))
			.filter((f): f is TFile => f !== null && "extension" in f);
	}

	getValues(field: string, path: string): string[] {
		const index = this.fields.get(field);
		if (!index) return [];

		const entry = index.pathToValue.get(path);
		if (!entry) return [];

		return entry instanceof Set ? Array.from(entry) : [entry];
	}

	getAllValues(field: string): Set<string> {
		const index = this.fields.get(field);
		if (!index) return new Set();

		return new Set(index.valueToPath.keys());
	}

	getValueCount(field: string): number {
		const index = this.fields.get(field);
		return index?.valueToPath.size ?? 0;
	}

	registerEvents(plugin: Plugin): void {
		plugin.registerEvent(
			this.app.metadataCache.on(
				"changed",
				this.handleMetadataChanged.bind(this),
			),
		);
		plugin.registerEvent(
			this.app.vault.on("delete", this.handleFileDeleted.bind(this)),
		);
		plugin.registerEvent(
			this.app.vault.on("rename", this.handleFileRenamed.bind(this)),
		);
	}

	/** WARNING: Must call unregisterEventsDirect() when done to prevent memory leaks */
	registerEventsDirect(): void {
		// Store bound handlers for later cleanup
		this.directEventHandlers.changed = this.handleMetadataChanged.bind(this);
		this.directEventHandlers.delete = this.handleFileDeleted.bind(this);
		this.directEventHandlers.rename = this.handleFileRenamed.bind(this);

		this.app.metadataCache.on("changed", this.directEventHandlers.changed);
		this.app.vault.on("delete", this.directEventHandlers.delete);
		this.app.vault.on("rename", this.directEventHandlers.rename);
	}

	unregisterEventsDirect(): void {
		if (this.directEventHandlers.changed) {
			this.app.metadataCache.off("changed", this.directEventHandlers.changed);
		}
		if (this.directEventHandlers.delete) {
			this.app.vault.off("delete", this.directEventHandlers.delete);
		}
		if (this.directEventHandlers.rename) {
			this.app.vault.off("rename", this.directEventHandlers.rename);
		}
		this.directEventHandlers = {};
	}

	private handleMetadataChanged(
		file: TFile,
		_data: string,
		cache: CachedMetadata,
	): void {
		this.indexFile(file.path, cache?.frontmatter);
	}

	private handleFileDeleted(file: TFile): void {
		// Remove from all field indexes
		for (const index of this.fields.values()) {
			this.updateFieldIndex(index, file.path, []);
		}
	}

	private handleFileRenamed(file: TFile, oldPath: string): void {
		// For each field, transfer the values from oldPath to newPath
		for (const index of this.fields.values()) {
			const { config, valueToPath, pathToValue } = index;

			const entry = pathToValue.get(oldPath);
			if (!entry) continue;

			const values = entry instanceof Set ? Array.from(entry) : [entry];

			// Remove old path mappings
			pathToValue.delete(oldPath);
			for (const val of values) {
				if (config.unique) {
					// Update directly
					valueToPath.set(val, file.path);
				} else {
					const paths = valueToPath.get(val);
					if (paths instanceof Set) {
						paths.delete(oldPath);
						paths.add(file.path);
					}
				}
			}

			// Add new path entry
			if (config.type === "array") {
				pathToValue.set(file.path, new Set(values));
			} else {
				const firstValue = values[0];
				if (firstValue !== undefined) {
					pathToValue.set(file.path, firstValue);
				}
			}
		}
	}
}
