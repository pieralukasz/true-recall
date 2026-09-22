/**
 * Platform adapter for O(1) frontmatter field lookups.
 * Obsidian: wraps metadataCache
 * Desktop: folder scanner with chokidar watcher
 */
export interface IMetadataIndex {
	getPathByFieldValue(field: string, value: string): string | null;
	getFieldValue(path: string, field: string): unknown;
	getAllPathsWithField(field: string): Map<string, unknown>;
	/** All Markdown paths, including notes without frontmatter. */
	getAllFilePaths?(): string[];
	onFieldChange(
		field: string,
		callback: (path: string, oldValue: unknown, newValue: unknown) => void,
	): () => void;
}
