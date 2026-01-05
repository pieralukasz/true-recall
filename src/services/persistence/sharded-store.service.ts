/**
 * Sharded Store Service
 * High-performance storage for FSRS card data using 256 sharded JSON files
 * Provides O(1) lookups and minimal sync conflicts
 */
import { App, normalizePath } from "obsidian";
import type { FSRSCardData } from "../../types";

const STORE_FOLDER = ".episteme/store";
const DEBOUNCE_MS = 2000;
const MAX_HISTORY_ENTRIES = 20;

/**
 * Entry stored in a shard file
 * Contains only FSRS scheduling data (filePath/lineNumber come from file parsing)
 */
export interface ShardEntry extends FSRSCardData {}

/**
 * Shard file structure
 */
type ShardData = Record<string, ShardEntry>;

/**
 * Service for managing sharded FSRS card storage
 *
 * Architecture:
 * - 256 JSON files (00.json to ff.json) in .episteme/store/
 * - Cards assigned to shards by first 2 chars of UUID
 * - In-memory cache for O(1) lookups
 * - Dirty tracking for minimal I/O
 * - Debounced writes to reduce sync conflicts
 */
export class ShardedStoreService {
	private app: App;
	private cache: Map<string, ShardEntry> = new Map();
	private dirtyShards: Set<string> = new Set();
	private saveTimer: ReturnType<typeof setTimeout> | null = null;
	private isLoaded = false;
	private isSaving = false;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Get the shard ID (bucket) for a card ID
	 * Uses first 2 characters of UUID for 256 buckets
	 */
	private getShardId(cardId: string): string {
		return cardId.substring(0, 2).toLowerCase();
	}

	/**
	 * Get the file path for a shard
	 */
	private getShardPath(shardId: string): string {
		return normalizePath(`${STORE_FOLDER}/${shardId}.json`);
	}

	/**
	 * Load all shards into memory
	 * Called once at plugin startup
	 */
	async load(): Promise<void> {
		if (this.isLoaded) {
			return;
		}

		await this.ensureFolderExists();

		const adapter = this.app.vault.adapter;
		const folderPath = normalizePath(STORE_FOLDER);

		// List all files in store folder
		let files: string[] = [];
		try {
			const listing = await adapter.list(folderPath);
			files = listing.files.filter(f => f.endsWith(".json"));
		} catch {
			// Folder empty or doesn't exist yet
		}

		// Load all shards in parallel
		const loadPromises = files.map(async (filePath) => {
			try {
				const content = await adapter.read(filePath);
				const data = JSON.parse(content) as ShardData;

				for (const [id, entry] of Object.entries(data)) {
					this.cache.set(id, entry);
				}
			} catch {
				// Skip corrupted shard files
				console.warn(`Failed to load shard: ${filePath}`);
			}
		});

		await Promise.all(loadPromises);
		this.isLoaded = true;
	}

	/**
	 * Check if store is loaded
	 */
	isReady(): boolean {
		return this.isLoaded;
	}

	/**
	 * Get a card by ID
	 * O(1) lookup from memory cache
	 */
	get(cardId: string): ShardEntry | undefined {
		return this.cache.get(cardId);
	}

	/**
	 * Set/update a card
	 * Updates memory cache and marks shard as dirty
	 */
	set(cardId: string, data: ShardEntry): void {
		// Trim history if needed
		if (data.history && data.history.length > MAX_HISTORY_ENTRIES) {
			data.history = data.history.slice(-MAX_HISTORY_ENTRIES);
		}

		this.cache.set(cardId, data);
		this.dirtyShards.add(this.getShardId(cardId));
		this.scheduleSave();
	}

	/**
	 * Delete a card
	 */
	delete(cardId: string): void {
		if (this.cache.has(cardId)) {
			this.cache.delete(cardId);
			this.dirtyShards.add(this.getShardId(cardId));
			this.scheduleSave();
		}
	}

	/**
	 * Get all cards as array
	 * Used for building review queues and calculating stats
	 */
	getAll(): ShardEntry[] {
		return Array.from(this.cache.values());
	}

	/**
	 * Get total card count
	 */
	size(): number {
		return this.cache.size;
	}

	/**
	 * Check if a card exists
	 */
	has(cardId: string): boolean {
		return this.cache.has(cardId);
	}

	/**
	 * Get all card IDs
	 */
	keys(): string[] {
		return Array.from(this.cache.keys());
	}

	/**
	 * Import cards from migration (bulk operation)
	 * Doesn't trigger debounced save - caller must call flush()
	 */
	importBulk(cards: Map<string, ShardEntry>): void {
		for (const [id, data] of cards) {
			this.cache.set(id, data);
			this.dirtyShards.add(this.getShardId(id));
		}
	}

