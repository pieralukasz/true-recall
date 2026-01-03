/**
 * Migration Service
 * Handles migration from inline FSRS comments to sharded store
 */
import { App, TFile, normalizePath } from "obsidian";
import type { FSRSCardData } from "../types";
import type { ShardedStoreService, ShardEntry } from "./sharded-store.service";
import { FLASHCARD_CONFIG } from "../constants";

const BACKUP_FOLDER = ".episteme/backup";

export interface MigrationResult {
	success: boolean;
	cardsExtracted: number;
	filesProcessed: number;
	filesCleaned: number;
	errors: string[];
	backupPath?: string;
}

export interface DryRunResult {
	cardsToExtract: number;
	filesToClean: number;
	legacyIdsToRemove: number;
	duplicateFsrsToRemove: number;
	blockIdsToGenerate: number;
}

/**
 * Service for migrating flashcard data to sharded store
 */
export class MigrationService {
	private app: App;
	private store: ShardedStoreService;
	private flashcardsFolder: string;

	constructor(app: App, store: ShardedStoreService, flashcardsFolder: string) {
		this.app = app;
		this.store = store;
		this.flashcardsFolder = flashcardsFolder;
	}

	/**
	 * Update flashcards folder setting
	 */
	setFlashcardsFolder(folder: string): void {
		this.flashcardsFolder = folder;
	}

	/**
	 * Run migration in dry-run mode (no changes, just analysis)
	 */
	async dryRun(): Promise<DryRunResult> {
		const files = this.getFlashcardFiles();
		let cardsToExtract = 0;
		let legacyIdsToRemove = 0;
		let duplicateFsrsToRemove = 0;
		let blockIdsToGenerate = 0;

		const flashcardPattern = new RegExp(
			`^(.+?)\\s*${FLASHCARD_CONFIG.tag}\\s*$`
		);
		const fsrsPattern = new RegExp(
			`${FLASHCARD_CONFIG.fsrsDataPrefix}(.+?)${FLASHCARD_CONFIG.fsrsDataSuffix}`
		);
		const legacyIdPattern = /^ID:\s*\d+/;
		// Match both old fsrs- format and new UUID format
		const blockIdPattern = /^\^(fsrs-[a-zA-Z0-9]+|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;

		for (const file of files) {
			const content = await this.app.vault.read(file);
			const lines = content.split("\n");

			let inCard = false;
			let cardFsrsCount = 0;
			let cardHasBlockId = false;

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i] ?? "";

				if (line.match(flashcardPattern)) {
					// New card started
					if (inCard && cardFsrsCount > 0) {
						cardsToExtract++;
						if (cardFsrsCount > 1) {
							duplicateFsrsToRemove += cardFsrsCount - 1;
						}
						if (!cardHasBlockId) {
							blockIdsToGenerate++;
						}
					}
					inCard = true;
					cardFsrsCount = 0;
					cardHasBlockId = false;
					continue;
				}

				if (inCard) {
					if (line.match(legacyIdPattern)) {
						legacyIdsToRemove++;
					}
					if (line.match(fsrsPattern)) {
						cardFsrsCount++;
					}
					if (line.match(blockIdPattern)) {
						cardHasBlockId = true;
					}
					if (line.trim() === "") {
						// End of card
						if (cardFsrsCount > 0) {
							cardsToExtract++;
							if (cardFsrsCount > 1) {
								duplicateFsrsToRemove += cardFsrsCount - 1;
							}
							if (!cardHasBlockId) {
								blockIdsToGenerate++;
							}
						}
						inCard = false;
						cardFsrsCount = 0;
						cardHasBlockId = false;
					}
				}
			}

			// Handle last card in file
			if (inCard && cardFsrsCount > 0) {
				cardsToExtract++;
				if (cardFsrsCount > 1) {
					duplicateFsrsToRemove += cardFsrsCount - 1;
				}
				if (!cardHasBlockId) {
					blockIdsToGenerate++;
				}
			}
		}

