/**
 * Frontmatter Service
 * Handles parsing and manipulation of YAML frontmatter in flashcard files
 */
import { App, TFile } from "obsidian";
import type { NoteFlashcardType } from "../../types";

/** Default deck name for cards without explicit deck assignment */
const DEFAULT_DECK = "Knowledge";

/**
 * Service for managing frontmatter in flashcard and source note files
 */
export class FrontmatterService {
	constructor(private app: App) {}

	/**
	 * Generate frontmatter for a new flashcard file
	 */
	generateFrontmatter(
		sourceFile: TFile,
		deck: string = DEFAULT_DECK,
		options: { temporary?: boolean } = {}
	): string {
		const statusLine = options.temporary ? "\nstatus: temporary" : "";
		return `---
source_link: "[[${sourceFile.basename}]]"
tags: [flashcards/auto]
deck: "${deck}"${statusLine}
---

# Flashcards for [[${sourceFile.basename}]]

`;
	}

	/**
	 * Extract deck name from frontmatter
	 */
	extractDeckFromFrontmatter(content: string): string {
		const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
		if (!frontmatterMatch) {
			return DEFAULT_DECK;
		}

		const frontmatter = frontmatterMatch[1] ?? "";
		const deckMatch = frontmatter.match(/^deck:\s*["']?([^"'\n]+)["']?/m);

		return deckMatch?.[1]?.trim() ?? DEFAULT_DECK;
	}

	/**
	 * Extract status from flashcard file frontmatter
	 */
	extractStatusFromFrontmatter(content: string): string | null {
		const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
		if (!frontmatterMatch) {
			return null;
		}

		const frontmatter = frontmatterMatch[1] ?? "";
		const statusMatch = frontmatter.match(/^status:\s*(\w+)/m);

		return statusMatch?.[1] ?? null;
	}

	/**
	 * Extract source_link from frontmatter
	 * Returns the note name from source_link: "[[NoteName]]"
	 */
	extractSourceLinkFromContent(content: string): string | null {
		const match = content.match(/source_link:\s*"\[\[([^\]]+)\]\]"/);
		return match?.[1] ?? null;
	}

	/**
	 * Extract all tags from content (inline and frontmatter)
	 */
	extractAllTags(content: string): string[] {
		const tags: string[] = [];

		// Extract inline tags
		const inlineTagPattern = /#[\w/-]+/g;
		const inlineMatches = content.match(inlineTagPattern);
		if (inlineMatches) {
			tags.push(...inlineMatches.map((t) => t.replace(/^#/, "")));
		}

		// Extract frontmatter tags
		const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
		if (frontmatterMatch) {
			const frontmatter = frontmatterMatch[1] ?? "";

			// Array format: tags: [input/book, mind/concept]
			const tagsArrayMatch = frontmatter.match(
				/^tags:\s*\[([^\]]+)\]/m
			);
			if (tagsArrayMatch) {
				const arrayTags =
					tagsArrayMatch[1]
						?.split(",")
						.map((t) =>
							t.trim().replace(/^["']|["']$/g, "")
						) ?? [];
				tags.push(...arrayTags);
			}

			// List format: tags:\n  - input/book
			const tagsListPattern = /^tags:\s*\n(\s+-\s+\S+\s*)+/m;
			const tagsListMatch = frontmatter.match(tagsListPattern);
			if (tagsListMatch) {
				const tagLines =
					tagsListMatch[0].match(/-\s+(\S+)/g) ?? [];
				const listTags = tagLines.map((t) =>
					t.replace(/^-\s+/, "").replace(/^["']|["']$/g, "")
				);
				tags.push(...listTags);
			}
		}

		return tags;
	}

	/**
	 * Check if a source note is a Literature Note (has #input/ tags)
	 * Literature Notes generate temporary flashcards that should be moved later
	 */
	async isLiteratureNote(sourceFile: TFile): Promise<boolean> {
		const content = await this.app.vault.read(sourceFile);

		// Check for #input/ tags in content (inline tags)
		const inputTagPattern = /#input\//i;
		if (inputTagPattern.test(content)) {
			return true;
		}

		// Check frontmatter tags
		const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
		if (frontmatterMatch) {
			const frontmatter = frontmatterMatch[1] ?? "";
			// Match tags array format: tags: [input/book, other/tag]
			const tagsArrayMatch = frontmatter.match(
				/^tags:\s*\[([^\]]+)\]/m
			);
			if (tagsArrayMatch) {
				const tags =
					tagsArrayMatch[1]?.split(",").map((t) => t.trim()) ??
					[];
				if (tags.some((t) => t.startsWith("input/"))) {
					return true;
				}
			}
			// Match tags list format: tags:\n  - input/book
			const tagsListPattern = /^tags:\s*\n(\s+-\s+\S+\s*)+/m;
			const tagsListMatch = frontmatter.match(tagsListPattern);
			if (tagsListMatch) {
				const tagLines =
					tagsListMatch[0].match(/-\s+(\S+)/g) ?? [];
				const tags = tagLines.map((t) => t.replace(/^-\s+/, ""));
				if (tags.some((t) => t.startsWith("input/"))) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Get note flashcard type based on tags
	 * Determines what kind of flashcards should be created for a note
	 */
	async getNoteFlashcardType(sourceFile: TFile): Promise<NoteFlashcardType> {
		const content = await this.app.vault.read(sourceFile);
		const tags = this.extractAllTags(content);

		// Check for #input/* tags - temporary flashcards
		if (tags.some((t) => t.startsWith("input/") || t.startsWith("#input/"))) {
			return "temporary";
		}

		// Check for #mind/* tags
		const mindTags = tags.filter(
			(t) => t.startsWith("mind/") || t.startsWith("#mind/")
		);

		// Permanent flashcards: concept, zettel
		if (
			mindTags.some(
				(t) => t.includes("/concept") || t.includes("/zettel")
			)
		) {
			return "permanent";
		}

		// Maybe flashcards: application, protocol
		if (
			mindTags.some(
				(t) => t.includes("/application") || t.includes("/protocol")
			)
		) {
			return "maybe";
		}

		// No flashcards: question, hub, structure, index, person
		if (
			mindTags.some(
				(t) =>
					t.includes("/question") ||
					t.includes("/hub") ||
					t.includes("/structure") ||
					t.includes("/index") ||
					t.includes("/person")
			)
		) {
			return "none";
		}

		// Unknown - no recognized tags
		return "unknown";
	}

	/**
	 * Get default deck name
	 */
	getDefaultDeck(): string {
		return DEFAULT_DECK;
	}
}
