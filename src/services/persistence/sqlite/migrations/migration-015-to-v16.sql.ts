/**
 * Migration V15 -> V16
 * Remove projects table - projects are now exclusively in frontmatter YAML
 */
import type { DatabaseLike } from "../sqlite.types";

export function migrate(db: DatabaseLike): void {
    console.debug("[True Recall] Migrating schema v15 -> v16...");

    // Drop projects table (data is now in frontmatter only)
    db.exec("DROP TABLE IF EXISTS projects");
    console.debug("[True Recall] Dropped projects table");

    // Update schema version
    db.run(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '16')`);

    console.debug("[True Recall] Schema migration v15->v16 completed");
}
