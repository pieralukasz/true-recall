import type { BindParams, DatabaseLike } from "./loader";
export declare class SqliteDatabase {
    private onDirty;
    private db;
    constructor(onDirty: () => void);
    init(existingData: Uint8Array | null): Promise<void>;
    /**
     * Execute a query and return all rows as typed objects
     * Automatically maps column names to object properties
     *
     * @example
     * const cards = db.query<CardType>("SELECT * FROM cards WHERE state = ?", [2]);
     */
    query<T extends object>(sql: string, params?: BindParams): T[];
    /**
     * Execute a query and return the first row or null
     *
     * @example
     * const card = db.get<CardType>("SELECT * FROM cards WHERE id = ?", [cardId]);
     */
    get<T extends object>(sql: string, params?: BindParams): T | null;
    /**
     * Execute a write operation and mark database as dirty
     *
     * @example
     * db.run("INSERT INTO cards (id, question) VALUES (?, ?)", [id, question]);
     */
    run(sql: string, params?: BindParams): void;
    /**
     * Execute a function within a database transaction
     * Provides atomicity - either all operations succeed or none do
     *
     * @example
     * db.transaction(() => {
     *     db.run("DELETE FROM cards WHERE id = ?", [cardId]);
     *     db.run("DELETE FROM review_log WHERE card_id = ?", [cardId]);
     * });
     */
    transaction<T>(fn: () => T): T;
    /**
     * Get the number of rows modified by the last INSERT/UPDATE/DELETE
     */
    getRowsModified(): number;
    /**
     * Access to the raw database instance for advanced operations
     * Use sparingly - prefer query/get/run helpers
     */
    get raw(): DatabaseLike;
    export(): Uint8Array;
    close(): void;
    isReady(): boolean;
}
