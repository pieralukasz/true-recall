import { App, TFile } from "obsidian";
import { stripWikiLinkSyntax } from "../../utils";

export class FrontmatterService {
	/** Matches YAML frontmatter block */
	private static readonly FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;
	// Wiki link stripping now uses shared stripWikiLinkSyntax from utils
	/** Matches projects array format: projects: ["a", "b"] */
	private static readonly PROJECTS_ARRAY_REGEX = /^projects:\s*\[(.*)\]\s*$/m;
	/** Matches projects list start: projects: */
	private static readonly PROJECTS_LIST_START_REGEX = /^projects:\s*$/m;
	/** Matches list item format: - item */
	private static readonly LIST_ITEM_REGEX = /^\s+-\s+(.+)/;
	/** Matches inline tags: #tag/subtag */
	private static readonly INLINE_TAG_REGEX = /#[\w/-]+/g;
	/** Matches tags array format: tags: [a, b] */
	private static readonly TAGS_ARRAY_REGEX = /^tags:\s*\[([^\]]+)\]/m;
	/** Matches tags list format */
	private static readonly TAGS_LIST_REGEX = /^tags:\s*\n(\s+-\s+\S+\s*)+/m;
	/** Matches source_link field */
	private static readonly SOURCE_LINK_REGEX = /source_link:\s*"\[\[(.+?)\]\]"/;
	/** Matches #input/ tag pattern */
	private static readonly INPUT_TAG_REGEX = /#input\//i;
	/** Matches flashcard_uid field */
	private static readonly UID_FIELD_REGEX =
		/flashcard_uid:\s*["']?([a-f0-9]+)["']?/i;
	/** Matches flashcard_uid field for existence check */
	private static readonly UID_FIELD_EXISTS_REGEX = /^flashcard_uid:/m;
	/** Matches flashcard_uid field line for replacement */
	private static readonly UID_FIELD_LINE_REGEX = /^flashcard_uid:.*$/m;
	/** Matches projects field existence */
	private static readonly PROJECTS_FIELD_REGEX = /^projects:/m;
	/** Matches projects field line for replacement */
	private static readonly PROJECTS_FIELD_LINE_REGEX = /^projects:.*$/m;
	/** Matches projects list for replacement */
	private static readonly PROJECTS_LIST_FULL_REGEX =
		/^projects:\s*\n(\s+-\s+.+\s*)+/m;

	constructor(private app: App) {}

	private stripWikiLinkSyntax(name: string): string {
		return stripWikiLinkSyntax(name);
	}

	/**
	 * Extract projects from frontmatter
	 * Supports both array and list formats:
	 * - projects: ["Project 1", "Project 2"]
	 * - projects:
	 *   - Project 1
	 *   - Project 2
	 * Also strips wiki link syntax: "[[Note]]" -> "Note"
	 */
	extractProjectsFromFrontmatter(content: string): string[] {
		const frontmatterMatch = content.match(
			FrontmatterService.FRONTMATTER_REGEX
		);
		if (!frontmatterMatch) {
			return [];
		}

		const frontmatter = frontmatterMatch[1] ?? "";

		// Try array format: projects: ["Project 1", "Project 2"]
		const arrayMatch = frontmatter.match(
			FrontmatterService.PROJECTS_ARRAY_REGEX
		);
		if (arrayMatch) {
			const arrayContent = arrayMatch[1] ?? "";
			return arrayContent
				.split(",")
				.map((p) => p.trim().replace(/^["']|["']$/g, ""))
				.map((p) => this.stripWikiLinkSyntax(p))
				.filter((p) => p.length > 0);
		}

		// Try list format: projects:\n  - Project 1
		const listStartMatch = frontmatter.match(
			FrontmatterService.PROJECTS_LIST_START_REGEX
		);
		if (listStartMatch) {
			const startIndex = listStartMatch.index! + listStartMatch[0].length;
			const remainingContent = frontmatter.slice(startIndex);
			// Match all lines that start with whitespace and dash (list items)
			const listItems: string[] = [];
			const lines = remainingContent.split("\n");
			for (const line of lines) {
				// Check if line is a list item (starts with whitespace + dash)
				const itemMatch = line.match(FrontmatterService.LIST_ITEM_REGEX);
				if (itemMatch) {
					listItems.push(itemMatch[1]!.trim().replace(/^["']|["']$/g, ""));
				} else if (line.trim() && !line.match(/^\s/)) {
					// Non-empty, non-indented line means end of list
					break;
				}
			}
			if (listItems.length > 0) {
				return listItems
					.map((p) => this.stripWikiLinkSyntax(p))
					.filter((p) => p.length > 0);
			}
		}

		return [];
	}

	extractSourceLinkFromContent(content: string): string | null {
		const match = content.match(FrontmatterService.SOURCE_LINK_REGEX);
		return match?.[1] ?? null;
	}

	extractAllTags(content: string): string[] {
		const tags: string[] = [];

		// Extract inline tags
		const inlineMatches = content.match(FrontmatterService.INLINE_TAG_REGEX);
		if (inlineMatches) {
			tags.push(...inlineMatches.map((t) => t.replace(/^#/, "")));
		}

		// Extract frontmatter tags
		const frontmatterMatch = content.match(
			FrontmatterService.FRONTMATTER_REGEX
		);
		if (frontmatterMatch) {
			const frontmatter = frontmatterMatch[1] ?? "";

			// Array format: tags: [input/book, mind/zettel]
			const tagsArrayMatch = frontmatter.match(
				FrontmatterService.TAGS_ARRAY_REGEX
			);
			if (tagsArrayMatch) {
				const arrayTags =
					tagsArrayMatch[1]
						?.split(",")
						.map((t) => t.trim().replace(/^["']|["']$/g, "")) ?? [];
				tags.push(...arrayTags);
			}

			// List format: tags:\n  - input/book
			const tagsListMatch = frontmatter.match(
				FrontmatterService.TAGS_LIST_REGEX
			);
			if (tagsListMatch) {
				const tagLines = tagsListMatch[0].match(/-\s+(\S+)/g) ?? [];
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
		if (FrontmatterService.INPUT_TAG_REGEX.test(content)) {
			return true;
		}

		// Check frontmatter tags
		const frontmatterMatch = content.match(
			FrontmatterService.FRONTMATTER_REGEX
		);
		if (frontmatterMatch) {
			const frontmatter = frontmatterMatch[1] ?? "";
			// Match tags array format: tags: [input/book, other/tag]
			const tagsArrayMatch = frontmatter.match(
				FrontmatterService.TAGS_ARRAY_REGEX
			);
			if (tagsArrayMatch) {
				const tags =
					tagsArrayMatch[1]?.split(",").map((t) => t.trim()) ?? [];
				if (tags.some((t) => t.startsWith("input/"))) {
					return true;
				}
			}
			// Match tags list format: tags:\n  - input/book
			const tagsListMatch = frontmatter.match(
				FrontmatterService.TAGS_LIST_REGEX
			);
			if (tagsListMatch) {
				const tagLines = tagsListMatch[0].match(/-\s+(\S+)/g) ?? [];
				const tags = tagLines.map((t) => t.replace(/^-\s+/, ""));
				if (tags.some((t) => t.startsWith("input/"))) {
					return true;
				}
			}
		}

		return false;
	}

	async setProjectsInFrontmatter(
		file: TFile,
		projects: string[]
	): Promise<void> {
		const content = await this.app.vault.read(file);
		const match = content.match(FrontmatterService.FRONTMATTER_REGEX);

		let newContent: string;
		const projectsLine =
			projects.length > 0
				? `projects: [${projects.map((p) => `"[[${p}]]"`).join(", ")}]`
				: "";

		if (match) {
			const frontmatter = match[1] ?? "";
			// Check if projects field already exists
			if (FrontmatterService.PROJECTS_FIELD_REGEX.test(frontmatter)) {
				// Update existing projects field
				const updatedFrontmatter = frontmatter
					.replace(FrontmatterService.PROJECTS_FIELD_LINE_REGEX, projectsLine)
					.replace(FrontmatterService.PROJECTS_LIST_FULL_REGEX, projectsLine);
				newContent = content.replace(
					FrontmatterService.FRONTMATTER_REGEX,
					`---\n${updatedFrontmatter}\n---`
				);
			} else if (projectsLine) {
				// Add projects field to existing frontmatter
				newContent = content.replace(
					FrontmatterService.FRONTMATTER_REGEX,
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

	/** UID field name in source note frontmatter */
	private readonly SOURCE_UID_FIELD = "flashcard_uid";
	/** UID length for generating short IDs */
	private readonly UID_LENGTH = 8;

	/**
	 * Generate a short UID for flashcard linking (8 hex chars)
	 */
	generateUid(): string {
		return crypto.randomUUID().replace(/-/g, "").slice(0, this.UID_LENGTH);
	}

	async getSourceNoteUid(sourceFile: TFile): Promise<string | null> {
		const content = await this.app.vault.read(sourceFile);
		const match = content.match(FrontmatterService.UID_FIELD_REGEX);
		return match?.[1] ?? null;
	}

	async setSourceNoteUid(sourceFile: TFile, uid: string): Promise<void> {
		const content = await this.app.vault.read(sourceFile);
		const uidField = this.SOURCE_UID_FIELD;
		const match = content.match(FrontmatterService.FRONTMATTER_REGEX);

		let newContent: string;

		if (match) {
			const frontmatter = match[1] ?? "";
			// Check if UID field already exists
			if (FrontmatterService.UID_FIELD_EXISTS_REGEX.test(frontmatter)) {
				// Update existing UID
				newContent = content.replace(
					FrontmatterService.FRONTMATTER_REGEX,
					`---\n${frontmatter.replace(
						FrontmatterService.UID_FIELD_LINE_REGEX,
						`${uidField}: "${uid}"`
					)}\n---`
				);
			} else {
				// Add UID field to existing frontmatter
				newContent = content.replace(
					FrontmatterService.FRONTMATTER_REGEX,
					`---\n${uidField}: "${uid}"\n${frontmatter}\n---`
				);
			}
		} else {
			// Create new frontmatter with UID
			newContent = `---\n${uidField}: "${uid}"\n---\n\n${content}`;
		}

		await this.app.vault.modify(sourceFile, newContent);
	}

	async setFsrsPreset(file: TFile, presetName: string | null): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			if (presetName) {
				fm["fsrs_preset"] = presetName;
			} else {
				delete fm["fsrs_preset"];
			}
		});
	}

	/**
	 * Remove "# Flashcards for [[...]]" header from content
	 * Used for migration of existing files
	 */
	removeFlashcardsHeader(content: string): string {
		return content.replace(/^# Flashcards for \[\[.+?\]\]\n\n?/m, "");
	}
}
