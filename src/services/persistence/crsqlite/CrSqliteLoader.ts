/**
 * CR-SQLite WASM Loader
 * Loads sql.js from local WASM files.
 *
 * NOTE: CR-SQLite integration is disabled for now because the @vlcn.io/crsqlite-wasm
 * package uses an async API that's incompatible with the current sync DatabaseLike interface.
 * TODO: Implement async DatabaseLike interface to enable CR-SQLite sync support.
 */
import type { App } from "obsidian";
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from "sql.js";

// Plugin ID for path resolution
const PLUGIN_ID = "episteme";

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
    isCrSqlite: boolean;
    siteId: string | null;
}

/**
 * Wrapper that makes sql.js Database compatible with DatabaseLike interface
 * (mostly passthrough since sql.js already matches the interface)
 */
class SqlJsWrapper implements DatabaseLike {
    private sqlDb: SqlJsDatabase;

    constructor(sqlDb: SqlJsDatabase) {
        this.sqlDb = sqlDb;
    }

    exec(sql: string, params?: BindParams): QueryExecResult[] {
        return this.sqlDb.exec(sql, params) as QueryExecResult[];
    }

    run(sql: string, params?: BindParams): void {
        this.sqlDb.run(sql, params);
    }

    export(): Uint8Array {
        return this.sqlDb.export();
    }

    close(): void {
        this.sqlDb.close();
    }

    getRowsModified(): number {
        return this.sqlDb.getRowsModified();
    }
}

/**
 * Get the path to a WASM file in the plugin directory
 * Returns relative path - vault.adapter.readBinary() adds basePath automatically
 */
function getPluginWasmPath(filename: string): string {
    return `.obsidian/plugins/${PLUGIN_ID}/${filename}`;
}

/**
 * Load WASM file from plugin directory and create a Blob URL
 * This is necessary because WASM loaders expect a URL, not a buffer
 */
async function loadWasmAsUrl(app: App, filename: string): Promise<string | null> {
    try {
        const wasmPath = getPluginWasmPath(filename);
        // Read the WASM file as binary using Obsidian's adapter
        const buffer = await app.vault.adapter.readBinary(wasmPath);
        // Create a Blob URL that the WASM loader can fetch
        const blob = new Blob([buffer], { type: "application/wasm" });
        return URL.createObjectURL(blob);
    } catch (e) {
        console.warn(`[Episteme] Failed to load local WASM file ${filename}:`, e);
        return null;
    }
}

// CDN fallback URL for sql.js WASM
const SQLJS_CDN = "https://sql.js.org/dist";

/**
 * Load sql.js - tries local WASM first, falls back to CDN
 */
async function loadSqlJs(app: App): Promise<SqlJsStatic> {
    // Try local WASM first
    const localWasmUrl = await loadWasmAsUrl(app, "sql-wasm.wasm");

    if (localWasmUrl) {
        console.log("[Episteme] Loading sql.js from local WASM...");
        try {
            const SQL = await initSqlJs({
                locateFile: () => localWasmUrl,
            });
            console.log("[Episteme] sql.js loaded successfully from local WASM");
            return SQL;
        } catch (e) {
            console.warn("[Episteme] Failed to load sql.js from local WASM, falling back to CDN:", e);
        }
    }

    // Fallback to CDN
    console.log("[Episteme] Loading sql.js from CDN fallback...");
    const SQL = await initSqlJs({
        locateFile: (file: string) => `${SQLJS_CDN}/${file}`,
    });
    console.log("[Episteme] sql.js loaded successfully from CDN");
    return SQL;
}

// Cached instance
let cachedSqlJs: SqlJsStatic | null = null;
let loadAttempted = false;

/**
 * Load the database with sql.js
 *
 * NOTE: CR-SQLite is disabled because it requires an async API.
 * The current architecture uses sync DatabaseLike interface.
 *
 * @param app - Obsidian App instance for file access
 * @param existingData - Existing database data to load (from file)
 * @returns Database wrapper and metadata
 */
export async function loadDatabase(
    app: App,
    existingData?: Uint8Array | null
): Promise<DatabaseLoadResult> {
    // Load sql.js
    if (!cachedSqlJs) {
        cachedSqlJs = await loadSqlJs(app);
        loadAttempted = true;
    }

    const sqlDb = existingData
        ? new cachedSqlJs.Database(existingData)
        : new cachedSqlJs.Database();

    return {
        db: new SqlJsWrapper(sqlDb),
        isCrSqlite: false,
        siteId: null,
    };
}

/**
 * Check if CR-SQLite is available
 * Currently always returns false - CR-SQLite disabled pending async API migration
 */
export function isCrSqliteAvailable(): boolean {
    return false;
}

/**
 * Force fallback to sql.js (no-op since CR-SQLite is disabled)
 */
export function disableCrSqlite(): void {
    console.log("[Episteme] CR-SQLite already disabled (async API not yet supported)");
}

/**
 * Reset loader state (for testing)
 */
export function resetLoaderState(): void {
    cachedSqlJs = null;
    loadAttempted = false;
}
