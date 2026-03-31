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
import { stripWikiLinkSyntax } from "../../utils/string.utils";
export class FrontmatterIndexService {
    constructor(metadataIndex) {
        this.fields = new Map();
        this.fieldChangeCallbacks = new Map();
        this.metadataIndex = metadataIndex;
    }
    register(config) {
        if (this.fields.has(config.field)) {
            return;
        }
        this.fields.set(config.field, {
            config,
            valueToPath: new Map(),
            pathToValue: new Map(),
        });
    }
    onFieldChange(field, callback) {
        var _a;
        const callbacks = (_a = this.fieldChangeCallbacks.get(field)) !== null && _a !== void 0 ? _a : [];
        callbacks.push(callback);
        this.fieldChangeCallbacks.set(field, callbacks);
    }
    /**
     * Get value from frontmatter using dot notation path
     */
    getNestedValue(frontmatter, path) {
        const parts = path.split(".");
        let current = frontmatter;
        for (const part of parts) {
            if (current === null ||
                current === undefined ||
                typeof current !== "object") {
                return undefined;
            }
            current = current[part];
        }
        return current;
    }
    extractValues(frontmatter, config) {
        if (!frontmatter)
            return [];
        const raw = this.getNestedValue(frontmatter, config.field);
        if (raw === undefined || raw === null)
            return [];
        if (config.type === "array") {
            if (Array.isArray(raw)) {
                return raw
                    .filter((v) => typeof v === "string" && v.length > 0)
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
    rebuildIndex() {
        // Clear all indexes
        for (const index of this.fields.values()) {
            index.valueToPath.clear();
            index.pathToValue.clear();
        }
        // Rebuild from metadata index for each registered field
        for (const index of this.fields.values()) {
            const allPaths = this.metadataIndex.getAllPathsWithField(index.config.field);
            for (const [path, value] of allPaths) {
                const values = this.normalizeValue(value, index.config);
                this.updateFieldIndex(index, path, values, true);
            }
        }
    }
    normalizeValue(value, config) {
        if (value === undefined || value === null)
            return [];
        if (config.type === "array") {
            if (Array.isArray(value)) {
                return value
                    .filter((v) => typeof v === "string" && v.length > 0)
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
    indexFile(path, frontmatter, silent = false) {
        for (const index of this.fields.values()) {
            const values = this.extractValues(frontmatter, index.config);
            this.updateFieldIndex(index, path, values, silent);
        }
    }
    updateFieldIndex(index, path, newValues, silent = false) {
        const { config, valueToPath, pathToValue } = index;
        // Get old values for this path
        const oldEntry = pathToValue.get(path);
        const oldValues = oldEntry
            ? oldEntry instanceof Set
                ? Array.from(oldEntry)
                : [oldEntry]
            : [];
        // Remove old mappings
        for (const oldVal of oldValues) {
            if (config.unique) {
                valueToPath.delete(oldVal);
            }
            else {
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
        }
        else {
            const firstValue = newValues[0];
            if (firstValue !== undefined) {
                pathToValue.set(path, firstValue);
            }
        }
        for (const val of newValues) {
            if (config.unique) {
                valueToPath.set(val, path);
            }
            else {
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
    fireCallbacks(field, path, oldValues, newValues) {
        // Only fire if values actually changed
        if (oldValues.length === newValues.length &&
            oldValues.every((v, i) => v === newValues[i])) {
            return;
        }
        const callbacks = this.fieldChangeCallbacks.get(field);
        if (!(callbacks === null || callbacks === void 0 ? void 0 : callbacks.length))
            return;
        const event = { field, path, oldValues, newValues };
        for (const cb of callbacks) {
            try {
                cb(event);
            }
            catch (e) {
                console.error(`[FrontmatterIndexService] Callback error for field "${field}":`, e);
            }
        }
    }
    getFileByValue(field, value) {
        const index = this.fields.get(field);
        if (!index || !index.config.unique)
            return null;
        const path = index.valueToPath.get(value);
        if (typeof path !== "string")
            return null;
        return path;
    }
    getFilesByValue(field, value) {
        const index = this.fields.get(field);
        if (!index)
            return [];
        const entry = index.valueToPath.get(value);
        if (!entry)
            return [];
        const paths = entry instanceof Set ? Array.from(entry) : [entry];
        return paths;
    }
    getValues(field, path) {
        const index = this.fields.get(field);
        if (!index)
            return [];
        const entry = index.pathToValue.get(path);
        if (!entry)
            return [];
        return entry instanceof Set ? Array.from(entry) : [entry];
    }
    getAllValues(field) {
        const index = this.fields.get(field);
        if (!index)
            return new Set();
        return new Set(index.valueToPath.keys());
    }
    getValueCount(field) {
        var _a;
        const index = this.fields.get(field);
        return (_a = index === null || index === void 0 ? void 0 : index.valueToPath.size) !== null && _a !== void 0 ? _a : 0;
    }
    handleMetadataChanged(path, frontmatter) {
        this.indexFile(path, frontmatter);
    }
    handleFileDeleted(path) {
        for (const index of this.fields.values()) {
            this.updateFieldIndex(index, path, [], true);
        }
    }
    handleFileRenamed(newPath, oldPath) {
        for (const index of this.fields.values()) {
            const { config, valueToPath, pathToValue } = index;
            const entry = pathToValue.get(oldPath);
            if (!entry)
                continue;
            const values = entry instanceof Set ? Array.from(entry) : [entry];
            // Remove old path mappings
            pathToValue.delete(oldPath);
            for (const val of values) {
                if (config.unique) {
                    valueToPath.set(val, newPath);
                }
                else {
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
            }
            else {
                const firstValue = values[0];
                if (firstValue !== undefined) {
                    pathToValue.set(newPath, firstValue);
                }
            }
        }
    }
}
