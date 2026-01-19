/**
 * VaultSearchService
 * Builds a searchable index from vault files and aliases for fast autocomplete
 */
import type { App, TFile } from "obsidian";
import type { NoteSuggestion } from "./autocomplete.types";

interface IndexEntry {
	searchTerm: string; // lowercase for matching
	suggestion: NoteSuggestion;
}

export class VaultSearchService {
	private app: App;
	private index: IndexEntry[] = [];
	private isIndexBuilt = false;
	private folderFilter: string;

	constructor(app: App, folderFilter = "") {
		this.app = app;
		this.folderFilter = folderFilter;
	}

	/**
	 * Build the search index from vault files and aliases
	 * Call this once when initializing autocomplete
	 */
	buildIndex(): void {
		this.index = [];

		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			// Filter by folder if specified
			if (this.folderFilter && !file.path.startsWith(this.folderFilter + "/") && file.path !== this.folderFilter) {
				continue;
			}

			// Add title entry
			this.addToIndex(file, file.basename, "title");

			// Add alias entries from frontmatter
			const cache = this.app.metadataCache.getFileCache(file);
			const aliases: string | string[] | undefined =
				cache?.frontmatter?.aliases as string | string[] | undefined;

			if (aliases) {
				const aliasArray = Array.isArray(aliases) ? aliases : [aliases];
				for (const alias of aliasArray) {
					if (typeof alias === "string" && alias.trim()) {
						this.addToIndex(file, alias.trim(), "alias");
					}
				}
			}
		}

		// Sort index by search term length (shorter terms first for prefix matching)
		this.index.sort((a, b) => a.searchTerm.length - b.searchTerm.length);
		this.isIndexBuilt = true;
	}

	/**
	 * Add an entry to the search index
	 */
	private addToIndex(
		file: TFile,
		text: string,
		matchType: "title" | "alias"
	): void {
		this.index.push({
			searchTerm: text.toLowerCase(),
			suggestion: {
				noteName: file.name,
				noteBasename: file.basename,
				matchType,
				matchedText: text,
				filePath: file.path,
			},
		});
	}

	/**
	 * Search for notes matching the query
	 * @param query - The search query (case-insensitive)
	 * @param limit - Maximum number of results (default: 8)
	 * @returns Array of matching suggestions
	 */
	search(query: string, limit = 8): NoteSuggestion[] {
		if (!this.isIndexBuilt) {
			this.buildIndex();
		}

		if (!query || query.length < 2) {
			return [];
		}

		const queryLower = query.toLowerCase();
		const results: NoteSuggestion[] = [];
		const seenPaths = new Set<string>();

		// First pass: prefix matches (higher priority)
		for (const entry of this.index) {
			if (results.length >= limit) break;

			if (
				entry.searchTerm.startsWith(queryLower) &&
				!seenPaths.has(entry.suggestion.filePath)
			) {
				results.push(entry.suggestion);
				seenPaths.add(entry.suggestion.filePath);
			}
		}

		// Second pass: contains matches (lower priority)
		if (results.length < limit) {
			for (const entry of this.index) {
				if (results.length >= limit) break;

				if (
					!entry.searchTerm.startsWith(queryLower) &&
					entry.searchTerm.includes(queryLower) &&
					!seenPaths.has(entry.suggestion.filePath)
				) {
					results.push(entry.suggestion);
					seenPaths.add(entry.suggestion.filePath);
				}
			}
		}

		return results;
	}

	/**
	 * Check if the index has been built
	 */
	isReady(): boolean {
		return this.isIndexBuilt;
	}

	/**
	 * Clear the index (useful for cleanup)
	 */
	clear(): void {
		this.index = [];
		this.isIndexBuilt = false;
	}
}
