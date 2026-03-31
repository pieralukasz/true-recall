/**
 * Platform adapter for resolving wiki-link names to file paths.
 * Obsidian: wraps app.metadataCache.getFirstLinkpathDest()
 * Desktop: wraps custom link index
 */
export interface ILinkResolver {
	resolveLink(name: string): string | null;
}
