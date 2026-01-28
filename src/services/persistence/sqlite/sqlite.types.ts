/**
 * SQLite Types and Helpers
 * Shared types and utilities for SQLite operations
 */
import type { QueryExecResult } from "./loader";

// Re-export database types from loader module
export type { DatabaseLike, QueryExecResult, BindParams } from "./loader";

export const DB_FOLDER = ".true-recall";
export const DB_FILE = "episteme.db"; // legacy single-device database
export const DB_FILE_PREFIX = "true-recall-";
export const DB_FILE_SUFFIX = ".db";
export const LEGACY_DB_FILE = "episteme.db";
export const SAVE_DEBOUNCE_MS = 60000; // 60 seconds - reduces UI jank on large databases

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
    result: QueryExecResult[]
): SafeQueryResult | null {
    const firstResult = result[0];
    if (!firstResult || !firstResult.values || firstResult.values.length === 0) {
        return null;
    }
    return {
        columns: firstResult.columns,
        values: firstResult.values as SqlRow[],
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
    cards: 'deleted_at IS NULL',
    cardsAlias: 'c.deleted_at IS NULL',
    reviewLog: 'deleted_at IS NULL',
    reviewLogAlias: 'rl.deleted_at IS NULL',
    projects: 'deleted_at IS NULL',
    projectsAlias: 'p.deleted_at IS NULL',
    noteProjects: 'deleted_at IS NULL',
    noteProjectsAlias: 'np.deleted_at IS NULL',
    sourceNotes: 'deleted_at IS NULL',
    sourceNotesAlias: 's.deleted_at IS NULL',
    cardImageRefs: 'deleted_at IS NULL',
} as const;
