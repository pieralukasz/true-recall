/**
 * SQL Query Adapter
 * Bridges sql.js SQLite with the NL Query tool-calling agent.
 * Provides read-only query execution, schema introspection, and table listing.
 */
export class SqlQueryAdapter {
    constructor(db) {
        this.db = db;
    }
    /**
     * Execute a SQL query and return results as JSON string
     * Used by LangChain's SQL query tool
     */
    run(sql) {
        try {
            const normalizedSql = sql.trim().toUpperCase();
            if (!normalizedSql.startsWith("SELECT")) {
                return JSON.stringify({
                    error: "Only SELECT queries are allowed for security reasons",
                });
            }
            const result = this.db.exec(sql);
            if (result.length === 0) {
                return JSON.stringify([]);
            }
            const queryResult = result[0];
            if (!queryResult) {
                return JSON.stringify([]);
            }
            const rows = queryResult.values.map((row) => {
                const obj = {};
                queryResult.columns.forEach((col, i) => {
                    obj[col] = row[i];
                });
                return obj;
            });
            return JSON.stringify(rows, null, 2);
        }
        catch (error) {
            return JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    getTableInfo() {
        var _a, _b, _c, _d, _e, _f, _g;
        const tables = this.getTableNames();
        const schemaInfo = [];
        for (const table of tables) {
            const columnsResult = this.db.exec(`PRAGMA table_info("${table}")`);
            if (columnsResult.length === 0)
                continue;
            const columns = (_a = columnsResult[0]) === null || _a === void 0 ? void 0 : _a.values.map((row) => {
                const name = row[1];
                const type = row[2];
                const notNull = row[3];
                const pk = row[5];
                let annotation = "";
                if (table === "cards") {
                    annotation = this.getFsrsFieldAnnotation(name);
                }
                return `  ${name} ${type}${notNull ? " NOT NULL" : ""}${pk ? " PRIMARY KEY" : ""}${annotation}`;
            });
            let fsrsNotesSection = "";
            if (table === "cards") {
                fsrsNotesSection = `\n\nFSRS Notes:
  - "Due today" queries MUST exclude state=0 (new cards are never "due")
  - Mature cards: state=2 AND scheduled_days >= 21
  - Young cards: state=2 AND scheduled_days < 21
  - Problem cards: lapses > 3 OR stability < 2.0 OR state = 3
  - Active cards filter: suspended=0 AND (buried_until IS NULL OR buried_until <= datetime('now'))
  - Day boundary: 4 AM (Review cards due before tomorrow's 4 AM)`;
            }
            if (table === "review_log") {
                fsrsNotesSection = `\n\nRating values:
  - 1 = Again (failed recall)
  - 2 = Hard (difficult recall)
  - 3 = Good (normal recall)
  - 4 = Easy (perfect recall)`;
            }
            const sampleResult = this.db.exec(`SELECT * FROM "${table}" LIMIT 3`);
            let sampleSection = "";
            if (sampleResult.length > 0 &&
                ((_c = (_b = sampleResult[0]) === null || _b === void 0 ? void 0 : _b.values.length) !== null && _c !== void 0 ? _c : 0) > 0) {
                const sampleRows = (_d = sampleResult[0]) === null || _d === void 0 ? void 0 : _d.values.map((row) => row
                    .map((v) => v === null
                    ? "NULL"
                    : typeof v === "string" && v.length > 50
                        ? `${v.substring(0, 50)}...`
                        : String(v))
                    .join(", ")).join("\n  ");
                sampleSection = `\n\nSample data:\n  ${sampleRows}`;
            }
            const countResult = this.db.exec(`SELECT COUNT(*) FROM "${table}"`);
            const rowCount = (_g = (_f = (_e = countResult[0]) === null || _e === void 0 ? void 0 : _e.values[0]) === null || _f === void 0 ? void 0 : _f[0]) !== null && _g !== void 0 ? _g : 0;
            schemaInfo.push(`Table: ${table} (${String(rowCount)} rows)\nColumns:\n${(columns !== null && columns !== void 0 ? columns : []).join("\n")}${fsrsNotesSection}${sampleSection}`);
        }
        return schemaInfo.join("\n\n---\n\n");
    }
    /**
     * Get FSRS field annotation for cards table columns
     */
    getFsrsFieldAnnotation(fieldName) {
        const annotations = {
            state: "  -- 0=New (never due), 1=Learning, 2=Review, 3=Relearning",
            due: "  -- ISO datetime; day-based for Review (state=2), timestamp for Learning (state=1,3)",
            scheduled_days: "  -- Interval in days; >= 21 = Mature card",
            stability: "  -- FSRS retention prediction in days; low (<2.0) = problem card",
            difficulty: "  -- FSRS difficulty (0-10 scale); higher = harder to remember",
            lapses: "  -- Times failed (rating=1); high (>3) = problem card",
            reps: "  -- Total review count (all ratings)",
            suspended: "  -- 0=active, 1=suspended (excluded from study)",
            buried_until: "  -- NULL or future datetime (temporarily hidden)",
            last_review: "  -- ISO datetime of most recent review",
            learning_step: "  -- Current position in learning steps (for state=1,3)",
        };
        return annotations[fieldName] || "";
    }
    /**
     * Get list of all table names
     */
    getTableNames() {
        var _a, _b;
        const result = this.db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        if (result.length === 0)
            return [];
        return (_b = (_a = result[0]) === null || _a === void 0 ? void 0 : _a.values.map((row) => row[0])) !== null && _b !== void 0 ? _b : [];
    }
    /**
     * Get column names for a specific table
     */
    getColumnNames(tableName) {
        var _a, _b;
        const result = this.db.exec(`PRAGMA table_info("${tableName}")`);
        if (result.length === 0)
            return [];
        return (_b = (_a = result[0]) === null || _a === void 0 ? void 0 : _a.values.map((row) => row[1])) !== null && _b !== void 0 ? _b : [];
    }
    /**
     * Execute a raw query and return QueryExecResult
     * For internal use when we need the raw sql.js format
     */
    executeRaw(sql) {
        return this.db.exec(sql);
    }
    /**
     * Check if the database is ready
     */
    isReady() {
        try {
            this.db.exec("SELECT 1");
            return true;
        }
        catch (_a) {
            return false;
        }
    }
}
