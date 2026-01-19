/**
 * Source Note Service
 * Handles source note management operations
 *
 * Extracted from FlashcardManager to reduce god class complexity.
 * Source notes are the original markdown files that flashcards are generated from.
 */
import { App, TFile } from "obsidian";
import type { CardStore, SourceNoteInfo } from "../../types";
import { FrontmatterService } from "./frontmatter.service";

/**
 * Service for managing source note relationships
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
	 * Register a source note in the store
	 *
	 * @param store - The card store
	 * @param uid - The source note UID
	 * @param file - The source note file
	 */
	registerSourceNote(
		store: CardStore,
		uid: string,
		file: TFile
	): void {
		const sqlStore = store as CardStore & {
			upsertSourceNote?: (info: SourceNoteInfo) => void;
		};

		if (sqlStore.upsertSourceNote) {
			sqlStore.upsertSourceNote({
				uid,
				noteName: file.basename,
				notePath: file.path,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
		}
	}

	/**
	 * Get source note info from the store
	 *
	 * @param store - The card store
	 * @param uid - The source note UID
	 * @returns Source note info if found
	 */
	getSourceNoteInfo(store: CardStore, uid: string): SourceNoteInfo | null {
		const sqlStore = store as CardStore & {
			getSourceNote?: (uid: string) => SourceNoteInfo | null;
		};

		return sqlStore.getSourceNote?.(uid) ?? null;
	}

	/**
	 * Resolve source note name and path from UID
	 *
	 * @param store - The card store
	 * @param sourceUid - The source note UID
	 * @returns Object with noteName and notePath if found
	 */
	resolveSourceNote(
		store: CardStore,
		sourceUid: string | undefined
	): { noteName?: string; notePath?: string } {
		if (!sourceUid) {
			return {};
		}

		const sourceNote = this.getSourceNoteInfo(store, sourceUid);
		return {
			noteName: sourceNote?.noteName,
			notePath: sourceNote?.notePath,
		};
	}

	/**
	 * Get file from source note info
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
	 *
	 * @param store - The card store
	 * @param uid - The source note UID
	 * @returns The source note file if found
	 */
	findSourceNoteByUid(store: CardStore, uid: string): TFile | null {
		const info = this.getSourceNoteInfo(store, uid);
		if (!info?.notePath) return null;

		return this.getSourceNoteFile(info.notePath);
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
}
