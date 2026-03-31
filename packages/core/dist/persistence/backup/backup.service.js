/**
 * Backup Service
 * Handles database backup creation, restoration, and management
 */
import { __awaiter } from "tslib";
import { DB_FOLDER, getDeviceDbFilename, toExactArrayBuffer, } from "@true-recall/core/persistence/sqlite";
import { notify } from "@true-recall/core/persistence/notification";
import pako from "pako";
const BACKUP_PREFIX = "true-recall-backup-";
/**
 * Service for managing database backups
 */
export class BackupService {
    constructor(persistence, sqliteStore) {
        this.persistence = persistence;
        this.sqliteStore = sqliteStore;
    }
    /**
     * Get the device-specific backup folder path
     */
    getBackupFolder() {
        const deviceId = this.sqliteStore.getDeviceId();
        return `${DB_FOLDER}/backups/${deviceId}`;
    }
    /**
     * Create a backup of the current database
     * @returns Path to the created backup file
     */
    createBackup() {
        return __awaiter(this, void 0, void 0, function* () {
            // Ensure pending changes are saved
            yield this.sqliteStore.saveNow();
            const db = this.sqliteStore.getDatabase();
            if (!db) {
                throw new Error("Database not available");
            }
            const data = db.export();
            const compressed = pako.gzip(data);
            // Ensure backup folder exists
            yield this.ensureBackupFolder();
            // Generate backup filename with timestamp
            const timestamp = this.formatTimestamp(new Date());
            const filename = `${BACKUP_PREFIX}${timestamp}.db.gz`;
            const backupPath = `${this.getBackupFolder()}/${filename}`;
            // Write compressed backup file
            yield this.persistence.writeBinary(backupPath, toExactArrayBuffer(compressed));
            // Verify: decompress and check SQLite header
            const written = yield this.persistence.readBinary(backupPath);
            if (!written) {
                throw new Error("Backup verification failed — could not read back written file");
            }
            const decompressed = pako.ungzip(new Uint8Array(written));
            const header = new TextDecoder().decode(decompressed.slice(0, 16));
            if (!header.startsWith("SQLite format 3")) {
                yield this.persistence.remove(backupPath);
                throw new Error("Backup verification failed — corrupt write detected");
            }
            return backupPath;
        });
    }
    /**
     * List all available backups
     * @returns Array of backup information, sorted by date (newest first)
     */
    listBackups() {
        return __awaiter(this, void 0, void 0, function* () {
            const backups = [];
            try {
                const folderExists = yield this.persistence.exists(this.getBackupFolder());
                if (!folderExists) {
                    return [];
                }
                const files = yield this.persistence.list(this.getBackupFolder());
                for (const filePath of files.files) {
                    const filename = filePath.split("/").pop() || "";
                    // Only include backup files (.db or .db.gz)
                    if (!filename.startsWith(BACKUP_PREFIX) ||
                        (!filename.endsWith(".db") && !filename.endsWith(".db.gz"))) {
                        continue;
                    }
                    // Extract timestamp from filename
                    const timestamp = this.parseFilenameTimestamp(filename);
                    if (!timestamp)
                        continue;
                    const stat = yield this.persistence.stat(filePath);
                    if (!stat)
                        continue;
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
            }
            catch (_a) {
                // Non-critical: listing backups failed
            }
            return backups;
        });
    }
    /**
     * Restore database from a backup file
     * Creates a safety backup before restoration
     * @param backupPath Path to the backup file to restore
     * @returns true if restoration successful
     */
    restoreFromBackup(backupPath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.createBackup();
                // Read backup file, decompress if gzipped
                const rawData = yield this.persistence.readBinary(backupPath);
                if (!rawData) {
                    throw new Error(`Backup file not found: ${backupPath}`);
                }
                const dbData = backupPath.endsWith(".gz")
                    ? toExactArrayBuffer(pako.ungzip(new Uint8Array(rawData)))
                    : toExactArrayBuffer(rawData);
                // Write to main database file
                const deviceId = this.sqliteStore.getDeviceId();
                const dbPath = `${DB_FOLDER}/${getDeviceDbFilename(deviceId)}`;
                yield this.persistence.writeBinary(dbPath, dbData);
                const backupName = backupPath.split("/").pop() || backupPath;
                notify().success(`Database restored from backup: ${backupName}. Please reload Obsidian to apply changes.`);
                return true;
            }
            catch (error) {
                console.error("[True Recall] Failed to restore backup:", error);
                notify().error("Failed to restore backup. Check console for details.");
                return false;
            }
        });
    }
    /**
     * Delete old backups keeping only the specified number
     * @param keepCount Number of backups to keep (0 = keep all)
     * @returns Number of backups deleted
     */
    pruneBackups(keepCount) {
        return __awaiter(this, void 0, void 0, function* () {
            if (keepCount <= 0)
                return 0;
            const backups = yield this.listBackups();
            if (backups.length <= keepCount)
                return 0;
            const toDelete = backups.slice(keepCount);
            let deleted = 0;
            for (const backup of toDelete) {
                try {
                    yield this.persistence.remove(backup.path);
                    deleted++;
                }
                catch (error) {
                    console.error(`[True Recall] Failed to delete backup ${backup.path}:`, error);
                }
            }
            return deleted;
        });
    }
    /**
     * Delete a specific backup
     * @param backupPath Path to the backup to delete
     * @returns true if deletion successful
     */
    deleteBackup(backupPath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.persistence.remove(backupPath);
                return true;
            }
            catch (error) {
                console.error(`[True Recall] Failed to delete backup ${backupPath}:`, error);
                return false;
            }
        });
    }
    /**
     * Apply smart multi-tier retention policy
     * Keeps: N hourly (one per hour), M daily (one per day), P weekly (one per week)
     * @param policy Retention policy configuration
     * @returns Result with deletion count and kept counts per tier
     */
    applySmartRetention(policy) {
        return __awaiter(this, void 0, void 0, function* () {
            const backups = yield this.listBackups();
            if (backups.length === 0) {
                return { deleted: 0, kept: { hourly: 0, daily: 0, weekly: 0 } };
            }
            const now = new Date();
            const toKeep = new Set();
            const kept = { hourly: 0, daily: 0, weekly: 0 };
            // Select backups to keep from each tier
            const hourlyBackups = this.selectHourlyBackups(backups, now, policy.hourlyBackupsToKeep);
            const dailyBackups = this.selectDailyBackups(backups, now, policy.dailyBackupsToKeep);
            const weeklyBackups = this.selectWeeklyBackups(backups, now, policy.weeklyBackupsToKeep);
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
                    yield this.persistence.remove(backup.path);
                    deleted++;
                }
                catch (error) {
                    console.error(`[True Recall] Failed to delete backup ${backup.path}:`, error);
                }
            }
            return { deleted, kept };
        });
    }
    /**
     * Select best hourly backups (newest within each hour in the retention window)
     */
    selectHourlyBackups(backups, now, count) {
        if (count <= 0)
            return [];
        const hourlyMap = new Map();
        const cutoff = new Date(now.getTime() - count * 60 * 60 * 1000);
        for (const backup of backups) {
            if (backup.timestamp < cutoff)
                continue;
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
    selectDailyBackups(backups, now, count) {
        if (count <= 0)
            return [];
        const dailyMap = new Map();
        const cutoff = new Date(now.getTime() - count * 24 * 60 * 60 * 1000);
        for (const backup of backups) {
            if (backup.timestamp < cutoff)
                continue;
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
    selectWeeklyBackups(backups, now, count) {
        if (count <= 0)
            return [];
        const weeklyMap = new Map();
        const cutoff = new Date(now.getTime() - count * 7 * 24 * 60 * 60 * 1000);
        for (const backup of backups) {
            if (backup.timestamp < cutoff)
                continue;
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
    getHourKey(date) {
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
    }
    /**
     * Get day bucket key for a date
     */
    getDayKey(date) {
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    }
    /**
     * Get week bucket key for a date (ISO week number)
     */
    getWeekKey(date) {
        const year = date.getFullYear();
        const weekNumber = this.getWeekNumber(date);
        return `${year}-W${weekNumber}`;
    }
    /**
     * Calculate ISO week number for a date
     */
    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    }
    /**
     * Ensure the backup folder exists
     */
    ensureBackupFolder() {
        return __awaiter(this, void 0, void 0, function* () {
            const folderPath = this.getBackupFolder();
            const exists = yield this.persistence.exists(folderPath);
            if (!exists) {
                yield this.persistence.mkdir(folderPath);
            }
        });
    }
    /**
     * Format a date to timestamp string for filename
     * Format: YYYY-MM-DD-HHmmss
     */
    formatTimestamp(date) {
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
    parseFilenameTimestamp(filename) {
        const match = filename.match(/true-recall-backup-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})\.db(?:\.gz)?$/);
        if (!match)
            return null;
        const [, year, month, day, hours, minutes, seconds] = match;
        if (!year || !month || !day || !hours || !minutes || !seconds)
            return null;
        return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hours, 10), parseInt(minutes, 10), parseInt(seconds, 10));
    }
    /**
     * Format a date for display
     */
    formatDateDisplay(date) {
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
    formatFileSize(bytes) {
        if (bytes < 1024)
            return `${bytes} B`;
        if (bytes < 1024 * 1024)
            return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
}
