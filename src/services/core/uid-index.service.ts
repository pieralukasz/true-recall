/**
 * UidIndexService
 * Maintains a Map<uid, path> for O(1) lookups of files by flashcard_uid
 *
 * Automatically stays in sync with vault changes via Obsidian events:
 * - metadataCache 'changed': new file, edit UID (add/change/remove)
 * - vault 'delete': file deleted
 * - vault 'rename': file renamed or moved
 */
import type { App, TFile, CachedMetadata, EventRef, Plugin } from "obsidian";

export class UidIndexService {
	private app: App;
	private uidToPath: Map<string, string> = new Map();
	private pathToUid: Map<string, string> = new Map(); // Reverse index for efficient updates

	constructor(app: App) {
		this.app = app;
		// Note: Don't call buildIndex() here - metadataCache may not be ready yet
		// Call rebuildIndex() after workspace.onLayoutReady() in plugin
	}

	/**
	 * Rebuild index from all vault files
	 * Call this after metadataCache is fully loaded (e.g., in onLayoutReady callback)
	 */
	rebuildIndex(): void {
		this.buildIndex();
	}

	/**
	 * Register event handlers with the plugin for proper cleanup on unload
	 * Must be called after construction to enable automatic index updates
	 *
	 * @param plugin - The plugin instance for event registration
	 */
	registerEvents(plugin: Plugin): void {
		plugin.registerEvent(
			this.app.metadataCache.on("changed", this.handleMetadataChanged.bind(this))
		);
		plugin.registerEvent(
			this.app.vault.on("delete", this.handleFileDeleted.bind(this))
		);
		plugin.registerEvent(
			this.app.vault.on("rename", this.handleFileRenamed.bind(this))
		);
	}

	/**
	 * Register event handlers directly (for testing or standalone use)
	 * Note: These handlers won't be cleaned up automatically on plugin unload
	 */
	registerEventsDirect(): void {
		this.app.metadataCache.on("changed", this.handleMetadataChanged.bind(this));
		this.app.vault.on("delete", this.handleFileDeleted.bind(this));
		this.app.vault.on("rename", this.handleFileRenamed.bind(this));
	}

	/**
	 * Get file by flashcard_uid
	 * @param uid - The flashcard_uid to look up
	 * @returns TFile if found, null otherwise
	 */
	getFileByUid(uid: string): TFile | null {
		const path = this.uidToPath.get(uid);
		if (!path) {
			return null;
		}

		const file = this.app.vault.getAbstractFileByPath(path);
		if (file && "extension" in file) {
			return file as TFile;
		}

		return null;
	}

	/**
	 * Get the number of indexed files (for debugging)
	 */
	get size(): number {
		return this.uidToPath.size;
	}

	/**
	 * Build index from all markdown files in vault
	 */
	private buildIndex(): void {
		this.uidToPath.clear();
		this.pathToUid.clear();

		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			const uid = cache?.frontmatter?.flashcard_uid;

			if (uid) {
				this.uidToPath.set(uid, file.path);
				this.pathToUid.set(file.path, uid);
			}
		}

		console.log(`[Episteme] UID index built: ${this.uidToPath.size} entries`);
	}

	/**
	 * Handle metadata changed event
	 * Covers: new file with UID, UID added, UID changed, UID removed
	 */
	private handleMetadataChanged(file: TFile, _data: string, cache: CachedMetadata): void {
		const newUid = cache?.frontmatter?.flashcard_uid;
		const oldUid = this.pathToUid.get(file.path);

		// No change
		if (newUid === oldUid) {
			return;
		}

		// Remove old UID if it existed
		if (oldUid) {
			this.uidToPath.delete(oldUid);
			this.pathToUid.delete(file.path);
		}

		// Add new UID if present
		if (newUid) {
			this.uidToPath.set(newUid, file.path);
			this.pathToUid.set(file.path, newUid);
		}
	}

	/**
	 * Handle file deleted event
	 */
	private handleFileDeleted(file: TFile): void {
		const uid = this.pathToUid.get(file.path);

		if (uid) {
			this.uidToPath.delete(uid);
			this.pathToUid.delete(file.path);
		}
	}

	/**
	 * Handle file renamed/moved event
	 */
	private handleFileRenamed(file: TFile, oldPath: string): void {
		const uid = this.pathToUid.get(oldPath);

		if (uid) {
			// Update both maps with new path
			this.uidToPath.set(uid, file.path);
			this.pathToUid.delete(oldPath);
			this.pathToUid.set(file.path, uid);
		}
	}
}
