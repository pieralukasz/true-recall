/**
 * SQLite WASM Loader
 * Uses @sqlite.org/sqlite-wasm which includes FTS5, JSON1, RTREE, and all
 * other SQLite extensions — no custom WASM compilation needed.
 */
/**
 * Common query result interface matching sql.js format
 * All repositories use this format
 */
export interface QueryExecResult {
    columns: string[];
    values: (string | number | null | Uint8Array)[][];
}
/** Bind parameter type */
export type BindParams = (string | number | null | Uint8Array)[];
/**
 * Database interface compatible with sql.js API
 * Used by all repositories
 */
export interface DatabaseLike {
    exec(sql: string, params?: BindParams): QueryExecResult[];
    run(sql: string, params?: BindParams): void;
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
}
/**
 * Result from loadDatabase()
 */
export interface DatabaseLoadResult {
    db: DatabaseLike;
}
/**
 * Load the database with @sqlite.org/sqlite-wasm
 *
 * @param existingData - Existing database data to load (from file)
 * @returns Database wrapper
 */
export declare function loadDatabase(existingData?: Uint8Array | null): Promise<DatabaseLoadResult>;
/**
 * Reset loader state (for testing)
 */
export declare function resetLoaderState(): void;
