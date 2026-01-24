/**
 * Migration V10 -> V11
 * Add sync_log table (later removed in V13)
 */
import type { DatabaseLike } from "../sqlite.types";

export function migrate(db: DatabaseLike): void {
    console.log("[Episteme] Migrating schema v10 -> v11...");

    db.exec(`
        CREATE TABLE IF NOT EXISTS sync_log (
            id TEXT PRIMARY KEY NOT NULL,
            operation TEXT NOT NULL,
            table_name TEXT NOT NULL,
            row_id TEXT NOT NULL,
            data TEXT,
            timestamp INTEGER NOT NULL,
            synced INTEGER DEFAULT 0
        );
    `);

    db.exec(`CREATE INDEX IF NOT EXISTS idx_sync_log_pending ON sync_log(synced, timestamp);`);

    db.exec(`
        INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '11');
    `);
    console.log("[Episteme] Schema migration v10->v11 completed");
}
