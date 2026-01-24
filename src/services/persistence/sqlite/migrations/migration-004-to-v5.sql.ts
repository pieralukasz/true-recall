/**
 * Migration V4 -> V5
 * Project-based learning system
 */
import type { DatabaseLike } from "../sqlite.types";

export function migrate(db: DatabaseLike): void {
    console.log("[Episteme] Migrating schema v4 -> v5...");

    // Create projects table
    db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            created_at INTEGER,
            updated_at INTEGER
        );
    `);

    try {
        db.exec("CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);");
    } catch {
        // Index might already exist
    }

    // Create note_projects junction table
    db.exec(`
        CREATE TABLE IF NOT EXISTS note_projects (
            source_uid TEXT NOT NULL,
            project_id INTEGER NOT NULL,
            created_at INTEGER,
            PRIMARY KEY (source_uid, project_id),
            FOREIGN KEY (source_uid) REFERENCES source_notes(uid) ON DELETE CASCADE,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
    `);

    try {
        db.exec("CREATE INDEX IF NOT EXISTS idx_note_projects_source ON note_projects(source_uid);");
        db.exec("CREATE INDEX IF NOT EXISTS idx_note_projects_project ON note_projects(project_id);");
    } catch {
        // Indexes might already exist
    }

    // Recreate source_notes without deck column
    db.exec(`
        CREATE TABLE source_notes_new (
            uid TEXT PRIMARY KEY,
            note_name TEXT NOT NULL,
            note_path TEXT,
            created_at INTEGER,
            updated_at INTEGER
        );

        INSERT INTO source_notes_new (uid, note_name, note_path, created_at, updated_at)
        SELECT uid, note_name, note_path, created_at, updated_at
        FROM source_notes;

        DROP TABLE source_notes;
        ALTER TABLE source_notes_new RENAME TO source_notes;

        CREATE INDEX idx_source_notes_name ON source_notes(note_name);
    `);

    db.exec(`
        INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '5');
    `);
    console.log("[Episteme] Schema migration v4->v5 completed");
}
