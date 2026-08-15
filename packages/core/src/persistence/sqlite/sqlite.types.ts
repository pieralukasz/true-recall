/**
 * SQLite Types and Helpers
 * Shared types and utilities for SQLite operations
 */
import type { QueryExecResult } from "./loader";

// Re-export database types from loader module
export type {
	BindParams,
	DatabaseLike,
	QueryExecResult,
} from "./loader";

export const DB_FOLDER = ".true-recall";
// iCloud skips any path containing a ".nosync" component, so backup archives
// stay local instead of competing with database sync for transfer bandwidth.
// The legacy plain "backups" folder is still read so old archives restore.
export const BACKUPS_FOLDER = "backups.nosync";
export const LEGACY_BACKUPS_FOLDER = "backups";

export function getBackupFolderPath(deviceId: string): string {
	return `${DB_FOLDER}/${BACKUPS_FOLDER}/${deviceId}`;
}

export function getLegacyBackupFolderPath(deviceId: string): string {
	return `${DB_FOLDER}/${LEGACY_BACKUPS_FOLDER}/${deviceId}`;
}
export const DB_FILE = "true-recall.db"; // legacy single-device database
export const DB_FILE_PREFIX = "true-recall-";
export const DB_FILE_SUFFIX = ".db";
export const LEGACY_DB_FILE = "true-recall.db";
export const SAVE_DEBOUNCE_MS = 5000; // 5 seconds - better durability on app shutdown
export const SAFETY_FLUSH_INTERVAL_MS = 15000; // hard safety flush every 15 seconds

// VACUUM on load only when both thresholds are exceeded — small databases
// and modest churn aren't worth the full-DB rewrite.
export const VACUUM_MIN_FREE_BYTES = 5 * 1024 * 1024;
export const VACUUM_MIN_FREE_RATIO = 0.25;

/**
 * Get the database filename for a specific device.
 * @param deviceId - 8-character alphanumeric device identifier
 * @returns Filename like "true-recall-a1b2c3d4.db"
 */
export function getDeviceDbFilename(deviceId: string): string {
	return `${DB_FILE_PREFIX}${deviceId}${DB_FILE_SUFFIX}`;
}

/**
 * Extract device ID from a device-specific database filename.
 * @param filename - Filename like "true-recall-a1b2c3d4.db"
 * @returns Device ID or null if not a valid device database filename
 */
export function extractDeviceIdFromFilename(filename: string): string | null {
	const match = filename.match(/^true-recall-([a-z0-9]{8})\.db$/);
	return match?.[1] ?? null;
}

/**
 * Convert Uint8Array to exact-size ArrayBuffer (respecting byteOffset/byteLength).
 */
export function toExactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	if (
		bytes.byteOffset === 0 &&
		bytes.byteLength === bytes.buffer.byteLength &&
		bytes.buffer instanceof ArrayBuffer
	) {
		return bytes.buffer;
	}
	const copy = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(copy).set(bytes);
	return copy;
}

// Type for SQL row values from sql.js
export type SqlValue = string | number | null | Uint8Array;
export type SqlRow = SqlValue[];

// Helper to safely extract query result data
export interface SafeQueryResult {
	columns: string[];
	values: SqlRow[];
}

/**
 * Safely extract query result from database exec
 */
export function getQueryResult(
	result: QueryExecResult[],
): SafeQueryResult | null {
	const firstResult = result[0];
	if (!firstResult || !firstResult.values || firstResult.values.length === 0) {
		return null;
	}
	return {
		columns: firstResult.columns,
		values: firstResult.values,
	};
}

/**
 * Generate a UUID v4 string
 * Uses crypto.randomUUID() if available, otherwise falls back to manual generation
 */
export function generateUUID(): string {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	// Fallback for environments without crypto.randomUUID
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

/**
 * SQL fragment constants for soft delete filtering
 */
export const NOT_DELETED = {
	cards: "deleted_at IS NULL",
	cardsAlias: "c.deleted_at IS NULL",
	reviewLog: "deleted_at IS NULL",
	reviewLogAlias: "rl.deleted_at IS NULL",
	projects: "deleted_at IS NULL",
	projectsAlias: "p.deleted_at IS NULL",
	noteProjects: "deleted_at IS NULL",
	noteProjectsAlias: "np.deleted_at IS NULL",
	sourceNotes: "deleted_at IS NULL",
	sourceNotesAlias: "s.deleted_at IS NULL",
	cardImageRefs: "deleted_at IS NULL",
} as const;
