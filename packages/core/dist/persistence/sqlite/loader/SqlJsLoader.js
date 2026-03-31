/**
 * SQLite WASM Loader
 * Uses @sqlite.org/sqlite-wasm which includes FTS5, JSON1, RTREE, and all
 * other SQLite extensions — no custom WASM compilation needed.
 */
import { __awaiter } from "tslib";
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import embeddedWasm from "@sqlite.org/sqlite-wasm/sqlite3.wasm";
class SqliteOrgWrapper {
    constructor(db, sqlite3) {
        this.db = db;
        this.sqlite3 = sqlite3;
    }
    exec(sql, params) {
        const columnNames = [];
        const rows = this.db.exec({
            sql,
            bind: params,
            returnValue: "resultRows",
            rowMode: "array",
            columnNames,
        });
        // No columns = DDL/DML or empty result — match sql.js returning []
        if (columnNames.length === 0)
            return [];
        return [{ columns: columnNames, values: rows }];
    }
    run(sql, params) {
        this.db.exec({ sql, bind: params });
    }
    export() {
        return this.sqlite3.capi.sqlite3_js_db_export(this.db);
    }
    close() {
        this.db.close();
    }
    getRowsModified() {
        return this.db.changes();
    }
}
// Cached instance — initialising sqlite3 is expensive, reuse across DB loads
let cachedSqlite3 = null;
function loadSqlite3() {
    return __awaiter(this, void 0, void 0, function* () {
        const initOpts = {
            print: () => { },
            printErr: (msg) => {
                if (msg.startsWith("warning:"))
                    return;
                console.error("[SQLite WASM]", msg);
            },
            // Prevent Emscripten from calling new URL("sqlite3.wasm", import.meta.url)
            // which fails because esbuild's CJS shim sets import.meta to {}
            locateFile: (file) => file,
            // WASM binary is embedded in the bundle by esbuild's binary loader
            wasmBinary: new Uint8Array(embeddedWasm),
        };
        // The TS types declare init() with no args, but the Emscripten runtime
        // reads opts.wasmBinary / opts.locateFile — cast past the type gap.
        return sqlite3InitModule(initOpts);
    });
}
/**
 * Load the database with @sqlite.org/sqlite-wasm
 *
 * @param existingData - Existing database data to load (from file)
 * @returns Database wrapper
 */
export function loadDatabase(existingData) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!cachedSqlite3) {
            cachedSqlite3 = yield loadSqlite3();
        }
        const sqlite3 = cachedSqlite3;
        const db = new sqlite3.oo1.DB(":memory:");
        if (existingData && existingData.byteLength > 0) {
            if (!db.pointer)
                throw new Error("Database pointer unavailable after creation");
            const p = sqlite3.wasm.allocFromTypedArray(existingData);
            const rc = sqlite3.capi.sqlite3_deserialize(db.pointer, "main", p, existingData.byteLength, existingData.byteLength, sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE |
                sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE);
            if (rc !== 0) {
                db.close();
                throw new Error(`[True Recall] Failed to load database — sqlite3_deserialize returned ${rc}`);
            }
        }
        return { db: new SqliteOrgWrapper(db, sqlite3) };
    });
}
/**
 * Reset loader state (for testing)
 */
export function resetLoaderState() {
    cachedSqlite3 = null;
}
