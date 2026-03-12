/**
 * SQLite WASM Loader
 * Uses @sqlite.org/sqlite-wasm which includes FTS5, JSON1, RTREE, and all
 * other SQLite extensions — no custom WASM compilation needed.
 */

import type { Database, Sqlite3Static } from "@sqlite.org/sqlite-wasm";
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import embeddedWasm from "@sqlite.org/sqlite-wasm/sqlite3.wasm";
import type { App } from "obsidian";

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
 * Wraps @sqlite.org/sqlite-wasm OO1 Database to match the DatabaseLike interface
 */
class SqliteOrgWrapper implements DatabaseLike {
	constructor(
		private db: Database,
		private sqlite3: Sqlite3Static,
	) {}

	exec(sql: string, params?: BindParams): QueryExecResult[] {
		const columnNames: string[] = [];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const rows = (this.db.exec as any)({
			sql,
			bind: params,
			returnValue: "resultRows",
			rowMode: "array",
			columnNames,
		}) as (string | number | null | Uint8Array)[][];

		// No columns = DDL/DML or empty result — match sql.js returning []
		if (columnNames.length === 0) return [];
		return [{ columns: columnNames, values: rows }];
	}

	run(sql: string, params?: BindParams): void {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(this.db.exec as any)({ sql, bind: params });
	}

	export(): Uint8Array {
		return this.sqlite3.capi.sqlite3_js_db_export(this.db);
	}

	close(): void {
		this.db.close();
	}

	getRowsModified(): number {
		return this.db.changes();
	}
}

// Cached instance — initialising sqlite3 is expensive, reuse across DB loads
let cachedSqlite3: Sqlite3Static | null = null;

async function loadSqlite3(): Promise<Sqlite3Static> {
	const initOpts: Record<string, unknown> = {
		print: () => {},
		printErr: (msg: string) => {
			if (msg.startsWith("warning:")) return;
			console.error("[SQLite WASM]", msg);
		},
		// Prevent Emscripten from calling new URL("sqlite3.wasm", import.meta.url)
		// which fails because esbuild's CJS shim sets import.meta to {}
		locateFile: (file: string) => file,
		// WASM binary is embedded in the bundle by esbuild's binary loader
		wasmBinary: new Uint8Array(embeddedWasm as ArrayBuffer),
	};

	// The TS types declare init() with no args, but the Emscripten runtime
	// reads opts.wasmBinary / opts.locateFile — cast past the type gap.
	return (
		sqlite3InitModule as unknown as (
			opts: Record<string, unknown>,
		) => Promise<Sqlite3Static>
	)(initOpts);
}

/**
 * Load the database with @sqlite.org/sqlite-wasm
 *
 * @param app - Obsidian App instance for file access
 * @param existingData - Existing database data to load (from file)
 * @returns Database wrapper
 */
export async function loadDatabase(
	_app: App,
	existingData?: Uint8Array | null,
): Promise<DatabaseLoadResult> {
	if (!cachedSqlite3) {
		cachedSqlite3 = await loadSqlite3();
	}

	const sqlite3 = cachedSqlite3;
	const db = new sqlite3.oo1.DB(":memory:");

	if (existingData && existingData.byteLength > 0) {
		if (!db.pointer)
			throw new Error("Database pointer unavailable after creation");
		const p = sqlite3.wasm.allocFromTypedArray(existingData);
		const rc = sqlite3.capi.sqlite3_deserialize(
			db.pointer,
			"main",
			p,
			existingData.byteLength,
			existingData.byteLength,
			sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE |
				sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE,
		);
		if (rc !== 0) {
			db.close();
			throw new Error(
				`[True Recall] Failed to load database — sqlite3_deserialize returned ${rc}`,
			);
		}
	}

	return { db: new SqliteOrgWrapper(db, sqlite3) };
}

/**
 * Reset loader state (for testing)
 */
export function resetLoaderState(): void {
	cachedSqlite3 = null;
}
