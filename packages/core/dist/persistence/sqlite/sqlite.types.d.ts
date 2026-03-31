/**
 * SQLite Types and Helpers
 * Shared types and utilities for SQLite operations
 */
import type { QueryExecResult } from "./loader";
export type { BindParams, DatabaseLike, QueryExecResult, } from "./loader";
export declare const DB_FOLDER = ".true-recall";
export declare const DB_FILE = "true-recall.db";
export declare const DB_FILE_PREFIX = "true-recall-";
export declare const DB_FILE_SUFFIX = ".db";
export declare const LEGACY_DB_FILE = "true-recall.db";
export declare const SAVE_DEBOUNCE_MS = 5000;
export declare const SAFETY_FLUSH_INTERVAL_MS = 15000;
/**
 * Get the database filename for a specific device.
 * @param deviceId - 8-character alphanumeric device identifier
 * @returns Filename like "true-recall-a1b2c3d4.db"
 */
export declare function getDeviceDbFilename(deviceId: string): string;
/**
 * Extract device ID from a device-specific database filename.
 * @param filename - Filename like "true-recall-a1b2c3d4.db"
 * @returns Device ID or null if not a valid device database filename
 */
export declare function extractDeviceIdFromFilename(filename: string): string | null;
/**
 * Convert Uint8Array to exact-size ArrayBuffer (respecting byteOffset/byteLength).
 */
export declare function toExactArrayBuffer(bytes: Uint8Array): ArrayBuffer;
export type SqlValue = string | number | null | Uint8Array;
export type SqlRow = SqlValue[];
export interface SafeQueryResult {
    columns: string[];
    values: SqlRow[];
}
/**
 * Safely extract query result from database exec
 */
export declare function getQueryResult(result: QueryExecResult[]): SafeQueryResult | null;
/**
 * Generate a UUID v4 string
 * Uses crypto.randomUUID() if available, otherwise falls back to manual generation
 */
export declare function generateUUID(): string;
/**
 * SQL fragment constants for soft delete filtering
 */
export declare const NOT_DELETED: {
    readonly cards: "deleted_at IS NULL";
    readonly cardsAlias: "c.deleted_at IS NULL";
    readonly reviewLog: "deleted_at IS NULL";
    readonly reviewLogAlias: "rl.deleted_at IS NULL";
    readonly projects: "deleted_at IS NULL";
    readonly projectsAlias: "p.deleted_at IS NULL";
    readonly noteProjects: "deleted_at IS NULL";
    readonly noteProjectsAlias: "np.deleted_at IS NULL";
    readonly sourceNotes: "deleted_at IS NULL";
    readonly sourceNotesAlias: "s.deleted_at IS NULL";
    readonly cardImageRefs: "deleted_at IS NULL";
};
