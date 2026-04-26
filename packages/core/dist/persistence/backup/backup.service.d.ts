/**
 * Backup Service
 * Handles database backup creation, restoration, and management
 */
import type { IPersistence } from "@true-recall/core/interfaces/persistence";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite";
import type { RetentionPolicy } from "@true-recall/core/types/settings.types";
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
export declare class BackupService {
    private persistence;
    private sqliteStore;
    constructor(persistence: IPersistence, sqliteStore: SqliteStoreService);
    /**
     * Get the device-specific backup folder path
     */
    private getBackupFolder;
    /**
     * Create a backup of the current database
     * @returns Path to the created backup file
     */
    createBackup(): Promise<string>;
    /**
     * List all available backups
     * @returns Array of backup information, sorted by date (newest first)
     */
    listBackups(): Promise<BackupInfo[]>;
    /**
     * Restore database from a backup file
     * Creates a safety backup before restoration
     * @param backupPath Path to the backup file to restore
     * @returns true if restoration successful
     */
    restoreFromBackup(backupPath: string): Promise<boolean>;
    /**
     * Delete old backups keeping only the specified number
     * @param keepCount Number of backups to keep (0 = keep all)
     * @returns Number of backups deleted
     */
    pruneBackups(keepCount: number): Promise<number>;
    /**
     * Delete a specific backup
     * @param backupPath Path to the backup to delete
     * @returns true if deletion successful
     */
    deleteBackup(backupPath: string): Promise<boolean>;
    /**
     * Apply smart multi-tier retention policy
     * Keeps: N hourly (one per hour), M daily (one per day), P weekly (one per week)
     * @param policy Retention policy configuration
     * @returns Result with deletion count and kept counts per tier
     */
    applySmartRetention(policy: RetentionPolicy): Promise<PruneResult>;
    /**
     * Select best hourly backups (newest within each hour in the retention window)
     */
    private selectHourlyBackups;
    /**
     * Select best daily backups (oldest/first per day within the retention window).
     * Hourly tier already covers recent granularity; daily tier preserves
     * start-of-day state for historical recovery.
     */
    private selectDailyBackups;
    /**
     * Select best weekly backups (oldest/first per week within the retention window).
     * Same rationale as daily — preserves start-of-week checkpoint.
     */
    private selectWeeklyBackups;
    /**
     * Get hour bucket key for a date
     */
    private getHourKey;
    /**
     * Get day bucket key for a date
     */
    private getDayKey;
    /**
     * Get week bucket key for a date (ISO week number)
     */
    private getWeekKey;
    /**
     * Calculate ISO week number for a date
     */
    private getWeekNumber;
    /**
     * Ensure the backup folder exists
     */
    private ensureBackupFolder;
    /**
     * Format a date to timestamp string for filename
     * Format: YYYY-MM-DD-HHmmss
     */
    private formatTimestamp;
    /**
     * Parse timestamp from backup filename
     * Format: true-recall-backup-YYYY-MM-DD-HHmmss.db
     */
    private parseFilenameTimestamp;
    /**
     * Format a date for display
     */
    private formatDateDisplay;
    /**
     * Format file size for display
     */
    private formatFileSize;
}
