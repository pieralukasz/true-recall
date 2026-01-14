/**
 * SQLite Types and Helpers
 * Shared types and utilities for SQLite operations
 */
import type { Database } from "sql.js";

export const DB_FOLDER = ".episteme";
export const DB_FILE = "episteme.db";
export const SAVE_DEBOUNCE_MS = 1000;

// Type for SQL row values from sql.js
export type SqlValue = string | number | null | Uint8Array;
export type SqlRow = SqlValue[];

// Helper to safely extract query result data
export interface SafeQueryResult {
    columns: string[];
    values: SqlRow[];
}

/**
 * Safely extract query result from sql.js exec
 */
export function getQueryResult(
    result: ReturnType<Database["exec"]>
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
 * Get column value from row by name
 */
export function getColValue(columns: string[], values: SqlRow, name: string): SqlValue {
    const idx = columns.indexOf(name);
    return idx >= 0 ? (values[idx] ?? null) : null;
}
