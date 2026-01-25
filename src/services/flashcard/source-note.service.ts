/**
 * Source Note Service
 * Handles source note management operations
 *
 * v17: Source notes removed - all metadata resolved from vault
 * v15: Source note name and path are resolved from vault at runtime
 * (no longer stored in database)
 */
import { App, TFile } from "obsidian";
import type { SqliteStoreService } from "../persistence/sqlite/SqliteStoreService";
import { FrontmatterService } from "./frontmatter.service";

/**
 * Service for managing source note relationships
 * v17: Resolves source note info from vault (no database storage)
 */
export class SourceNoteService {
	private app: App;
	private frontmatterService: FrontmatterService;

	constructor(app: App) {
		this.app = app;
		this.frontmatterService = new FrontmatterService(app);
	}

	/**
	 * Get or create UID for a source note
	 * If the note doesn't have a flashcard_uid, generates one
	 *
	 * @param file - The source note file
	 * @returns The UID of the source note
	 */
	async getOrCreateSourceUid(file: TFile): Promise<string> {
		let uid = await this.frontmatterService.getSourceNoteUid(file);

		if (!uid) {
			uid = this.frontmatterService.generateUid();
			await this.frontmatterService.setSourceNoteUid(file, uid);
		}

		return uid;
	}

	/**
	 * Get the UID of a source note (without creating one)
	 *
	 * @param file - The source note file
	 * @returns The UID if it exists, null otherwise
	 */
	async getSourceUid(file: TFile): Promise<string | null> {
		return this.frontmatterService.getSourceNoteUid(file);
	}

	/**
	 * Set the UID for a source note
	 *
	 * @param file - The source note file
	 * @param uid - The UID to set
	 */
	async setSourceUid(file: TFile, uid: string): Promise<void> {
		await this.frontmatterService.setSourceNoteUid(file, uid);
	}

	/**
	 * Resolve source note name and path from UID
	 * v17: Searches vault for file with matching flashcard_uid in frontmatter
	 *
	 * @param sourceUid - The source note UID
	 * @returns Object with noteName and notePath if found
	 */
	resolveSourceNote(sourceUid: string | undefined): { noteName?: string; notePath?: string } {
		if (!sourceUid) {
			return {};
		}

		// Find file by UID in vault
		const file = this.findFileByUidSync(sourceUid);
		if (!file) {
			return {};
		}

		return {
			noteName: file.basename,
			notePath: file.path,
		};
	}

	/**
	 * Get file from path
	 *
	 * @param notePath - Path to the source note
	 * @returns The file if found, null otherwise
	 */
	getSourceNoteFile(notePath: string): TFile | null {
		const abstractFile = this.app.vault.getAbstractFileByPath(notePath);
		return abstractFile instanceof TFile ? abstractFile : null;
	}

	/**
	 * Find a source note by UID
	 * v17: Searches vault for file with matching flashcard_uid in frontmatter
	 *
	 * @param uid - The source note UID
	 * @returns The source note file if found
	 */
	findSourceNoteByUid(uid: string): TFile | null {
		return this.findFileByUidSync(uid);
	}

	/**
	 * Find a file in the vault by its flashcard_uid
	 * Synchronous version that reads from cache
	 */
	private findFileByUidSync(uid: string): TFile | null {
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			const frontmatter = cache?.frontmatter;

			if (frontmatter?.flashcard_uid === uid) {
				return file;
			}
		}

		return null;
	}

	/**
	 * Check if a note has flashcards associated with it
	 *
	 * @param file - The note file
	 * @returns True if the note has a flashcard_uid in frontmatter
	 */
	async hasFlashcards(file: TFile): Promise<boolean> {
		const uid = await this.getSourceUid(file);
		return uid !== null;
	}

	/**
	 * Enrich a card with source note info resolved from vault
	 * Adds sourceNoteName, sourceNotePath, and projects from frontmatter
	 *
	 * @param card - Card with sourceUid
	 * @returns Card enriched with resolved source note info
	 */
	enrichCard<T extends { sourceUid?: string }>(card: T): T & {
		sourceNoteName: string;
		sourceNotePath: string;
		projects: string[];
	} {
		if (!card.sourceUid) {
			return { ...card, sourceNoteName: "", sourceNotePath: "", projects: [] };
		}

		const file = this.findFileByUidSync(card.sourceUid);
		if (!file) {
			return { ...card, sourceNoteName: "", sourceNotePath: "", projects: [] };
		}

		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
		const rawProjects = frontmatter?.projects;
		const projects = Array.isArray(rawProjects) ? rawProjects : [];

		return {
			...card,
			sourceNoteName: file.basename,
			sourceNotePath: file.path,
			projects,
		};
	}

	/**
	 * Enrich multiple cards with source note info
	 * Optimized version that caches file lookups
	 *
	 * @param cards - Cards with sourceUid
	 * @returns Cards enriched with resolved source note info
	 */
	enrichCards<T extends { sourceUid?: string }>(cards: T[]): Array<T & {
		sourceNoteName: string;
		sourceNotePath: string;
		projects: string[];
	}> {
		// Build UID -> file cache for performance
		const uidToFile = new Map<string, TFile>();
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			const uid = cache?.frontmatter?.flashcard_uid;
			if (uid) {
				uidToFile.set(uid, file);
			}
		}

		return cards.map(card => {
			if (!card.sourceUid) {
				return { ...card, sourceNoteName: "", sourceNotePath: "", projects: [] };
			}

			const file = uidToFile.get(card.sourceUid);
			if (!file) {
				return { ...card, sourceNoteName: "", sourceNotePath: "", projects: [] };
			}

			const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
			const rawProjects = frontmatter?.projects;
			const projects = Array.isArray(rawProjects) ? rawProjects : [];

			return {
				...card,
				sourceNoteName: file.basename,
				sourceNotePath: file.path,
				projects,
			};
		});
	}
}
