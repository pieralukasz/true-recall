/**
 * Flashcard Migration Service
 * Handles migration from legacy filename-based linking to UUID-based linking
 */
import { App, TFile, normalizePath, Notice } from "obsidian";
import { FLASHCARD_CONFIG } from "../../constants";
import type { EpistemeSettings } from "../../types";
import type { FlashcardManager } from "../flashcard/flashcard.service";
import type { FrontmatterService } from "../flashcard/frontmatter.service";

/**
 * Result of migration operation
 */
export interface MigrationResult {
	migratedCount: number;
	skippedCount: number;
	errorCount: number;
	errors: Array<{ notePath: string; error: string }>;
}

/**
 * Service for migrating flashcard files from legacy to UID-based naming
 */
export class FlashcardMigrationService {
	constructor(
		private app: App,
		private flashcardManager: FlashcardManager,
		private frontmatterService: FrontmatterService,
		private settings: EpistemeSettings
	) {}

	/**
	 * Migrate all legacy flashcard files to UID system
	 */
	async migrateAll(): Promise<MigrationResult> {
		const result: MigrationResult = {
			migratedCount: 0,
			skippedCount: 0,
			errorCount: 0,
			errors: [],
		};

		const flashcardFolder = normalizePath(this.settings.flashcardsFolder);

		// Find all legacy flashcard files (starting with flashcards_)
		const legacyFiles = this.app.vault
			.getMarkdownFiles()
			.filter(
				(f) =>
					f.path.startsWith(flashcardFolder + "/") &&
					f.name.startsWith(FLASHCARD_CONFIG.filePrefix)
			);

		if (legacyFiles.length === 0) {
			new Notice("No legacy flashcard files found to migrate.");
			return result;
		}

		new Notice(`Found ${legacyFiles.length} legacy files to migrate...`);

		for (const legacyFile of legacyFiles) {
			try {
				const migrated = await this.migrateFile(legacyFile);
				if (migrated) {
					result.migratedCount++;
				} else {
					result.skippedCount++;
				}
			} catch (error) {
				result.errorCount++;
				result.errors.push({
					notePath: legacyFile.path,
					error: error instanceof Error ? error.message : String(error),
				});
				console.error(`Migration error for ${legacyFile.path}:`, error);
			}
		}

		return result;
	}

	/**
	 * Migrate a single legacy flashcard file
	 * Returns true if migrated, false if skipped
	 */
	async migrateFile(flashcardFile: TFile): Promise<boolean> {
		const content = await this.app.vault.read(flashcardFile);

		// Extract source note name from frontmatter
		const sourceNoteName = this.frontmatterService.extractSourceLinkFromContent(content);
		if (!sourceNoteName) {
			throw new Error("No source_link found in flashcard file frontmatter");
		}

		// Find source note
		const sourceFile = this.app.vault
			.getMarkdownFiles()
			.find((f) => f.basename === sourceNoteName);

		if (!sourceFile) {
			throw new Error(`Source note "${sourceNoteName}" not found in vault`);
		}

		// Check if source note already has UID
		let uid = await this.frontmatterService.getSourceNoteUid(sourceFile);
		const uidAlreadyExists = !!uid;

		// Check if already migrated (UID file exists)
		if (uid) {
			const newPath = this.flashcardManager.getFlashcardPathByUid(uid);
			const existingUidFile = this.app.vault.getAbstractFileByPath(newPath);
			if (existingUidFile instanceof TFile) {
				// Already migrated
				return false;
			}
		}

		// Generate new UID if needed
		if (!uid) {
			uid = this.frontmatterService.generateUid();
		}

		// Step 1: Add UID to source note frontmatter (if not present)
		if (!uidAlreadyExists) {
			await this.frontmatterService.setSourceNoteUid(sourceFile, uid);
		}

		// Step 2: Update flashcard file frontmatter (add source_uid)
		const updatedContent = this.addSourceUidToFlashcardContent(content, uid);

		// Step 3: Rename flashcard file to UID-based name
		const newPath = this.flashcardManager.getFlashcardPathByUid(uid);

		// Update content first
		await this.app.vault.modify(flashcardFile, updatedContent);

		// Then rename file
		await this.app.fileManager.renameFile(flashcardFile, newPath);

		return true;
	}

	/**
	 * Add source_uid field to flashcard file frontmatter
	 */
	private addSourceUidToFlashcardContent(content: string, uid: string): string {
		const uidField = FLASHCARD_CONFIG.flashcardUidField;
		const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
		const match = content.match(frontmatterRegex);

		if (!match) {
			// No frontmatter - shouldn't happen for flashcard files, but handle it
			return content;
		}

		const frontmatter = match[1] ?? "";

		// Check if source_uid already exists
		if (new RegExp(`^${uidField}:`, "m").test(frontmatter)) {
			// Already has UID - update it
			return content.replace(
				frontmatterRegex,
				`---\n${frontmatter.replace(
					new RegExp(`^${uidField}:.*$`, "m"),
					`${uidField}: "${uid}"`
				)}\n---`
			);
		}

		// Add source_uid at the beginning of frontmatter
		return content.replace(frontmatterRegex, `---\n${uidField}: "${uid}"\n${frontmatter}\n---`);
	}

	/**
	 * Check how many legacy files would be migrated (dry run)
	 */
	async countLegacyFiles(): Promise<number> {
		const flashcardFolder = normalizePath(this.settings.flashcardsFolder);
		return this.app.vault
			.getMarkdownFiles()
			.filter(
				(f) =>
					f.path.startsWith(flashcardFolder + "/") &&
					f.name.startsWith(FLASHCARD_CONFIG.filePrefix)
			).length;
	}
}
