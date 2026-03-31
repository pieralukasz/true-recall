/**
 * Device Discovery Service
 * Discovers and provides metadata about device-specific databases in the vault.
 */
import { __awaiter } from "tslib";
import { loadDatabase } from "@true-recall/core/persistence/sqlite/loader";
import { DB_FOLDER, extractDeviceIdFromFilename, LEGACY_DB_FILE, } from "@true-recall/core/persistence/sqlite/sqlite.types";
/**
 * Service for discovering and analyzing device databases in the vault.
 */
export class DeviceDiscoveryService {
    constructor(persistence, currentDeviceId) {
        this.persistence = persistence;
        this.currentDeviceId = currentDeviceId;
    }
    /**
     * Discover all device-specific databases in the .true-recall folder.
     * @returns Array of database info, sorted by last modified (newest first)
     */
    discoverDeviceDatabases() {
        return __awaiter(this, void 0, void 0, function* () {
            const databases = [];
            const folderPath = DB_FOLDER;
            const folderExists = yield this.persistence.exists(folderPath);
            if (!folderExists) {
                return databases;
            }
            // List files in the .true-recall folder
            const items = yield this.persistence.list(folderPath);
            for (const filePath of items.files) {
                const filename = filePath.split("/").pop() || "";
                const deviceId = extractDeviceIdFromFilename(filename);
                if (deviceId) {
                    const metadata = yield this.getDatabaseMetadata(filePath);
                    if (metadata) {
                        databases.push(metadata);
                    }
                }
            }
            // Sort by last modified (newest first)
            databases.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
            return databases;
        });
    }
    /**
     * Get metadata for a specific database file.
     * @param path - Full path to the database file
     * @returns Database info or null if file is invalid
     */
    getDatabaseMetadata(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const filename = path.split("/").pop() || "";
            const deviceId = extractDeviceIdFromFilename(filename);
            if (!deviceId) {
                return null;
            }
            try {
                const stat = yield this.persistence.stat(path);
                if (!stat) {
                    return null;
                }
                // Read database to get card count and last review date
                let cardCount = null;
                let lastReviewDate = null;
                try {
                    const data = yield this.persistence.readBinary(path);
                    if (data) {
                        const dbInfo = yield this.readDatabaseInfo(new Uint8Array(data));
                        cardCount = dbInfo.cardCount;
                        lastReviewDate = dbInfo.lastReviewDate;
                    }
                }
                catch (e) {
                    console.error(`[True Recall] Could not read database info from ${filename}:`, e);
                }
                return {
                    deviceId,
                    path,
                    filename,
                    lastModified: new Date(stat.mtime),
                    sizeBytes: stat.size,
                    formattedSize: this.formatFileSize(stat.size),
                    cardCount,
                    lastReviewDate,
                    isCurrentDevice: deviceId === this.currentDeviceId,
                };
            }
            catch (e) {
                console.error(`[True Recall] Error getting metadata for ${path}:`, e);
                return null;
            }
        });
    }
    /**
     * Check if a legacy (non-device-specific) database exists.
     * @returns True if true-recall.db exists
     */
    hasLegacyDatabase() {
        return __awaiter(this, void 0, void 0, function* () {
            const legacyPath = `${DB_FOLDER}/${LEGACY_DB_FILE}`;
            return yield this.persistence.exists(legacyPath);
        });
    }
    /**
     * Get path to the legacy database.
     */
    getLegacyDatabasePath() {
        return `${DB_FOLDER}/${LEGACY_DB_FILE}`;
    }
    /**
     * Read basic info from a database file.
     */
    readDatabaseInfo(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const { db } = yield loadDatabase(data);
            try {
                let cardCount = null;
                let lastReviewDate = null;
                try {
                    const countResult = db.exec("SELECT COUNT(*) FROM cards");
                    cardCount = (_b = (_a = countResult[0]) === null || _a === void 0 ? void 0 : _a.values[0]) === null || _b === void 0 ? void 0 : _b[0];
                }
                catch (_e) {
                    // Table may not exist in old/empty databases
                }
                try {
                    const lastReviewResult = db.exec("SELECT MAX(reviewed_at) FROM review_log");
                    const lastReviewValue = (_d = (_c = lastReviewResult[0]) === null || _c === void 0 ? void 0 : _c.values[0]) === null || _d === void 0 ? void 0 : _d[0];
                    lastReviewDate = lastReviewValue ? new Date(lastReviewValue) : null;
                }
                catch (_f) {
                    // Table may not exist in old/empty databases
                }
                return { cardCount, lastReviewDate };
            }
            finally {
                db.close();
            }
        });
    }
    /**
     * Format file size to human-readable string.
     */
    formatFileSize(bytes) {
        if (bytes < 1024) {
            return `${bytes} B`;
        }
        else if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }
        else {
            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        }
    }
}
