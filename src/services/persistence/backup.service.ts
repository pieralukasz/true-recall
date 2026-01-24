/**
 * Backup Service
 * Handles database backup creation, restoration, and management
 */
import { App, normalizePath, Notice } from "obsidian";
import type { SqliteStoreService } from "./sqlite";
import { DB_FOLDER, getDeviceDbFilename } from "./sqlite";

const BACKUP_PREFIX = "episteme-backup-";

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
 * Service for managing database backups
 */
export class BackupService {
    private app: App;
    private sqliteStore: SqliteStoreService;

    constructor(app: App, sqliteStore: SqliteStoreService) {
        this.app = app;
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

        // Get database data
        const db = this.sqliteStore.getDatabase();
        if (!db) {
            throw new Error("Database not available");
        }

        const data = db.export();

        // Ensure backup folder exists
        await this.ensureBackupFolder();

        // Generate backup filename with timestamp
        const timestamp = this.formatTimestamp(new Date());
        const filename = `${BACKUP_PREFIX}${timestamp}.db`;
        const backupPath = normalizePath(`${this.getBackupFolder()}/${filename}`);

        // Write backup file
        await this.app.vault.adapter.writeBinary(backupPath, data.buffer);

        return backupPath;
    }

    /**
     * List all available backups
     * @returns Array of backup information, sorted by date (newest first)
     */
    async listBackups(): Promise<BackupInfo[]> {
        const backups: BackupInfo[] = [];

        try {
            const folderExists = await this.app.vault.adapter.exists(this.getBackupFolder());
            if (!folderExists) {
                return [];
            }

            const files = await this.app.vault.adapter.list(this.getBackupFolder());

            for (const filePath of files.files) {
                const filename = filePath.split("/").pop() || "";

                // Only include backup files
                if (!filename.startsWith(BACKUP_PREFIX) || !filename.endsWith(".db")) {
                    continue;
                }

                // Extract timestamp from filename
                const timestamp = this.parseFilenameTimestamp(filename);
                if (!timestamp) continue;

                // Get file stats
                const stat = await this.app.vault.adapter.stat(filePath);
                if (!stat) continue;

                backups.push({
                    path: filePath,
                    filename,
                    timestamp,
                    sizeBytes: stat.size,
                    formattedDate: this.formatDateDisplay(timestamp),
                    formattedSize: this.formatFileSize(stat.size),
                });
            }

            // Sort by timestamp, newest first
            backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        } catch (error) {
            console.warn("[Episteme] Failed to list backups:", error);
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
            // Create safety backup first
            const safetyBackupPath = await this.createBackup();
            console.log(`[Episteme] Safety backup created at: ${safetyBackupPath}`);

            // Read backup file
            const backupData = await this.app.vault.adapter.readBinary(backupPath);

            // Write to main database file
            const deviceId = this.sqliteStore.getDeviceId();
            const dbPath = normalizePath(`${DB_FOLDER}/${getDeviceDbFilename(deviceId)}`);
            await this.app.vault.adapter.writeBinary(dbPath, backupData);

            new Notice("Backup restored. Please reload Obsidian to apply changes.");
            return true;
        } catch (error) {
            console.error("[Episteme] Failed to restore backup:", error);
            new Notice("Failed to restore backup. Check console for details.");
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
                await this.app.vault.adapter.remove(backup.path);
                deleted++;
            } catch (error) {
                console.warn(`[Episteme] Failed to delete backup ${backup.path}:`, error);
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
            await this.app.vault.adapter.remove(backupPath);
            return true;
        } catch (error) {
            console.warn(`[Episteme] Failed to delete backup ${backupPath}:`, error);
            return false;
        }
    }

    /**
     * Ensure the backup folder exists
     */
    private async ensureBackupFolder(): Promise<void> {
        const folderPath = normalizePath(this.getBackupFolder());
        const exists = await this.app.vault.adapter.exists(folderPath);
        if (!exists) {
            await this.app.vault.adapter.mkdir(folderPath);
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
     * Format: episteme-backup-YYYY-MM-DD-HHmmss.db
     */
    private parseFilenameTimestamp(filename: string): Date | null {
        const match = filename.match(/episteme-backup-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})\.db$/);
        if (!match) return null;

        const [, year, month, day, hours, minutes, seconds] = match;
        if (!year || !month || !day || !hours || !minutes || !seconds) return null;

        return new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hours),
            parseInt(minutes),
            parseInt(seconds)
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

    /**
     * Format file size for display
     */
    private formatFileSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
}
