import { __awaiter } from "tslib";
import { loadDatabase } from "./loader";
export class SqliteDatabase {
    constructor(onDirty) {
        this.onDirty = onDirty;
        this.db = null;
    }
    init(existingData) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield loadDatabase(existingData);
            this.db = result.db;
        });
    }
    /**
     * Execute a query and return all rows as typed objects
     * Automatically maps column names to object properties
     *
     * @example
     * const cards = db.query<CardType>("SELECT * FROM cards WHERE state = ?", [2]);
     */
    query(sql, params = []) {
        if (!this.db)
            throw new Error("Database not initialized");
        const result = this.db.exec(sql, params);
        if (result.length === 0)
            return [];
        const first = result[0];
        if (!first)
            return [];
        const { columns, values } = first;
        return values.map((row) => {
            const obj = {};
            columns.forEach((col, i) => {
                obj[col] = row[i];
            });
            return obj;
        });
    }
    /**
     * Execute a query and return the first row or null
     *
     * @example
     * const card = db.get<CardType>("SELECT * FROM cards WHERE id = ?", [cardId]);
     */
    get(sql, params = []) {
        const results = this.query(sql, params);
        return results[0] || null;
    }
    /**
     * Execute a write operation and mark database as dirty
     *
     * @example
     * db.run("INSERT INTO cards (id, question) VALUES (?, ?)", [id, question]);
     */
    run(sql, params = []) {
        if (!this.db)
            throw new Error("Database not initialized");
        this.db.run(sql, params);
        this.onDirty();
    }
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
    transaction(fn) {
        if (!this.db)
            throw new Error("Database not initialized");
        try {
            this.db.run("BEGIN TRANSACTION");
            const result = fn();
            this.db.run("COMMIT");
            this.onDirty();
            return result;
        }
        catch (e) {
            this.db.run("ROLLBACK");
            throw e;
        }
    }
    /**
     * Get the number of rows modified by the last INSERT/UPDATE/DELETE
     */
    getRowsModified() {
        if (!this.db)
            return 0;
        return this.db.getRowsModified();
    }
    /**
     * Access to the raw database instance for advanced operations
     * Use sparingly - prefer query/get/run helpers
     */
    get raw() {
        if (!this.db)
            throw new Error("Database not initialized");
        return this.db;
    }
    export() {
        if (!this.db)
            throw new Error("Database not initialized");
        return this.db.export();
    }
    close() {
        var _a;
        (_a = this.db) === null || _a === void 0 ? void 0 : _a.close();
        this.db = null;
    }
    isReady() {
        return this.db !== null;
    }
}
