/**
 * Platform adapter for reading/writing YAML frontmatter in markdown files.
 * Obsidian: wraps app.fileManager.processFrontMatter()
 * Desktop: wraps gray-matter
 */
export interface IFrontmatter {
	read(filePath: string): Promise<Record<string, unknown>>;
	update(
		filePath: string,
		changes: Record<string, unknown>,
	): Promise<void>;
}
