/**
 * Migration V8 -> V9
 * Remove redundant index
 */
import type { DatabaseLike } from "../sqlite.types";

export function migrate(db: DatabaseLike): void {
    console.log("[Episteme] Migrating schema v8 -> v9...");

    db.exec(`DROP INDEX IF EXISTS idx_daily_reviewed_date;`);

    db.exec(`
        INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '9');
    `);
    console.log("[Episteme] Schema migration v8->v9 completed");
}
