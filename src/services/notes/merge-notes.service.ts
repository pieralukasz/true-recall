import { App, TFile, normalizePath } from "obsidian";
import type { SqliteStoreService } from "../persistence/sqlite/SqliteStoreService";
import type { FrontmatterService } from "../flashcard/frontmatter.service";
import type { CardRepository } from "../flashcard/card-repository.service";

export interface MergeNotesOptions {
	sourceNotes: TFile[];
	newNoteName: string;
}

export interface MergeNotesResult {
	success: boolean;
	mergedNote: TFile | null;
	cardsMoved: number;
	errors: string[];
}

interface SourceNoteData {
	file: TFile;
	content: string;
	sourceUid: string | null;
	projects: string[];
}

export class MergeNotesService {
	constructor(
		private app: App,
		private store: SqliteStoreService,
		private frontmatterService: FrontmatterService,
		private cardRepository: CardRepository
	) {}

	async mergeNotes(options: MergeNotesOptions): Promise<MergeNotesResult> {
		const { sourceNotes, newNoteName } = options;
		const errors: string[] = [];

		if (sourceNotes.length < 2) {
			return {
				success: false,
				mergedNote: null,
				cardsMoved: 0,
				errors: ["At least 2 notes are required for merging"],
			};
		}

		// 1. Read all source notes data
		const sourceData = await this.collectSourceData(sourceNotes);

		// 2. Generate new UID for merged note
		const newSourceUid = this.frontmatterService.generateUid();

		// 3. Build merged content
		const mergedContent = this.buildMergedContent(sourceData, newSourceUid);

		// 4. Determine target folder (same as first source note)
		const targetFolder = sourceNotes[0]!.parent?.path ?? "";
		const targetPath = normalizePath(`${targetFolder}/${newNoteName}.md`);

		// 5. Check if file already exists
		if (this.app.vault.getAbstractFileByPath(targetPath)) {
			return {
				success: false,
				mergedNote: null,
				cardsMoved: 0,
				errors: [`File already exists: ${targetPath}`],
			};
		}

		// 6. Create merged note
		let mergedNote: TFile;
		try {
			mergedNote = await this.app.vault.create(targetPath, mergedContent);
		} catch (error) {
			return {
				success: false,
				mergedNote: null,
				cardsMoved: 0,
				errors: [`Failed to create merged note: ${error}`],
			};
		}

		// 7. Transfer flashcards from all source notes to new note
		const cardsMoved = await this.transferFlashcards(sourceData, newSourceUid);

		// 8. Move source notes to trash
		for (const data of sourceData) {
			try {
				await this.app.vault.trash(data.file, false);
			} catch (error) {
				errors.push(`Failed to delete source note ${data.file.basename}: ${error}`);
			}
		}

		return {
			success: true,
			mergedNote,
			cardsMoved,
			errors,
		};
	}

	private async collectSourceData(sourceNotes: TFile[]): Promise<SourceNoteData[]> {
		const result: SourceNoteData[] = [];

		for (const file of sourceNotes) {
			const content = await this.app.vault.read(file);
			const sourceUid = await this.frontmatterService.getSourceNoteUid(file);
			const projects = this.frontmatterService.extractProjectsFromFrontmatter(content);

			result.push({
				file,
				content,
				sourceUid,
				projects,
			});
		}

		return result;
	}

	private buildMergedContent(sourceData: SourceNoteData[], newSourceUid: string): string {
		// Collect all unique projects
		const allProjects = new Set<string>();
		for (const data of sourceData) {
			for (const project of data.projects) {
				allProjects.add(project);
			}
		}

		// Build frontmatter
		const projectsLine = allProjects.size > 0
			? `projects: [${Array.from(allProjects).map(p => `"[[${p}]]"`).join(", ")}]`
			: "";

		const frontmatter = [
			"---",
			`flashcard_uid: "${newSourceUid}"`,
			"tags:",
			"  - input/thinking",
			projectsLine,
			"---",
		].filter(line => line !== "").join("\n");

		// Build body from all source notes
		const bodyParts: string[] = [];

		for (const data of sourceData) {
			const bodyContent = this.extractBodyContent(data.content);
			if (bodyContent.trim()) {
				bodyParts.push(`<!-- From: ${data.file.basename} -->\n${bodyContent}`);
			}
		}

		return `${frontmatter}\n\n${bodyParts.join("\n\n---\n\n")}`;
	}

	private extractBodyContent(content: string): string {
		// Remove frontmatter
		const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n*/);
		if (frontmatterMatch) {
			return content.slice(frontmatterMatch[0].length);
		}
		return content;
	}

	private async transferFlashcards(
		sourceData: SourceNoteData[],
		newSourceUid: string
	): Promise<number> {
		let movedCount = 0;

		for (const data of sourceData) {
			if (!data.sourceUid) continue;

			// Get all cards from this source note
			const cards = this.store.getCardsBySourceUid(data.sourceUid);

			for (const card of cards) {
				const success = this.cardRepository.updateSourceUid(card.id, newSourceUid);
				if (success) {
					movedCount++;
				}
			}
		}

		return movedCount;
	}

	/**
	 * Get all notes with #mind/zettel tag
	 */
	getZettelNotes(): TFile[] {
		const allFiles = this.app.vault.getMarkdownFiles();

		return allFiles.filter(file => {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache) return false;

			// Check frontmatter tags
			const fmTags = cache.frontmatter?.tags;
			if (fmTags) {
				const tagList = Array.isArray(fmTags) ? fmTags : [fmTags];
				if (tagList.some(t => t === "mind/zettel" || t === "#mind/zettel")) {
					return true;
				}
			}

			// Check inline tags
			const tags = cache.tags ?? [];
			if (tags.some(t => t.tag === "#mind/zettel")) {
				return true;
			}

			return false;
		});
	}

	/**
	 * Get card count for a specific note
	 */
	getCardCountForNote(file: TFile): number {
		const cache = this.app.metadataCache.getFileCache(file);
		const uid = cache?.frontmatter?.flashcard_uid as string | undefined;

		if (!uid) return 0;

		const cards = this.store.getCardsBySourceUid(uid);
		return cards.length;
	}
}
