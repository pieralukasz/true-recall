/**
 * Platform adapter for file-system metadata events.
 * Obsidian: wraps metadataCache.on("changed"), vault.on("delete"/"rename"), workspace.onLayoutReady
 * Desktop: wraps chokidar watcher + gray-matter parser
 */
export interface IVaultEventBridge {
	onMetadataChanged(
		callback: (
			path: string,
			frontmatter: Record<string, unknown> | undefined,
		) => void,
	): () => void;

	onFileDeleted(callback: (path: string) => void): () => void;

	onFileRenamed(
		callback: (newPath: string, oldPath: string) => void,
	): () => void;

	onLayoutReady(callback: () => void): void;
}
