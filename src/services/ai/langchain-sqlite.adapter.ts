/**
 * LangChain SQLite Adapter
 * Bridges sql.js (in-memory SQLite) with LangChain's SQL tools
 *
 * LangChain expects a DataSource-style interface, but sql.js uses
 * a different API. This adapter provides the necessary methods.
 */
import type { Database, QueryExecResult } from "sql.js";

/**
 * Adapter to make sql.js compatible with LangChain SQL tools
 */
export class SqlJsAdapter {
    private db: Database;

    constructor(db: Database) {
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
                return `  ${name} ${type}${notNull ? " NOT NULL" : ""}${pk ? " PRIMARY KEY" : ""}`;
            });

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
                `Table: ${table} (${rowCount} rows)\nColumns:\n${columns.join("\n")}${sampleSection}`
            );
        }

        return schemaInfo.join("\n\n---\n\n");
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
