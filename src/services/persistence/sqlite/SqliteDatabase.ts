/**
 * SQLite Database Helper Class
 * Provides high-level database operations with automatic dirty state tracking
 *
 * This class wraps the raw sql.js DatabaseLike interface and provides
 * typed query helpers that eliminate boilerplate from repository classes.
 */
import type { App } from "obsidian";
import type {
    BindParams,
    DatabaseLike,
    DatabaseLoadResult,
    QueryExecResult,
} from "./loader";
import { loadDatabase } from "./loader";

/**
 * High-level SQLite database wrapper with query helpers
 */
export class SqliteDatabase {
    private db: DatabaseLike | null = null;

    constructor(private app: App, private onDirty: () => void) {}

    /**
     * Initialize the database with existing data or create new
     */
    async init(existingData: Uint8Array | null): Promise<void> {
        const result: DatabaseLoadResult = await loadDatabase(this.app, existingData);
        this.db = result.db;
    }

    /**
     * Execute a query and return all rows as typed objects
     * Automatically maps column names to object properties
     *
     * @example
     * const cards = db.query<CardType>("SELECT * FROM cards WHERE state = ?", [2]);
     */
    query<T extends object>(sql: string, params: BindParams = []): T[] {
        if (!this.db) throw new Error("Database not initialized");

        const result = this.db.exec(sql, params);
        if (result.length === 0) return [];

        const { columns, values } = result[0]!;
        return values.map((row) => {
            const obj: Record<string, unknown> = {};
            columns.forEach((col, i) => {
                obj[col] = row[i];
            });
            return obj as T;
        });
    }

    /**
     * Execute a query and return the first row or null
     *
     * @example
     * const card = db.get<CardType>("SELECT * FROM cards WHERE id = ?", [cardId]);
     */
    get<T extends object>(sql: string, params: BindParams = []): T | null {
        const results = this.query<T>(sql, params);
        return results[0] || null;
    }

    /**
     * Execute a write operation and mark database as dirty
     *
     * @example
     * db.run("INSERT INTO cards (id, question) VALUES (?, ?)", [id, question]);
     */
    run(sql: string, params: BindParams = []): void {
        if (!this.db) throw new Error("Database not initialized");

        this.db.run(sql, params);
        this.onDirty();
    }

    /**
     * Execute multiple SQL statements in a transaction-like manner
     * Marks dirty after all statements complete
     *
     * @example
     * db.runMany([
     *     ["DELETE FROM cards WHERE id = ?", [cardId]],
     *     ["DELETE FROM review_log WHERE card_id = ?", [cardId]]
     * ]);
     */
    runMany(statements: Array<[sql: string, params: BindParams]>): void {
        if (!this.db) throw new Error("Database not initialized");

        for (const [sql, params] of statements) {
            this.db.run(sql, params);
        }
        this.onDirty();
    }

    /**
     * Get the number of rows modified by the last INSERT/UPDATE/DELETE
     */
    getRowsModified(): number {
        if (!this.db) return 0;
        return this.db.getRowsModified();
    }

    /**
     * Access to the raw database instance for advanced operations
     * Use sparingly - prefer query/get/run helpers
     */
    get raw(): DatabaseLike {
        if (!this.db) throw new Error("Database not initialized");
        return this.db;
    }

    /**
     * Export database as binary data
     */
    export(): Uint8Array {
        if (!this.db) throw new Error("Database not initialized");
        return this.db.export();
    }

    /**
     * Close the database
     */
    close(): void {
        this.db?.close();
        this.db = null;
    }

    /**
     * Check if database is initialized
     */
    isReady(): boolean {
        return this.db !== null;
    }
}
