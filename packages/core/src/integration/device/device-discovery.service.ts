/**
 * Device Discovery Service
 * Discovers and provides metadata about device-specific databases in the vault.
 */

import type { IPersistence } from "@true-recall/core/interfaces/persistence";
import { loadDatabase } from "@true-recall/core/persistence/sqlite/loader";
import {
	DB_FOLDER,
	extractDeviceIdFromFilename,
	LEGACY_DB_FILE,
} from "@true-recall/core/persistence/sqlite/sqlite.types";
import { formatFileSize } from "@true-recall/core/utils/format.utils";

/**
 * Card counts and review dates require deserializing the whole file into
 * SQLite, so they are skipped above this size. A multi-hundred-megabyte heap
 * spike is not worth a subtitle in a picker, and on mobile it is fatal.
 */
export const MAX_STATS_DB_BYTES = 24 * 1024 * 1024;

export interface DiscoveryOptions {
	/**
	 * Read each candidate file to report card count and last review date.
	 * Off by default: metadata callers (startup, sync) only need paths, and
	 * reading every device database is proportional to total database size.
	 */
	withStats?: boolean;
}

/**
 * Information about a discovered device database.
 */
export interface DeviceDatabaseInfo {
	/** 8-character device identifier */
	deviceId: string;
	/** Full path to the database file */
	path: string;
	/** Filename (e.g., "true-recall-a1b2c3d4.db") */
	filename: string;
	/** Last modification timestamp */
	lastModified: Date;
	/** File size in bytes */
	sizeBytes: number;
	/** Human-readable file size (e.g., "2.5 MB") */
	formattedSize: string;
	/** Number of flashcards in the database (null if couldn't read) */
	cardCount: number | null;
	/** Date of last review (null if no reviews or couldn't read) */
	lastReviewDate: Date | null;
	/** Whether this is the current device's database */
	isCurrentDevice: boolean;
}

/**
 * Service for discovering and analyzing device databases in the vault.
 */
export class DeviceDiscoveryService {
	constructor(
		private persistence: IPersistence,
		private currentDeviceId: string,
	) {}

	/**
	 * Discover all device-specific databases in the .true-recall folder.
	 * @returns Array of database info, sorted by last modified (newest first)
	 */
	async discoverDeviceDatabases(
		options: DiscoveryOptions = {},
	): Promise<DeviceDatabaseInfo[]> {
		const databases: DeviceDatabaseInfo[] = [];
		const folderPath = DB_FOLDER;

		const folderExists = await this.persistence.exists(folderPath);
		if (!folderExists) {
			return databases;
		}

		// List files in the .true-recall folder
		const items = await this.persistence.list(folderPath);

		for (const filePath of items.files) {
			const filename = filePath.split("/").pop() || "";
			const deviceId = extractDeviceIdFromFilename(filename);

			if (deviceId) {
				const metadata = await this.getDatabaseMetadata(filePath, options);
				if (metadata) {
					databases.push(metadata);
				}
			}
		}

		// Sort by last modified (newest first)
		databases.sort(
			(a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
		);

		return databases;
	}

	/**
	 * Get metadata for a specific database file.
	 * @param path - Full path to the database file
	 * @returns Database info or null if file is invalid
	 */
	async getDatabaseMetadata(
		path: string,
		options: DiscoveryOptions = {},
	): Promise<DeviceDatabaseInfo | null> {
		const filename = path.split("/").pop() || "";
		const deviceId = extractDeviceIdFromFilename(filename);

		if (!deviceId) {
			return null;
		}

		try {
			const stat = await this.persistence.stat(path);
			if (!stat) {
				return null;
			}

			// Card count and last review date need the whole file in memory, so
			// they are opt-in and capped: callers that only need paths (startup,
			// device sync) must not pay for reading every device database.
			let cardCount: number | null = null;
			let lastReviewDate: Date | null = null;

			if (options.withStats && stat.size <= MAX_STATS_DB_BYTES) {
				try {
					const data = await this.persistence.readBinary(path);
					if (data) {
						const dbInfo = await this.readDatabaseInfo(new Uint8Array(data));
						cardCount = dbInfo.cardCount;
						lastReviewDate = dbInfo.lastReviewDate;
					}
				} catch (e) {
					console.error(
						`[True Recall] Could not read database info from ${filename}:`,
						e,
					);
				}
			}

			return {
				deviceId,
				path,
				filename,
				lastModified: new Date(stat.mtime),
				sizeBytes: stat.size,
				formattedSize: formatFileSize(stat.size),
				cardCount,
				lastReviewDate,
				isCurrentDevice: deviceId === this.currentDeviceId,
			};
		} catch (e) {
			console.error(`[True Recall] Error getting metadata for ${path}:`, e);
			return null;
		}
	}

	/**
	 * Check if a legacy (non-device-specific) database exists.
	 * @returns True if true-recall.db exists
	 */
	async hasLegacyDatabase(): Promise<boolean> {
		const legacyPath = `${DB_FOLDER}/${LEGACY_DB_FILE}`;
		return await this.persistence.exists(legacyPath);
	}

	/**
	 * Get path to the legacy database.
	 */
	getLegacyDatabasePath(): string {
		return `${DB_FOLDER}/${LEGACY_DB_FILE}`;
	}

	/**
	 * Read basic info from a database file.
	 */
	private async readDatabaseInfo(
		data: Uint8Array,
	): Promise<{ cardCount: number | null; lastReviewDate: Date | null }> {
		const { db } = await loadDatabase(data);
		try {
			let cardCount: number | null = null;
			let lastReviewDate: Date | null = null;

			try {
				const countResult = db.exec("SELECT COUNT(*) FROM cards");
				cardCount = countResult[0]?.values[0]?.[0] as number | null;
			} catch {
				// Table may not exist in old/empty databases
			}

			try {
				const lastReviewResult = db.exec(
					"SELECT MAX(reviewed_at) FROM review_log",
				);
				const lastReviewValue = lastReviewResult[0]?.values[0]?.[0] as
					| string
					| null;
				lastReviewDate = lastReviewValue ? new Date(lastReviewValue) : null;
			} catch {
				// Table may not exist in old/empty databases
			}

			return { cardCount, lastReviewDate };
		} finally {
			db.close();
		}
	}
}
