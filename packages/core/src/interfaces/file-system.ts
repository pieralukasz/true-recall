/**
 * Platform adapter for text file operations and watching.
 * Obsidian: wraps app.vault
 * Desktop: wraps fs/promises + chokidar
 */
export interface IFileSystem {
	read(path: string): Promise<string>;
	write(path: string, content: string): Promise<void>;
	delete(path: string): Promise<void>;
	listMarkdownFiles(): Promise<string[]>;
	watch(
		callback: (
			event: "create" | "modify" | "delete",
			path: string,
		) => void,
	): () => void;
}
