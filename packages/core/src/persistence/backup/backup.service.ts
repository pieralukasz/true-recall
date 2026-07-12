/**
 * Backup Service
 * Handles database backup creation, restoration, and management
 */

import { MS_PER_DAY } from "@true-recall/core/constants";
import { DatabaseError } from "@true-recall/core/errors/domain.error";
import type { IPersistence } from "@true-recall/core/interfaces/persistence";
import { notify } from "@true-recall/core/persistence/notification";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite";
import {
	DB_FOLDER,
	getDeviceDbFilename,
	toExactArrayBuffer,
} from "@true-recall/core/persistence/sqlite";
import type { RetentionPolicy } from "@true-recall/core/types/settings.types";
import { formatFileSize } from "@true-recall/core/utils/format.utils";

import { gzipCompress, gzipDecompress } from "./gzip.utils";

const BACKUP_PREFIX = "true-recall-backup-";

/**
 * Backup file information
 */
export interface BackupInfo {
	/** Full path to the backup file */
	path: string;
	/** Filename only */
	filename: string;
	/** Backup creation timestamp */
	timestamp: Date;
	/** File size in bytes */
	sizeBytes: number;
	/** Formatted date string (YYYY-MM-DD HH:mm:ss) */
	formattedDate: string;
	/** Formatted size string (e.g., "1.5 MB") */
	formattedSize: string;
}

/**
 * Result of smart retention pruning
 */
export interface PruneResult {
	/** Number of backups deleted */
	deleted: number;
	/** Backups kept per tier */
	kept: {
		hourly: number;
		daily: number;
		weekly: number;
	};
}

/**
 * Service for managing database backups
 */
export class BackupService {
	private persistence: IPersistence;
	private sqliteStore: SqliteStoreService;

	constructor(persistence: IPersistence, sqliteStore: SqliteStoreService) {
		this.persistence = persistence;
		this.sqliteStore = sqliteStore;
	}

	/**
	 * Get the device-specific backup folder path
	 */
	private getBackupFolder(): string {
		const deviceId = this.sqliteStore.getDeviceId();
		return `${DB_FOLDER}/backups/${deviceId}`;
	}

	/**
	 * Create a backup of the current database
	 * @returns Path to the created backup file
	 */
	async createBackup(): Promise<string> {
		// Ensure pending changes are saved
		await this.sqliteStore.saveNow();

		const db = this.sqliteStore.getDatabase();
		if (!db) {
			throw new DatabaseError("Database not available", "backup:create");
		}

		const data = db.export();
		const compressed = await gzipCompress(data);

		// Ensure backup folder exists
		await this.ensureBackupFolder();

		// Generate backup filename with timestamp
		const timestamp = this.formatTimestamp(new Date());
		const filename = `${BACKUP_PREFIX}${timestamp}.db.gz`;
		const backupPath = `${this.getBackupFolder()}/${filename}`;

		// Write compressed backup file
		await this.persistence.writeBinary(
			backupPath,
			toExactArrayBuffer(compressed),
		);

		// Verify: decompress and check SQLite header
		const written = await this.persistence.readBinary(backupPath);
		if (!written) {
			throw new DatabaseError(
				"Backup verification failed — could not read back written file",
				"backup:verify",
			);
		}
		const decompressed = await gzipDecompress(new Uint8Array(written));
		const header = new TextDecoder().decode(decompressed.slice(0, 16));
		if (!header.startsWith("SQLite format 3")) {
			await this.persistence.remove(backupPath);
			throw new DatabaseError(
				"Backup verification failed — corrupt write detected",
				"backup:verify",
			);
		}

		return backupPath;
	}

	/**
	 * List all available backups
	 * @returns Array of backup information, sorted by date (newest first)
	 */
	async listBackups(): Promise<BackupInfo[]> {
		const backups: BackupInfo[] = [];

		try {
			const folderExists = await this.persistence.exists(
				this.getBackupFolder(),
			);
			if (!folderExists) {
				return [];
			}

			const files = await this.persistence.list(this.getBackupFolder());

			for (const filePath of files.files) {
				const filename = filePath.split("/").pop() || "";

				// Only include backup files (.db or .db.gz)
				if (
					!filename.startsWith(BACKUP_PREFIX) ||
					(!filename.endsWith(".db") && !filename.endsWith(".db.gz"))
				) {
					continue;
				}

				// Extract timestamp from filename
				const timestamp = this.parseFilenameTimestamp(filename);
				if (!timestamp) continue;

				const stat = await this.persistence.stat(filePath);
				if (!stat) continue;

				backups.push({
					path: filePath,
					filename,
					timestamp,
					sizeBytes: stat.size,
					formattedDate: this.formatDateDisplay(timestamp),
					formattedSize: formatFileSize(stat.size),
				});
			}

			// Sort by timestamp, newest first
			backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
		} catch {
			// Non-critical: listing backups failed
		}

		return backups;
	}

