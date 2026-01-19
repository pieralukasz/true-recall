/**
 * Frontmatter Service
 * Handles parsing and manipulation of YAML frontmatter in flashcard files
 */
import { App, TFile } from "obsidian";
import type { NoteFlashcardType } from "../../types";
import { FLASHCARD_CONFIG } from "../../constants";

/**
 * Service for managing frontmatter in flashcard and source note files
 */
export class FrontmatterService {
	constructor(private app: App) {}

	/**
	 * Generate frontmatter for a new flashcard file
	 * @deprecated Flashcard MD files are no longer used - use SQL storage instead
	 */
	generateFrontmatter(
		sourceFile: TFile,
		projects: string[] = []
	): string {
		const projectsArray = projects.length > 0
			? `projects: [${projects.map(p => `"${p}"`).join(", ")}]`
			: "";
		return `---
source_link: "[[${sourceFile.basename}]]"
tags: [flashcards/auto]
${projectsArray}
---

`;
	}

	/**
	 * Extract projects from frontmatter
	 * Supports both array and list formats:
	 * - projects: ["Project 1", "Project 2"]
	 * - projects:
	 *   - Project 1
	 *   - Project 2
	 */
	extractProjectsFromFrontmatter(content: string): string[] {
		const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
		if (!frontmatterMatch) {
			return [];
		}

		const frontmatter = frontmatterMatch[1] ?? "";

		// Try array format: projects: ["Project 1", "Project 2"]
		const arrayMatch = frontmatter.match(/^projects:\s*\[([^\]]*)\]/m);
		if (arrayMatch) {
			const content = arrayMatch[1] ?? "";
			return content
				.split(",")
				.map(p => p.trim().replace(/^["']|["']$/g, ""))
				.filter(p => p.length > 0);
		}

		// Try list format: projects:\n  - Project 1
		const listPattern = /^projects:\s*\n(\s+-\s+.+\s*)+/m;
		const listMatch = frontmatter.match(listPattern);
		if (listMatch) {
			const lines = listMatch[0].match(/-\s+(.+)/g) ?? [];
			return lines
				.map(l => l.replace(/^-\s+/, "").trim().replace(/^["']|["']$/g, ""))
				.filter(p => p.length > 0);
		}

		return [];
	}

	/**
	 * Extract source_link from frontmatter
	 * Returns the note name from source_link: "[[NoteName]]"
	 */
	extractSourceLinkFromContent(content: string): string | null {
		const match = content.match(/source_link:\s*"\[\[(.+?)\]\]"/);
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

			// Array format: tags: [input/book, mind/zettel]
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

		// Check for #input/* tags - permanent flashcards (Literature Notes)
		if (tags.some((t) => t.startsWith("input/") || t.startsWith("#input/"))) {
			return "permanent";
		}

		// Check for #mind/* tags
		const mindTags = tags.filter(
			(t) => t.startsWith("mind/") || t.startsWith("#mind/")
		);

		// Permanent flashcards: zettel
		if (
			mindTags.some(
				(t) => t.includes("/zettel")
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
	 * Set projects in source note frontmatter
	 * Creates or updates the projects field
	 */
	async setProjectsInFrontmatter(file: TFile, projects: string[]): Promise<void> {
		const content = await this.app.vault.read(file);
		const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
		const match = content.match(frontmatterRegex);

		let newContent: string;
		const projectsLine = projects.length > 0
			? `projects: [${projects.map(p => `"${p}"`).join(", ")}]`
			: "";

		if (match) {
			const frontmatter = match[1] ?? "";
			// Check if projects field already exists
			if (/^projects:/m.test(frontmatter)) {
				// Update existing projects field
				const updatedFrontmatter = frontmatter.replace(
					/^projects:.*$/m,
					projectsLine
				).replace(/^projects:\s*\n(\s+-\s+.+\s*)+/m, projectsLine);
				newContent = content.replace(
					frontmatterRegex,
					`---\n${updatedFrontmatter}\n---`
				);
			} else if (projectsLine) {
				// Add projects field to existing frontmatter
				newContent = content.replace(
					frontmatterRegex,
					`---\n${projectsLine}\n${frontmatter}\n---`
				);
			} else {
				// No projects to add
				newContent = content;
			}
		} else if (projectsLine) {
			// Create new frontmatter with projects
			newContent = `---\n${projectsLine}\n---\n\n${content}`;
		} else {
			// No projects and no frontmatter - nothing to do
			newContent = content;
		}

		if (newContent !== content) {
			await this.app.vault.modify(file, newContent);
		}
	}

	// ===== UID-based linking methods =====

	/**
	 * Generate a short UID for flashcard linking (8 hex chars)
	 */
	generateUid(): string {
		return crypto.randomUUID().replace(/-/g, "").slice(0, FLASHCARD_CONFIG.uidLength);
	}

	/**
	 * Read flashcard_uid from source note frontmatter
	 */
	async getSourceNoteUid(sourceFile: TFile): Promise<string | null> {
		const content = await this.app.vault.read(sourceFile);
		const uidField = FLASHCARD_CONFIG.sourceUidField;
		const match = content.match(new RegExp(`${uidField}:\\s*["']?([a-f0-9]+)["']?`, "i"));
		return match?.[1] ?? null;
	}

	/**
	 * Set flashcard_uid in source note frontmatter
	 * Creates frontmatter if it doesn't exist
	 */
	async setSourceNoteUid(sourceFile: TFile, uid: string): Promise<void> {
		const content = await this.app.vault.read(sourceFile);
		const uidField = FLASHCARD_CONFIG.sourceUidField;
		const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
		const match = content.match(frontmatterRegex);

		let newContent: string;

		if (match) {
			const frontmatter = match[1] ?? "";
			// Check if UID field already exists
			if (new RegExp(`^${uidField}:`, "m").test(frontmatter)) {
				// Update existing UID
				newContent = content.replace(
					frontmatterRegex,
					`---\n${frontmatter.replace(
						new RegExp(`^${uidField}:.*$`, "m"),
						`${uidField}: "${uid}"`
					)}\n---`
				);
			} else {
				// Add UID field to existing frontmatter
				newContent = content.replace(
					frontmatterRegex,
					`---\n${uidField}: "${uid}"\n${frontmatter}\n---`
				);
			}
		} else {
			// Create new frontmatter with UID
			newContent = `---\n${uidField}: "${uid}"\n---\n\n${content}`;
		}

		await this.app.vault.modify(sourceFile, newContent);
	}

	/**
	 * Generate frontmatter for a new flashcard file with UID
	 * @deprecated Flashcard MD files are no longer used - use SQL storage instead
	 */
	generateFrontmatterWithUid(
		sourceFile: TFile,
		uid: string,
		projects: string[] = []
	): string {
		const uidField = FLASHCARD_CONFIG.flashcardUidField;
		const projectsLine = projects.length > 0
			? `projects: [${projects.map(p => `"${p}"`).join(", ")}]`
			: "";
		return `---
${uidField}: "${uid}"
source_link: "[[${sourceFile.basename}]]"
tags: [flashcards/auto]
${projectsLine}
---

`;
	}

	/**
	 * Extract source_uid from flashcard file frontmatter
	 */
	extractSourceUidFromContent(content: string): string | null {
		const uidField = FLASHCARD_CONFIG.flashcardUidField;
		const match = content.match(new RegExp(`${uidField}:\\s*["']?([a-f0-9]+)["']?`, "i"));
		return match?.[1] ?? null;
	}

	/**
	 * Update source_link in flashcard file content
	 */
	updateSourceLinkInContent(content: string, newNoteName: string): string {
		return content.replace(
			/source_link:\s*"\[\[.+?\]\]"/,
			`source_link: "[[${newNoteName}]]"`
		);
	}

	/**
	 * Remove "# Flashcards for [[...]]" header from content
	 * Used for migration of existing files
	 */
	removeFlashcardsHeader(content: string): string {
		return content.replace(/^# Flashcards for \[\[.+?\]\]\n\n?/m, "");
	}
}
