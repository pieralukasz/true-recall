/**
 * SQL Query Adapter
 * Bridges sql.js SQLite with the NL Query tool-calling agent.
 * Provides read-only query execution, schema introspection, and table listing.
 */
/** Common query result interface matching sql.js format */
export interface QueryExecResult {
    columns: string[];
    values: (string | number | null | Uint8Array)[][];
}
/** Database interface compatible with sql.js API (read-only subset) */
export interface DatabaseLike {
    exec(sql: string, params?: (string | number | null | Uint8Array)[]): QueryExecResult[];
}
export declare class SqlQueryAdapter {
    private db;
    constructor(db: DatabaseLike);
    /**
     * Execute a SQL query and return results as JSON string
     * Used by LangChain's SQL query tool
     */
    run(sql: string): string;
    getTableInfo(): string;
    /**
     * Get FSRS field annotation for cards table columns
     */
    private getFsrsFieldAnnotation;
    /**
     * Get list of all table names
     */
    getTableNames(): string[];
    /**
     * Get column names for a specific table
     */
    getColumnNames(tableName: string): string[];
    /**
     * Execute a raw query and return QueryExecResult
     * For internal use when we need the raw sql.js format
     */
    executeRaw(sql: string): QueryExecResult[];
    /**
     * Check if the database is ready
     */
    isReady(): boolean;
}