	/**
	 * Restore database from a backup file
	 * Creates a safety backup before restoration
	 * @param backupPath Path to the backup file to restore
	 * @returns true if restoration successful
	 */
	async restoreFromBackup(backupPath: string): Promise<boolean> {
		try {
			await this.createBackup();

			// Read backup file, decompress if gzipped
			const rawData = await this.persistence.readBinary(backupPath);
			if (!rawData) {
				throw new DatabaseError(
					`Backup file not found: ${backupPath}`,
					"backup:restore",
				);
			}
			const dbData = backupPath.endsWith(".gz")
				? toExactArrayBuffer(await gzipDecompress(new Uint8Array(rawData)))
				: toExactArrayBuffer(rawData);

			// Refuse to overwrite the live DB with bytes that are not a
			// SQLite database (truncated/corrupted backup) — the failure
			// would otherwise only surface on the next plugin load.
			const header = new TextDecoder().decode(dbData.slice(0, 15));
			if (!header.startsWith("SQLite format 3")) {
				throw new DatabaseError(
					"Backup file is not a valid SQLite database",
					"backup:restore",
				);
			}

			// From this point the in-memory store must never flush again —
			// its debounced save would export the pre-restore state over the
			// file we are about to write.
			this.sqliteStore.haltPersistence();

			// Write to main database file
			const deviceId = this.sqliteStore.getDeviceId();
			const dbPath = `${DB_FOLDER}/${getDeviceDbFilename(deviceId)}`;
			await this.persistence.writeBinary(dbPath, dbData);
			const backupName = backupPath.split("/").pop() || backupPath;

			notify().success(
				`Database restored from backup: ${backupName}. Please reload Obsidian to apply changes.`,
			);
			return true;
		} catch (error) {
			console.error("[True Recall] Failed to restore backup:", error);
			notify().error("Failed to restore backup. Check console for details.");
			return false;
		}
	}

	/**
	 * Delete old backups keeping only the specified number
	 * @param keepCount Number of backups to keep (0 = keep all)
	 * @returns Number of backups deleted
	 */
	async pruneBackups(keepCount: number): Promise<number> {
		if (keepCount <= 0) return 0;

		const backups = await this.listBackups();
		if (backups.length <= keepCount) return 0;

		const toDelete = backups.slice(keepCount);
		let deleted = 0;

		for (const backup of toDelete) {
			try {
				await this.persistence.remove(backup.path);
				deleted++;
			} catch (error) {
				console.error(
					`[True Recall] Failed to delete backup ${backup.path}:`,
					error,
				);
			}
		}

		return deleted;
	}

	/**
	 * Delete a specific backup
	 * @param backupPath Path to the backup to delete
	 * @returns true if deletion successful
	 */
	async deleteBackup(backupPath: string): Promise<boolean> {
		try {
			await this.persistence.remove(backupPath);
			return true;
		} catch (error) {
			console.error(
				`[True Recall] Failed to delete backup ${backupPath}:`,
				error,
			);
			return false;
		}
	}

	/**
	 * Apply smart multi-tier retention policy
	 * Keeps: N hourly (one per hour), M daily (one per day), P weekly (one per week)
	 * @param policy Retention policy configuration
	 * @returns Result with deletion count and kept counts per tier
	 */
	async applySmartRetention(policy: RetentionPolicy): Promise<PruneResult> {
		const backups = await this.listBackups();
		if (backups.length === 0) {
			return { deleted: 0, kept: { hourly: 0, daily: 0, weekly: 0 } };
		}

		const now = new Date();
		const toKeep = new Set<string>();
		const kept = { hourly: 0, daily: 0, weekly: 0 };

		// Select backups to keep from each tier
		const hourlyBackups = this.selectHourlyBackups(
			backups,
			now,
			policy.hourlyBackupsToKeep,
		);
		const dailyBackups = this.selectDailyBackups(
			backups,
			now,
			policy.dailyBackupsToKeep,
		);
		const weeklyBackups = this.selectWeeklyBackups(
			backups,
			now,
			policy.weeklyBackupsToKeep,
		);

		// Merge all kept backups (a backup can be kept by multiple tiers)
		for (const b of hourlyBackups) {
			if (!toKeep.has(b.path)) {
				toKeep.add(b.path);
				kept.hourly++;
			}
		}
		for (const b of dailyBackups) {
			if (!toKeep.has(b.path)) {
				toKeep.add(b.path);
				kept.daily++;
			}
		}
		for (const b of weeklyBackups) {
			if (!toKeep.has(b.path)) {
				toKeep.add(b.path);
				kept.weekly++;
			}
		}

		const toDelete = backups.filter((b) => !toKeep.has(b.path));
		let deleted = 0;

		for (const backup of toDelete) {
			try {
				await this.persistence.remove(backup.path);
				deleted++;
			} catch (error) {
				console.error(
					`[True Recall] Failed to delete backup ${backup.path}:`,
					error,
				);
			}
		}

		return { deleted, kept };
	}