	/**
	 * Schedule a debounced save
	 */
	private scheduleSave(): void {
		if (this.saveTimer) {
			clearTimeout(this.saveTimer);
		}

		this.saveTimer = setTimeout(async () => {
			await this.flush();
		}, DEBOUNCE_MS);
	}

	/**
	 * Flush dirty shards to disk
	 * Only writes shards that have been modified
	 */
	async flush(): Promise<void> {
		if (this.dirtyShards.size === 0 || this.isSaving) {
			return;
		}

		this.isSaving = true;

		try {
			await this.ensureFolderExists();
			const adapter = this.app.vault.adapter;

			// Group cards by shard
			const shardData = new Map<string, ShardData>();

			for (const shardId of this.dirtyShards) {
				shardData.set(shardId, {});
			}

			// Populate shard data from cache
			for (const [id, entry] of this.cache) {
				const shardId = this.getShardId(id);
				if (this.dirtyShards.has(shardId)) {
					const shard = shardData.get(shardId);
					if (shard) {
						shard[id] = entry;
					}
				}
			}

			// Write dirty shards in parallel
			const writePromises = Array.from(shardData.entries()).map(
				async ([shardId, data]) => {
					const path = this.getShardPath(shardId);
					const content = JSON.stringify(data, null, 2);
					await adapter.write(path, content);
				}
			);

			await Promise.all(writePromises);
			this.dirtyShards.clear();
		} finally {
			this.isSaving = false;
		}
	}

	/**
	 * Force immediate save (call before plugin unload)
	 */
	async saveNow(): Promise<void> {
		if (this.saveTimer) {
			clearTimeout(this.saveTimer);
			this.saveTimer = null;
		}
		await this.flush();
	}

	/**
	 * Merge with data from disk (for sync conflict resolution)
	 * Uses "last-review-wins" strategy
	 */
	async mergeFromDisk(): Promise<{ merged: number; conflicts: number }> {
		const adapter = this.app.vault.adapter;
		const folderPath = normalizePath(STORE_FOLDER);
		let merged = 0;
		let conflicts = 0;

		let files: string[] = [];
		try {
			const listing = await adapter.list(folderPath);
			files = listing.files.filter(f => f.endsWith(".json"));
		} catch {
			return { merged, conflicts };
		}

		for (const filePath of files) {
			try {
				const content = await adapter.read(filePath);
				const diskData = JSON.parse(content) as ShardData;

				for (const [id, diskEntry] of Object.entries(diskData)) {
					const memEntry = this.cache.get(id);

					if (!memEntry) {
						// Card only on disk - add to cache
						this.cache.set(id, diskEntry);
						merged++;
					} else if (diskEntry.lastReview && memEntry.lastReview) {
						// Both have data - compare lastReview
						const diskTime = new Date(diskEntry.lastReview).getTime();
						const memTime = new Date(memEntry.lastReview).getTime();

						if (diskTime > memTime) {
							// Disk is newer - use disk version
							this.cache.set(id, diskEntry);
							conflicts++;
						}
						// Memory is newer - keep memory version (no action needed)
					} else if (diskEntry.lastReview && !memEntry.lastReview) {
						// Disk has review, memory doesn't - use disk
						this.cache.set(id, diskEntry);
						conflicts++;
					}
					// If memory has review and disk doesn't, keep memory
				}
			} catch {
				console.warn(`Failed to merge shard: ${filePath}`);
			}
		}

		return { merged, conflicts };
	}

	/**
	 * Clear all data (for testing)
	 */
	clear(): void {
		this.cache.clear();
		this.dirtyShards.clear();
		if (this.saveTimer) {
			clearTimeout(this.saveTimer);
			this.saveTimer = null;
		}
	}

	/**
	 * Ensure store folder exists
	 */
	private async ensureFolderExists(): Promise<void> {
		const folderPath = normalizePath(STORE_FOLDER);
		const exists = await this.app.vault.adapter.exists(folderPath);

		if (!exists) {
			// Create parent folder first if needed
			const parentPath = normalizePath(".episteme");
			const parentExists = await this.app.vault.adapter.exists(parentPath);
			if (!parentExists) {
				await this.app.vault.adapter.mkdir(parentPath);
			}
			await this.app.vault.adapter.mkdir(folderPath);
		}
	}

	/**
	 * Get statistics about the store
	 */
	getStats(): {
		totalCards: number;
		shardCount: number;
		dirtyShards: number;
		isLoaded: boolean;
	} {
		// Count unique shards
		const shards = new Set<string>();
		for (const id of this.cache.keys()) {
			shards.add(this.getShardId(id));
		}

		return {
			totalCards: this.cache.size,
			shardCount: shards.size,
			dirtyShards: this.dirtyShards.size,
			isLoaded: this.isLoaded,
		};
	}
}
