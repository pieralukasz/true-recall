/**
 * Device Discovery Service
 * Discovers and provides metadata about device-specific databases in the vault.
 */
import type { IPersistence } from "@true-recall/core/interfaces/persistence";
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
export declare class DeviceDiscoveryService {
    private persistence;
    private currentDeviceId;
    constructor(persistence: IPersistence, currentDeviceId: string);
    /**
     * Discover all device-specific databases in the .true-recall folder.
     * @returns Array of database info, sorted by last modified (newest first)
     */
    discoverDeviceDatabases(): Promise<DeviceDatabaseInfo[]>;
    /**
     * Get metadata for a specific database file.
     * @param path - Full path to the database file
     * @returns Database info or null if file is invalid
     */
    getDatabaseMetadata(path: string): Promise<DeviceDatabaseInfo | null>;
    /**
     * Check if a legacy (non-device-specific) database exists.
     * @returns True if true-recall.db exists
     */
    hasLegacyDatabase(): Promise<boolean>;
    /**
     * Get path to the legacy database.
     */
    getLegacyDatabasePath(): string;
    /**
     * Read basic info from a database file.
     */
    private readDatabaseInfo;
    /**
     * Format file size to human-readable string.
     */
    private formatFileSize;
}