	/**
	 * Select best hourly backups (newest within each hour in the retention window)
	 */
	private selectHourlyBackups(
		backups: BackupInfo[],
		now: Date,
		count: number,
	): BackupInfo[] {
		if (count <= 0) return [];

		const hourlyMap = new Map<string, BackupInfo>();
		const cutoff = new Date(now.getTime() - count * 60 * 60 * 1000);

		for (const backup of backups) {
			if (backup.timestamp < cutoff) continue;

			const hourKey = this.getHourKey(backup.timestamp);
			const existing = hourlyMap.get(hourKey);

			// Keep newest backup for each hour
			if (!existing || backup.timestamp > existing.timestamp) {
				hourlyMap.set(hourKey, backup);
			}
		}

		return Array.from(hourlyMap.values());
	}

	/**
	 * Select best daily backups (oldest/first per day within the retention window).
	 * Hourly tier already covers recent granularity; daily tier preserves
	 * start-of-day state for historical recovery.
	 */
	private selectDailyBackups(
		backups: BackupInfo[],
		now: Date,
		count: number,
	): BackupInfo[] {
		if (count <= 0) return [];

		const dailyMap = new Map<string, BackupInfo>();
		const cutoff = new Date(now.getTime() - count * MS_PER_DAY);

		for (const backup of backups) {
			if (backup.timestamp < cutoff) continue;

			const dayKey = this.getDayKey(backup.timestamp);
			const existing = dailyMap.get(dayKey);

			// Keep oldest (first) backup for each day
			if (!existing || backup.timestamp < existing.timestamp) {
				dailyMap.set(dayKey, backup);
			}
		}

		return Array.from(dailyMap.values());
	}

	/**
	 * Select best weekly backups (oldest/first per week within the retention window).
	 * Same rationale as daily — preserves start-of-week checkpoint.
	 */
	private selectWeeklyBackups(
		backups: BackupInfo[],
		now: Date,
		count: number,
	): BackupInfo[] {
		if (count <= 0) return [];

		const weeklyMap = new Map<string, BackupInfo>();
		const cutoff = new Date(now.getTime() - count * 7 * MS_PER_DAY);

		for (const backup of backups) {
			if (backup.timestamp < cutoff) continue;

			const weekKey = this.getWeekKey(backup.timestamp);
			const existing = weeklyMap.get(weekKey);

			// Keep oldest (first) backup for each week
			if (!existing || backup.timestamp < existing.timestamp) {
				weeklyMap.set(weekKey, backup);
			}
		}

		return Array.from(weeklyMap.values());
	}

	/**
	 * Get hour bucket key for a date
	 */
	private getHourKey(date: Date): string {
		return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
	}

	/**
	 * Get day bucket key for a date
	 */
	private getDayKey(date: Date): string {
		return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
	}

	/**
	 * Get week bucket key for a date (ISO week number)
	 */
	private getWeekKey(date: Date): string {
		const year = date.getFullYear();
		const weekNumber = this.getWeekNumber(date);
		return `${year}-W${weekNumber}`;
	}

	/**
	 * Calculate ISO week number for a date
	 */
	private getWeekNumber(date: Date): number {
		const d = new Date(
			Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
		);
		const dayNum = d.getUTCDay() || 7;
		d.setUTCDate(d.getUTCDate() + 4 - dayNum);
		const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
		return Math.ceil(
			((d.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7,
		);
	}

	/**
	 * Ensure the backup folder exists
	 */
	private async ensureBackupFolder(): Promise<void> {
		const folderPath = this.getBackupFolder();
		const exists = await this.persistence.exists(folderPath);
		if (!exists) {
			await this.persistence.mkdir(folderPath);
		}
	}

	/**
	 * Format a date to timestamp string for filename
	 * Format: YYYY-MM-DD-HHmmss
	 */
	private formatTimestamp(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		const hours = String(date.getHours()).padStart(2, "0");
		const minutes = String(date.getMinutes()).padStart(2, "0");
		const seconds = String(date.getSeconds()).padStart(2, "0");

		return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
	}

	/**
	 * Parse timestamp from backup filename
	 * Format: true-recall-backup-YYYY-MM-DD-HHmmss.db
	 */
	private parseFilenameTimestamp(filename: string): Date | null {
		const match = filename.match(
			/true-recall-backup-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})\.db(?:\.gz)?$/,
		);
		if (!match) return null;

		const [, year, month, day, hours, minutes, seconds] = match;
		if (!year || !month || !day || !hours || !minutes || !seconds) return null;

		return new Date(
			parseInt(year, 10),
			parseInt(month, 10) - 1,
			parseInt(day, 10),
			parseInt(hours, 10),
			parseInt(minutes, 10),
			parseInt(seconds, 10),
		);
	}

	/**
	 * Format a date for display
	 */
	private formatDateDisplay(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		const hours = String(date.getHours()).padStart(2, "0");
		const minutes = String(date.getMinutes()).padStart(2, "0");
		const seconds = String(date.getSeconds()).padStart(2, "0");

		return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
	}
}
