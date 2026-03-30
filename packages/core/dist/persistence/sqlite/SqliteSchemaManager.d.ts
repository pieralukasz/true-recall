import type { DatabaseLike } from "./sqlite.types";
export declare class SqliteSchemaManager {
    private db;
    constructor(db: DatabaseLike);
    createTables(): void;
    /**
     * FTS5 full-text search on notes.fields_json.
     * External content table — no data duplication, reads from notes via rowid.
     * Wrapped in try/catch because FTS5 requires the extension compiled into the WASM binary.
     */
    private createFts5;
}
