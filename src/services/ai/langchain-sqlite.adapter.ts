/**
 * LangChain SQLite Adapter
 * Bridges SQLite (sql.js or CR-SQLite) with LangChain's SQL tools
 *
 * LangChain expects a DataSource-style interface, but our database uses
 * a different API. This adapter provides the necessary methods.
 */
import type { DatabaseLike, QueryExecResult } from "../persistence/crsqlite";

/**
 * Adapter to make SQLite database compatible with LangChain SQL tools
 */
export class SqlJsAdapter {
    private db: DatabaseLike;

    constructor(db: DatabaseLike) {
        this.db = db;
    }

    /**
     * Execute a SQL query and return results as JSON string
     * Used by LangChain's SQL query tool
     */
    run(sql: string): string {
        try {
            // Security: Only allow SELECT queries
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

            // Convert to array of objects for better readability
            const queryResult = result[0];
            if (!queryResult) {
                return JSON.stringify([]);
            }

            const rows = queryResult.values.map((row) => {
                const obj: Record<string, unknown> = {};
                queryResult.columns.forEach((col, i) => {
                    obj[col] = row[i];
                });
                return obj;
            });

            return JSON.stringify(rows, null, 2);
        } catch (error) {
            return JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Get information about all tables (schema)
     * Used by LangChain to understand database structure
     */
    getTableInfo(): string {
        const tables = this.getTableNames();
        const schemaInfo: string[] = [];

        for (const table of tables) {
            // Get column information
            const columnsResult = this.db.exec(
                `PRAGMA table_info("${table}")`
            );
            if (columnsResult.length === 0) continue;

            const columns = columnsResult[0]!.values.map((row) => {
                const name = row[1] as string;
                const type = row[2] as string;
                const notNull = row[3] as number;
                const pk = row[5] as number;

                // Add FSRS annotations for cards table
                let annotation = "";
                if (table === "cards") {
                    annotation = this.getFsrsFieldAnnotation(name);
                }

                return `  ${name} ${type}${notNull ? " NOT NULL" : ""}${pk ? " PRIMARY KEY" : ""}${annotation}`;
            });

            // Add FSRS notes section for cards table
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

            // Add rating annotations for review_log table
            if (table === "review_log") {
                fsrsNotesSection = `\n\nRating values:
  - 1 = Again (failed recall)
  - 2 = Hard (difficult recall)
  - 3 = Good (normal recall)
  - 4 = Easy (perfect recall)`;
            }

            // Get sample data (first 3 rows)
            const sampleResult = this.db.exec(
                `SELECT * FROM "${table}" LIMIT 3`
            );
            let sampleSection = "";
            if (sampleResult.length > 0 && sampleResult[0]!.values.length > 0) {
                const sampleRows = sampleResult[0]!.values
                    .map((row) =>
                        row
                            .map((v) =>
                                v === null
                                    ? "NULL"
                                    : typeof v === "string" && v.length > 50
                                      ? v.substring(0, 50) + "..."
                                      : String(v)
                            )
                            .join(", ")
                    )
                    .join("\n  ");
                sampleSection = `\n\nSample data:\n  ${sampleRows}`;
            }

            // Get row count
            const countResult = this.db.exec(
                `SELECT COUNT(*) FROM "${table}"`
            );
            const rowCount = countResult[0]?.values[0]?.[0] ?? 0;

            schemaInfo.push(
                `Table: ${table} (${rowCount} rows)\nColumns:\n${columns.join("\n")}${fsrsNotesSection}${sampleSection}`
            );
        }

        return schemaInfo.join("\n\n---\n\n");
    }

    /**
     * Get FSRS field annotation for cards table columns
     */
    private getFsrsFieldAnnotation(fieldName: string): string {
        const annotations: Record<string, string> = {
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
    getTableNames(): string[] {
        const result = this.db.exec(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        );
        if (result.length === 0) return [];

        return result[0]!.values.map((row) => row[0] as string);
    }

    /**
     * Get column names for a specific table
     */
    getColumnNames(tableName: string): string[] {
        const result = this.db.exec(`PRAGMA table_info("${tableName}")`);
        if (result.length === 0) return [];

        return result[0]!.values.map((row) => row[1] as string);
    }

    /**
     * Execute a raw query and return QueryExecResult
     * For internal use when we need the raw sql.js format
     */
    executeRaw(sql: string): QueryExecResult[] {
        return this.db.exec(sql);
    }

    /**
     * Check if the database is ready
     */
    isReady(): boolean {
        try {
            this.db.exec("SELECT 1");
            return true;
        } catch {
            return false;
        }
    }
}
