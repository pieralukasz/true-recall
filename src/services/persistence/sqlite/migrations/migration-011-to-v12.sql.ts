/**
 * Migration V11 -> V12
 * No-op migration
 */
import type { DatabaseLike } from "../sqlite.types";

export function migrate(db: DatabaseLike): void {
    console.log("[Episteme] Migrating schema v11 -> v12 (no-op)...");

    db.exec(`
        INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '12');
    `);
    console.log("[Episteme] Schema migration v11->v12 completed");
}
