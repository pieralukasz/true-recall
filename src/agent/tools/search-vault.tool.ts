/**
 * Search Vault Tool
 * Searches the vault for notes by content, filename, or tags
 */
import { z } from "zod";
import { TFile } from "obsidian";
import type { ToolDefinition, ToolContext, ToolResult } from "../types";

const SearchTypeSchema = z.enum(["content", "filename", "tag"]);

const InputSchema = z.object({
	query: z.string().min(1, "Search query is required"),
	type: SearchTypeSchema
		.optional()
		.default("content")
		.describe("Type of search: content (full-text), filename, or tag"),
	limit: z
		.number()
		.int()
		.positive()
		.optional()
		.default(20)
		.describe("Maximum number of results to return"),
	folder: z
		.string()
		.optional()
		.describe("Limit search to a specific folder"),
});

const SearchResultSchema = z.object({
	path: z.string(),
	name: z.string(),
	folder: z.string(),
	matchContext: z.string().optional(),
});

const OutputSchema = z.object({
	results: z.array(SearchResultSchema),
	totalFound: z.number(),
	query: z.string(),
	type: SearchTypeSchema,
});

type SearchVaultInput = z.infer<typeof InputSchema>;
type SearchVaultOutput = z.infer<typeof OutputSchema>;
type SearchResult = z.infer<typeof SearchResultSchema>;

export const searchVaultTool: ToolDefinition<SearchVaultInput, SearchVaultOutput> = {
	name: "search-vault",
	description:
		"Search the vault for notes. Supports full-text content search, filename search, and tag search.",
	category: "query",
	inputSchema: InputSchema,
	outputSchema: OutputSchema,
	mutates: false,

	async execute(input, ctx): Promise<ToolResult<SearchVaultOutput>> {
		const results: SearchResult[] = [];
		const queryLower = input.query.toLowerCase();

		// Get all markdown files
		let files = ctx.app.vault.getMarkdownFiles();

		// Filter by folder if specified
		if (input.folder) {
			const folderPath = input.folder.endsWith("/")
				? input.folder
				: input.folder + "/";
			files = files.filter(
				(f) => f.path.startsWith(folderPath) || f.path === input.folder
			);
		}

		try {
			switch (input.type) {
				case "filename":
					for (const file of files) {
						if (file.basename.toLowerCase().includes(queryLower)) {
							results.push({
								path: file.path,
								name: file.basename,
								folder: file.parent?.path ?? "",
							});
							if (results.length >= input.limit) break;
						}
					}
					break;

				case "tag":
					const searchTag = input.query.startsWith("#")
						? input.query.slice(1)
						: input.query;
					const searchTagLower = searchTag.toLowerCase();

					for (const file of files) {
						const cache = ctx.app.metadataCache.getFileCache(file);
						if (cache?.tags) {
							const hasTag = cache.tags.some((t) =>
								t.tag.toLowerCase().includes(searchTagLower)
							);
							if (hasTag) {
								results.push({
									path: file.path,
									name: file.basename,
									folder: file.parent?.path ?? "",
									matchContext: cache.tags
										.filter((t) =>
											t.tag.toLowerCase().includes(searchTagLower)
										)
										.map((t) => t.tag)
										.join(", "),
								});
								if (results.length >= input.limit) break;
							}
						}
						// Also check frontmatter tags
						if (cache?.frontmatter?.tags) {
							const fmTags = Array.isArray(cache.frontmatter.tags)
								? cache.frontmatter.tags
								: [cache.frontmatter.tags];
							const hasTag = fmTags.some(
								(t: string) =>
									typeof t === "string" &&
									t.toLowerCase().includes(searchTagLower)
							);
							if (hasTag && !results.find((r) => r.path === file.path)) {
								results.push({
									path: file.path,
									name: file.basename,
									folder: file.parent?.path ?? "",
									matchContext: fmTags.join(", "),
								});
								if (results.length >= input.limit) break;
							}
						}
					}
					break;

				case "content":
				default:
					for (const file of files) {
						const content = await ctx.app.vault.cachedRead(file);
						const contentLower = content.toLowerCase();
						const index = contentLower.indexOf(queryLower);

						if (index !== -1) {
							// Extract context around match
							const start = Math.max(0, index - 50);
							const end = Math.min(content.length, index + input.query.length + 50);
							const matchContext = (start > 0 ? "..." : "") +
								content.slice(start, end).replace(/\n/g, " ").trim() +
								(end < content.length ? "..." : "");

							results.push({
								path: file.path,
								name: file.basename,
								folder: file.parent?.path ?? "",
								matchContext,
							});
							if (results.length >= input.limit) break;
						}
					}
					break;
			}

			return {
				success: true,
				data: {
					results,
					totalFound: results.length,
					query: input.query,
					type: input.type,
				},
			};
		} catch (error) {
			return {
				success: false,
				error: {
					code: "SEARCH_FAILED",
					message: error instanceof Error ? error.message : String(error),
				},
			};
		}
	},
};
