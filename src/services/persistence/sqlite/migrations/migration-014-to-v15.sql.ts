/**
 * Migration V14 -> V15
 * Remove note_projects table, simplify source_notes (remove note_name, note_path)
 * Projects are now read from frontmatter (source of truth)
 */
import type { DatabaseLike } from "../sqlite.types";

export function migrate(db: DatabaseLike): void {
    console.log("[Episteme] Migrating schema v14 -> v15...");

    // 1. Drop note_projects table (data is redundant with frontmatter)
    db.exec("DROP TABLE IF EXISTS note_projects");
    console.log("[Episteme] Dropped note_projects table");

    // 2. Recreate source_notes without note_name and note_path
    // SQLite doesn't support DROP COLUMN, so we recreate the table
    db.exec(`
        CREATE TABLE source_notes_new (
            uid TEXT PRIMARY KEY NOT NULL,
            created_at INTEGER,
            updated_at INTEGER,
            deleted_at INTEGER DEFAULT NULL
        );

        INSERT INTO source_notes_new (uid, created_at, updated_at, deleted_at)
        SELECT uid, created_at, updated_at, deleted_at FROM source_notes;

        DROP TABLE source_notes;
        ALTER TABLE source_notes_new RENAME TO source_notes;

        CREATE INDEX IF NOT EXISTS idx_source_notes_deleted ON source_notes(deleted_at);
    `);
    console.log("[Episteme] Simplified source_notes table (removed note_name, note_path)");

    // Update schema version
    db.run(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '15')`);

    console.log("[Episteme] Schema migration v14->v15 completed");
}
