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
import { stripWikiLinkSyntax } from "../../utils/string.utils";

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

interface FieldIndex {
	config: FieldConfig;
	/** value -> Set<path> (for non-unique) or value -> path (for unique) */
	valueToPath: Map<string, string | Set<string>>;
	/** path -> value (for string) or path -> Set<value> (for array) */
	pathToValue: Map<string, string | Set<string>>;
}

export class FrontmatterIndexService {
	private fields: Map<string, FieldIndex> = new Map();
	private fieldChangeCallbacks: Map<string, FieldChangeCallback[]> = new Map();
	private metadataIndex: IMetadataIndex;

	constructor(metadataIndex: IMetadataIndex) {
		this.metadataIndex = metadataIndex;
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

	onFieldChange(field: string, callback: FieldChangeCallback): void {
		const callbacks = this.fieldChangeCallbacks.get(field) ?? [];
		callbacks.push(callback);
		this.fieldChangeCallbacks.set(field, callbacks);
	}

	/**
	 * Get value from frontmatter using dot notation path
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
					.map((v) => stripWikiLinkSyntax(v));
			}
			return [];
		}

		// String type
		if (typeof raw === "string" && raw.length > 0) {
			return [raw];
		}

		// Boolean fields (e.g., archive: true) -> stored as "true"/"false"
		if (typeof raw === "boolean") {
			return [String(raw)];
		}

		return [];
	}

	/** Rebuild index from all markdown files using the metadata index */
	rebuildIndex(): void {
		// Clear all indexes
		for (const index of this.fields.values()) {
			index.valueToPath.clear();
			index.pathToValue.clear();
		}

		// Rebuild from metadata index for each registered field
		for (const index of this.fields.values()) {
			const allPaths = this.metadataIndex.getAllPathsWithField(
				index.config.field,
			);
			for (const [path, value] of allPaths) {
				const values = this.normalizeValue(value, index.config);
				this.updateFieldIndex(index, path, values, true);
			}
		}
	}

	private normalizeValue(value: unknown, config: FieldConfig): string[] {
		if (value === undefined || value === null) return [];

		if (config.type === "array") {
			if (Array.isArray(value)) {
				return value
					.filter((v): v is string => typeof v === "string" && v.length > 0)
					.map((v) => stripWikiLinkSyntax(v));
			}
			return [];
		}

		if (typeof value === "string" && value.length > 0) {
			return [value];
		}

		if (typeof value === "boolean") {
			return [String(value)];
		}

		return [];
	}

	indexFile(
		path: string,
		frontmatter: Record<string, unknown> | undefined,
		silent = false,
	): void {
		for (const index of this.fields.values()) {
			const values = this.extractValues(frontmatter, index.config);
			this.updateFieldIndex(index, path, values, silent);
		}
	}

	private updateFieldIndex(
		index: FieldIndex,
		path: string,
		newValues: string[],
		silent = false,
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
			if (!silent) {
				this.fireCallbacks(config.field, path, oldValues, newValues);
			}
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

		if (!silent) {
			this.fireCallbacks(config.field, path, oldValues, newValues);
		}
	}

	private fireCallbacks(
		field: string,
		path: string,
		oldValues: string[],
		newValues: string[],
	): void {
		// Only fire if values actually changed
		if (
			oldValues.length === newValues.length &&
			oldValues.every((v, i) => v === newValues[i])
		) {
			return;
		}

		const callbacks = this.fieldChangeCallbacks.get(field);
		if (!callbacks?.length) return;

		const event: FieldChangeEvent = { field, path, oldValues, newValues };
		for (const cb of callbacks) {
			try {
				cb(event);
			} catch (e) {
				console.error(
					`[FrontmatterIndexService] Callback error for field "${field}":`,
					e,
				);
			}
		}
	}

	getFileByValue(field: string, value: string): string | null {
		const index = this.fields.get(field);
		if (!index || !index.config.unique) return null;

		const path = index.valueToPath.get(value);
		if (typeof path !== "string") return null;

		return path;
	}

	getFilesByValue(field: string, value: string): string[] {
		const index = this.fields.get(field);
		if (!index) return [];

		const entry = index.valueToPath.get(value);
		if (!entry) return [];

		const paths = entry instanceof Set ? Array.from(entry) : [entry];
		return paths;
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

	handleMetadataChanged(
		path: string,
		frontmatter: Record<string, unknown> | undefined,
	): void {
		this.indexFile(path, frontmatter);
	}

	handleFileDeleted(path: string): void {
		for (const index of this.fields.values()) {
			this.updateFieldIndex(index, path, [], true);
		}
	}

	handleFileRenamed(newPath: string, oldPath: string): void {
		for (const index of this.fields.values()) {
			const { config, valueToPath, pathToValue } = index;

			const entry = pathToValue.get(oldPath);
			if (!entry) continue;

			const values = entry instanceof Set ? Array.from(entry) : [entry];

			// Remove old path mappings
			pathToValue.delete(oldPath);
			for (const val of values) {
				if (config.unique) {
					valueToPath.set(val, newPath);
				} else {
					const paths = valueToPath.get(val);
					if (paths instanceof Set) {
						paths.delete(oldPath);
						paths.add(newPath);
					}
				}
			}

			// Add new path entry
			if (config.type === "array") {
				pathToValue.set(newPath, new Set(values));
			} else {
				const firstValue = values[0];
				if (firstValue !== undefined) {
					pathToValue.set(newPath, firstValue);
				}
			}
		}
	}
}
