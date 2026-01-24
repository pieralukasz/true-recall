/**
 * Migration V12 -> V13
 * Remove sync_log table
 */
import type { DatabaseLike } from "../sqlite.types";

export function migrate(db: DatabaseLike): void {
    console.log("[Episteme] Migrating schema v12 -> v13...");

    db.exec(`DROP INDEX IF EXISTS idx_sync_log_pending;`);
    db.exec(`DROP TABLE IF EXISTS sync_log;`);

    db.exec(`
        INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '13');
    `);
    console.log("[Episteme] Schema migration v12->v13 completed");
}