		return {
			cardsToExtract,
			filesToClean: files.length,
			legacyIdsToRemove,
			duplicateFsrsToRemove,
			blockIdsToGenerate,
		};
	}

	/**
	 * Run full migration
	 */
	async migrate(): Promise<MigrationResult> {
		const result: MigrationResult = {
			success: false,
			cardsExtracted: 0,
			filesProcessed: 0,
			filesCleaned: 0,
			errors: [],
		};

		try {
			// Step 1: Create backup
			const backupPath = await this.createBackup();
			result.backupPath = backupPath;

			// Step 2: Extract all FSRS data from files
			const extractedCards = await this.extractAllFsrsData();
			result.cardsExtracted = extractedCards.size;

			// Step 3: Import to sharded store
			this.store.importBulk(extractedCards);

			// Step 4: Flush store to disk
			await this.store.flush();

			// Step 5: Clean markdown files
			const cleanResult = await this.cleanAllFiles();
			result.filesProcessed = cleanResult.filesProcessed;
			result.filesCleaned = cleanResult.filesCleaned;

			result.success = true;
		} catch (error) {
			result.errors.push(
				error instanceof Error ? error.message : String(error)
			);
		}

		return result;
	}

	/**
	 * Create backup of all flashcard files
	 */
	private async createBackup(): Promise<string> {
		const timestamp = new Date().toISOString().split("T")[0];
		const backupPath = normalizePath(`${BACKUP_FOLDER}-${timestamp}`);

		// Ensure backup folder exists
		const exists = await this.app.vault.adapter.exists(backupPath);
		if (!exists) {
			await this.app.vault.adapter.mkdir(backupPath);
		}

		const files = this.getFlashcardFiles();

		for (const file of files) {
			const content = await this.app.vault.read(file);
			const backupFilePath = normalizePath(
				`${backupPath}/${file.name}`
			);
			await this.app.vault.adapter.write(backupFilePath, content);
		}

		return backupPath;
	}

	/**
	 * Extract all FSRS data from flashcard files
	 */
	private async extractAllFsrsData(): Promise<Map<string, ShardEntry>> {
		const cards = new Map<string, ShardEntry>();
		const files = this.getFlashcardFiles();

		const flashcardPattern = new RegExp(
			`^(.+?)\\s*${FLASHCARD_CONFIG.tag}\\s*$`
		);
		const fsrsPattern = new RegExp(
			`${FLASHCARD_CONFIG.fsrsDataPrefix}(.+?)${FLASHCARD_CONFIG.fsrsDataSuffix}`
		);
		// Match both old fsrs- format and new UUID format
		const blockIdPattern = /^\^(fsrs-[a-zA-Z0-9]+|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;

		for (const file of files) {
			const content = await this.app.vault.read(file);
			const lines = content.split("\n");

			let currentCardLine = -1;
			let fsrsDataList: FSRSCardData[] = [];
			let existingBlockId: string | null = null;

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i] ?? "";
				const flashcardMatch = line.match(flashcardPattern);

				if (flashcardMatch) {
					// Save previous card if exists
					if (currentCardLine >= 0 && fsrsDataList.length > 0) {
						const fsrsData = this.selectBestFsrsData(fsrsDataList);
						const cardId = existingBlockId || fsrsData.id;
						cards.set(cardId, {
							...fsrsData,
							id: cardId,
							filePath: file.path,
							lineNumber: currentCardLine + 1,
						});
					}

					// Start new card
					currentCardLine = i;
					fsrsDataList = [];
					existingBlockId = null;
					continue;
				}

				if (currentCardLine >= 0) {
					// Check for FSRS data
					const fsrsMatch = line.match(fsrsPattern);
					if (fsrsMatch?.[1]) {
						try {
							const data = JSON.parse(fsrsMatch[1]) as FSRSCardData;
							fsrsDataList.push(data);
						} catch {
							// Skip invalid JSON
						}
						continue;
					}

					// Check for existing block ID
					const blockIdMatch = line.match(blockIdPattern);
					if (blockIdMatch?.[1]) {
						// Use the block ID as-is (could be fsrs-xxx or UUID)
						existingBlockId = blockIdMatch[1];
						continue;
					}

					// Empty line = end of card
					if (line.trim() === "" && fsrsDataList.length > 0) {
						const fsrsData = this.selectBestFsrsData(fsrsDataList);
						const cardId = existingBlockId || fsrsData.id;
						cards.set(cardId, {
							...fsrsData,
							id: cardId,
							filePath: file.path,
							lineNumber: currentCardLine + 1,
						});
						currentCardLine = -1;
						fsrsDataList = [];
						existingBlockId = null;
					}
				}
			}

			// Handle last card in file
			if (currentCardLine >= 0 && fsrsDataList.length > 0) {
				const fsrsData = this.selectBestFsrsData(fsrsDataList);
				const cardId = existingBlockId || fsrsData.id;
				cards.set(cardId, {
					...fsrsData,
					id: cardId,
					filePath: file.path,
					lineNumber: currentCardLine + 1,
				});
			}
		}

		return cards;
	}

	/**
	 * Select best FSRS data when duplicates exist
	 * Strategy: prefer data with higher reps, or most recent lastReview
	 */
	private selectBestFsrsData(dataList: FSRSCardData[]): FSRSCardData {
		if (dataList.length === 1) {
			return dataList[0]!;
		}

		// Sort by reps (desc), then by lastReview (desc)
		return dataList.sort((a, b) => {
			// Higher reps wins
			if (a.reps !== b.reps) {
				return b.reps - a.reps;
			}

			// More recent lastReview wins
			if (a.lastReview && b.lastReview) {
				return (
					new Date(b.lastReview).getTime() -
					new Date(a.lastReview).getTime()
				);
			}

			// Having lastReview wins over not having it
			if (a.lastReview && !b.lastReview) return -1;
			if (!a.lastReview && b.lastReview) return 1;

			return 0;
		})[0]!;
	}

	/**
	 * Clean all flashcard files (remove inline FSRS, add block IDs)
	 */
	private async cleanAllFiles(): Promise<{
		filesProcessed: number;
		filesCleaned: number;
	}> {
		const files = this.getFlashcardFiles();
		let filesProcessed = 0;
		let filesCleaned = 0;

		for (const file of files) {
			filesProcessed++;
			const wasModified = await this.cleanFile(file);
			if (wasModified) {
				filesCleaned++;
			}
		}

		return { filesProcessed, filesCleaned };
	}

	/**
	 * Clean a single file
	 */
	private async cleanFile(file: TFile): Promise<boolean> {
		const content = await this.app.vault.read(file);
		const lines = content.split("\n");
		const newLines: string[] = [];

		const flashcardPattern = new RegExp(
			`^(.+?)\\s*${FLASHCARD_CONFIG.tag}\\s*$`
		);
		const fsrsPattern = new RegExp(
			`${FLASHCARD_CONFIG.fsrsDataPrefix}(.+?)${FLASHCARD_CONFIG.fsrsDataSuffix}`
		);
		const legacyIdPattern = /^ID:\s*\d+/;
		// Match both old fsrs- format and new UUID format
		const blockIdPattern = /^\^(fsrs-[a-zA-Z0-9]+|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;

		let currentCardId: string | null = null;
		let cardHasBlockId = false;
		let modified = false;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i] ?? "";
			const flashcardMatch = line.match(flashcardPattern);

			if (flashcardMatch) {
				// Add block ID for previous card if needed
				if (currentCardId && !cardHasBlockId) {
					// Insert block ID before this line (at end of previous card)
					const blockId = this.generateBlockId(currentCardId);
					newLines.push(`^${blockId}`);
					modified = true;
				}

				// Start new card - look up its ID from store
				const storeCard = this.findCardInStore(file.path, i + 1);
				currentCardId = storeCard?.id || null;
				cardHasBlockId = false;
				newLines.push(line);
				continue;
			}

			// Skip legacy ID lines
			if (line.match(legacyIdPattern)) {
				modified = true;
				continue;
			}

			// Skip FSRS comment lines
			if (line.match(fsrsPattern)) {
				modified = true;
				continue;
			}

			// Check for existing block ID
			if (line.match(blockIdPattern)) {
				cardHasBlockId = true;
				// Keep the existing block ID
				newLines.push(line);
				continue;
			}

			// Empty line = end of card
			if (line.trim() === "") {
				// Add block ID if needed
				if (currentCardId && !cardHasBlockId) {
					const blockId = this.generateBlockId(currentCardId);
					newLines.push(`^${blockId}`);
					modified = true;
				}
				currentCardId = null;
				cardHasBlockId = false;
			}

			newLines.push(line);
		}

		// Handle last card in file
		if (currentCardId && !cardHasBlockId) {
			const blockId = this.generateBlockId(currentCardId);
			newLines.push(`^${blockId}`);
			modified = true;
		}

		if (modified) {
			const newContent = newLines.join("\n");
			await this.app.vault.modify(file, newContent);
		}

		return modified;
	}

	/**
	 * Find card in store by file path and line number
	 */
	private findCardInStore(
		filePath: string,
		lineNumber: number
	): ShardEntry | undefined {
		const allCards = this.store.getAll();
		return allCards.find(
			(card) =>
				card.filePath === filePath && card.lineNumber === lineNumber
		);
	}

	/**
	 * Generate block ID - use full UUID for consistency with store
	 */
	private generateBlockId(cardId: string): string {
		return cardId;
	}

	/**
	 * Get all flashcard files
	 */
	private getFlashcardFiles(): TFile[] {
		const folderPath = normalizePath(this.flashcardsFolder);
		return this.app.vault
			.getMarkdownFiles()
			.filter(
				(file) =>
					file.path.startsWith(folderPath + "/") &&
					file.name.startsWith(FLASHCARD_CONFIG.filePrefix)
			);
	}

	/**
	 * Verify migration integrity
	 * Compares cards in store with cards detected in markdown files
	 */
	async verifyIntegrity(): Promise<{
		storeCount: number;
		fileCount: number;
		orphanedInStore: string[];
		missingFromStore: string[];
	}> {
		const storeCards = this.store.getAll();
		const storeIds = new Set(storeCards.map((c) => c.id));

		// Count cards in files (by block ID)
		const fileBlockIds = new Set<string>();
		const files = this.getFlashcardFiles();
		// Match both old fsrs- format and new UUID format
		const blockIdPattern = /^\^(fsrs-[a-zA-Z0-9]+|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;

		for (const file of files) {
			const content = await this.app.vault.read(file);
			const lines = content.split("\n");

			for (const line of lines) {
				const match = line.match(blockIdPattern);
				if (match?.[1]) {
					fileBlockIds.add(match[1]);
				}
			}
		}

		const orphanedInStore = storeCards
			.filter((c) => !fileBlockIds.has(c.id))
			.map((c) => c.id);

		const missingFromStore = Array.from(fileBlockIds).filter(
			(id) => !storeIds.has(id)
		);

		return {
			storeCount: storeCards.length,
			fileCount: fileBlockIds.size,
			orphanedInStore,
			missingFromStore,
		};
	}

	/**
	 * Clean flashcard files without migration (remove legacy IDs and duplicate FSRS)
	 */
	async cleanFilesOnly(): Promise<{
		filesProcessed: number;
		legacyIdsRemoved: number;
		duplicateFsrsRemoved: number;
	}> {
		const files = this.getFlashcardFiles();
		let filesProcessed = 0;
		let legacyIdsRemoved = 0;
		let duplicateFsrsRemoved = 0;

		const flashcardPattern = new RegExp(
			`^(.+?)\\s*${FLASHCARD_CONFIG.tag}\\s*$`
		);
		const fsrsPattern = new RegExp(
			`${FLASHCARD_CONFIG.fsrsDataPrefix}(.+?)${FLASHCARD_CONFIG.fsrsDataSuffix}`
		);
		const legacyIdPattern = /^ID:\s*\d+/;

		for (const file of files) {
			const content = await this.app.vault.read(file);
			const lines = content.split("\n");
			const newLines: string[] = [];
			let modified = false;

			let fsrsLinesInCard: { index: number; line: string }[] = [];
			let cardStarted = false;

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i] ?? "";

				if (line.match(flashcardPattern)) {
					// Process previous card's FSRS lines
					if (fsrsLinesInCard.length > 1) {
						// Keep only the last FSRS line (matches parser behavior)
						duplicateFsrsRemoved += fsrsLinesInCard.length - 1;
						modified = true;
					}
					fsrsLinesInCard = [];
					cardStarted = true;
					newLines.push(line);
					continue;
				}

				// Skip legacy ID lines
				if (line.match(legacyIdPattern)) {
					legacyIdsRemoved++;
					modified = true;
					continue;
				}

				// Track FSRS lines
				if (line.match(fsrsPattern)) {
					fsrsLinesInCard.push({ index: newLines.length, line });
					// Only add if it's the last one in this card
					// We'll handle this when we see the next card or end of file
				}

				// Empty line = end of card
				if (line.trim() === "" && cardStarted) {
					// Keep only last FSRS line
					if (fsrsLinesInCard.length > 0) {
						newLines.push(
							fsrsLinesInCard[fsrsLinesInCard.length - 1]!.line
						);
						if (fsrsLinesInCard.length > 1) {
							duplicateFsrsRemoved += fsrsLinesInCard.length - 1;
							modified = true;
						}
					}
					fsrsLinesInCard = [];
					cardStarted = false;
					newLines.push(line);
					continue;
				}

				// Regular line (not FSRS)
				if (!line.match(fsrsPattern)) {
					newLines.push(line);
				}
			}

			// Handle last card
			if (fsrsLinesInCard.length > 0) {
				newLines.push(fsrsLinesInCard[fsrsLinesInCard.length - 1]!.line);
				if (fsrsLinesInCard.length > 1) {
					duplicateFsrsRemoved += fsrsLinesInCard.length - 1;
					modified = true;
				}
			}

			if (modified) {
				const newContent = newLines.join("\n");
				await this.app.vault.modify(file, newContent);
			}

			filesProcessed++;
		}

		return { filesProcessed, legacyIdsRemoved, duplicateFsrsRemoved };
	}

	/**
	 * Update short block IDs (fsrs-xxxxxxxx) to full UUID format
	 * Matches block IDs in files with store IDs and replaces them
	 */
	async updateBlockIdsToUUID(): Promise<{
		filesModified: number;
		blockIdsUpdated: number;
	}> {
		const files = this.getFlashcardFiles();
		let filesModified = 0;
		let blockIdsUpdated = 0;

		// Build a map of short prefix -> full UUID from store
		const storeCards = this.store.getAll();
		const prefixToUUID = new Map<string, string>();
		for (const card of storeCards) {
			// Extract first 8 hex chars from UUID
			const prefix = card.id.replace(/-/g, "").substring(0, 8).toLowerCase();
			prefixToUUID.set(prefix, card.id);
		}

		const shortBlockIdPattern = /^\^fsrs-([a-zA-Z0-9]+)$/;

		for (const file of files) {
			const content = await this.app.vault.read(file);
			const lines = content.split("\n");
			let modified = false;

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i] ?? "";
				const match = line.match(shortBlockIdPattern);

				if (match?.[1]) {
					const shortId = match[1].toLowerCase();
					const fullUUID = prefixToUUID.get(shortId);

					if (fullUUID) {
						lines[i] = `^${fullUUID}`;
						modified = true;
						blockIdsUpdated++;
					}
				}
			}

			if (modified) {
				const newContent = lines.join("\n");
				await this.app.vault.modify(file, newContent);
				filesModified++;
			}
		}

		return { filesModified, blockIdsUpdated };
	}
}
