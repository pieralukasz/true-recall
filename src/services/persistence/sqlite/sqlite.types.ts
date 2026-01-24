/**
 * SQLite Types and Helpers
 * Shared types and utilities for SQLite operations
 */
import type { QueryExecResult } from "./loader";

// Re-export database types from loader module
export type { DatabaseLike, QueryExecResult, BindParams } from "./loader";

export const DB_FOLDER = ".episteme";
export const DB_FILE = "episteme.db";
export const SAVE_DEBOUNCE_MS = 60000; // 60 seconds - reduces UI jank on large databases

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
