/**
 * Device Discovery Service
 * Discovers and provides metadata about device-specific databases in the vault.
 */
import { App, normalizePath } from "obsidian";
import initSqlJs, { type Database } from "sql.js";
import {
    DB_FOLDER,
    LEGACY_DB_FILE,
    extractDeviceIdFromFilename,
} from "../persistence/sqlite/sqlite.types";

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
    private app: App;
    private currentDeviceId: string;

    constructor(app: App, currentDeviceId: string) {
        this.app = app;
        this.currentDeviceId = currentDeviceId;
    }

    /**
     * Discover all device-specific databases in the .true-recall folder.
     * @returns Array of database info, sorted by last modified (newest first)
     */
    async discoverDeviceDatabases(): Promise<DeviceDatabaseInfo[]> {
        const databases: DeviceDatabaseInfo[] = [];
        const folderPath = normalizePath(DB_FOLDER);

        // Check if folder exists
        const folderExists = await this.app.vault.adapter.exists(folderPath);
        if (!folderExists) {
            return databases;
        }

        // List files in the .true-recall folder
        const items = await this.app.vault.adapter.list(folderPath);

        for (const filePath of items.files) {
            const filename = filePath.split("/").pop() || "";
            const deviceId = extractDeviceIdFromFilename(filename);

            if (deviceId) {
                const metadata = await this.getDatabaseMetadata(filePath);
                if (metadata) {
                    databases.push(metadata);
                }
            }
        }

        // Sort by last modified (newest first)
        databases.sort(
            (a, b) => b.lastModified.getTime() - a.lastModified.getTime()
        );

        return databases;
    }

    /**
     * Get metadata for a specific database file.
     * @param path - Full path to the database file
     * @returns Database info or null if file is invalid
     */
    async getDatabaseMetadata(path: string): Promise<DeviceDatabaseInfo | null> {
        const filename = path.split("/").pop() || "";
        const deviceId = extractDeviceIdFromFilename(filename);

        if (!deviceId) {
            return null;
        }

        try {
            // Get file stats
            const stat = await this.app.vault.adapter.stat(path);
            if (!stat) {
                return null;
            }

            // Read database to get card count and last review date
            let cardCount: number | null = null;
            let lastReviewDate: Date | null = null;

            try {
                const data = await this.app.vault.adapter.readBinary(path);
                const dbInfo = await this.readDatabaseInfo(new Uint8Array(data));
                cardCount = dbInfo.cardCount;
                lastReviewDate = dbInfo.lastReviewDate;
            } catch (e) {
                console.warn(
                    `[True Recall] Could not read database info from ${filename}:`,
                    e
                );
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
        const legacyPath = normalizePath(`${DB_FOLDER}/${LEGACY_DB_FILE}`);
        return await this.app.vault.adapter.exists(legacyPath);
    }

    /**
     * Get path to the legacy database.
     */
    getLegacyDatabasePath(): string {
        return normalizePath(`${DB_FOLDER}/${LEGACY_DB_FILE}`);
    }

    /**
     * Read basic info from a database file.
     */
    private async readDatabaseInfo(
        data: Uint8Array
    ): Promise<{ cardCount: number | null; lastReviewDate: Date | null }> {
        const SQL = await initSqlJs({
            locateFile: (file) =>
                `https://sql.js.org/dist/${file}`,
        });

        let db: Database | null = null;
        try {
            db = new SQL.Database(data);

            // Get card count
            const countResult = db.exec("SELECT COUNT(*) FROM cards");
            const cardCount =
                countResult[0]?.values[0]?.[0] as number | null;

            // Get last review date from review_log
            const lastReviewResult = db.exec(
                "SELECT MAX(timestamp) FROM review_log"
            );
            const lastReviewTimestamp = lastReviewResult[0]?.values[0]?.[0] as
                | number
                | null;
            const lastReviewDate = lastReviewTimestamp
                ? new Date(lastReviewTimestamp)
                : null;

            return { cardCount, lastReviewDate };
        } finally {
            if (db) {
                db.close();
            }
        }
    }

    /**
     * Format file size to human-readable string.
     */
    private formatFileSize(bytes: number): string {
        if (bytes < 1024) {
            return `${bytes} B`;
        } else if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        } else {
            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        }
    }
}
