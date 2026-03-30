import type { IFileSystem } from "../../interfaces/file-system";
import type { IFrontmatter } from "../../interfaces/frontmatter";

export class FrontmatterService {
	/** Matches YAML frontmatter block */
	private static readonly FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;
	/** Matches inline tags: #tag/subtag */
	private static readonly INLINE_TAG_REGEX = /#[\w/-]+/g;
	/** Matches tags array format: tags: [a, b] */
	private static readonly TAGS_ARRAY_REGEX = /^tags:\s*\[([^\]]+)\]/m;
	/** Matches tags list format */
	private static readonly TAGS_LIST_REGEX = /^tags:\s*\n(\s+-\s+\S+\s*)+/m;
	/** Matches source_link field */
	private static readonly SOURCE_LINK_REGEX = /source_link:\s*"\[\[(.+?)\]\]"/;
	/** Matches flashcard_uid field */
	private static readonly UID_FIELD_REGEX =
		/flashcard_uid:\s*["']?([a-f0-9]+)["']?/i;

	constructor(
		private fileSystem: IFileSystem,
		private frontmatter: IFrontmatter,
	) {}

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
			FrontmatterService.FRONTMATTER_REGEX,
		);
		if (frontmatterMatch) {
			const frontmatter = frontmatterMatch[1] ?? "";

			// Array format: tags: [science, history]
			const tagsArrayMatch = frontmatter.match(
				FrontmatterService.TAGS_ARRAY_REGEX,
			);
			if (tagsArrayMatch) {
				const arrayTags =
					tagsArrayMatch[1]
						?.split(",")
						.map((t) => t.trim().replace(/^["']|["']$/g, "")) ?? [];
				tags.push(...arrayTags);
			}

			// List format: tags:\n  - science
			const tagsListMatch = frontmatter.match(
				FrontmatterService.TAGS_LIST_REGEX,
			);
			if (tagsListMatch) {
				const tagLines = tagsListMatch[0].match(/-\s+(\S+)/g) ?? [];
				const listTags = tagLines.map((t) =>
					t.replace(/^-\s+/, "").replace(/^["']|["']$/g, ""),
				);
				tags.push(...listTags);
			}
		}

		return tags;
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

	async getSourceNoteUid(filePath: string | { path: string }): Promise<string | null> {
		const p = typeof filePath === "string" ? filePath : filePath.path;
		const content = await this.fileSystem.read(p);
		const match = content.match(FrontmatterService.UID_FIELD_REGEX);
		return match?.[1] ?? null;
	}

	async setSourceNoteUid(filePath: string | { path: string }, uid: string): Promise<void> {
		const p = typeof filePath === "string" ? filePath : filePath.path;
		await this.frontmatter.update(p, {
			[this.SOURCE_UID_FIELD]: uid,
		});
	}

	async setArchive(filePath: string, archived: boolean): Promise<void> {
		if (archived) {
			await this.frontmatter.update(filePath, { archive: true });
		} else {
			await this.frontmatter.update(filePath, { archive: undefined });
		}
	}

	async setFsrsPreset(
		filePath: string,
		presetName: string | null,
	): Promise<void> {
		if (presetName) {
			await this.frontmatter.update(filePath, { fsrs_preset: presetName });
		} else {
			await this.frontmatter.update(filePath, { fsrs_preset: undefined });
		}
	}

	async addParent(filePath: string, parentName: string): Promise<void> {
		const fm = await this.frontmatter.read(filePath);
		const existing: string[] = Array.isArray(fm.parents)
			? (fm.parents as string[])
			: [];
		const names = new Set(
			existing.map((p) => p.replace(/^\[\[|\]\]$/g, "")),
		);
		if (!names.has(parentName)) {
			existing.push(`[[${parentName}]]`);
		}
		await this.frontmatter.update(filePath, { parents: existing });
	}

	async removeParent(filePath: string, parentName: string): Promise<void> {
		const fm = await this.frontmatter.read(filePath);
		const existing: string[] = Array.isArray(fm.parents)
			? (fm.parents as string[])
			: [];
		const filtered = existing.filter(
			(p) => p.replace(/^\[\[|\]\]$/g, "") !== parentName,
		);
		if (filtered.length === 0) {
			await this.frontmatter.update(filePath, { parents: undefined });
		} else {
			await this.frontmatter.update(filePath, { parents: filtered });
		}
	}

	/**
	 * Remove "# Flashcards for [[...]]" header from content
	 * Used for migration of existing files
	 */
	removeFlashcardsHeader(content: string): string {
		return content.replace(/^# Flashcards for \[\[.+?\]\]\n\n?/m, "");
	}
}
