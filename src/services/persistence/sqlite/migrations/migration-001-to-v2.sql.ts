/**
 * Migration V1 -> V2
 * Add question/answer columns and source_notes table
 */
import type { DatabaseLike } from "../sqlite.types";

export function migrate(db: DatabaseLike): void {
    console.log("[Episteme] Migrating schema v1 -> v2...");

    const columnsToAdd = [
        "ALTER TABLE cards ADD COLUMN question TEXT",
        "ALTER TABLE cards ADD COLUMN answer TEXT",
        "ALTER TABLE cards ADD COLUMN source_uid TEXT",
        "ALTER TABLE cards ADD COLUMN tags TEXT",
    ];

    for (const sql of columnsToAdd) {
        try {
            db.run(sql);
        } catch {
            // Column might already exist
        }
    }

    db.run(`
        CREATE TABLE IF NOT EXISTS source_notes (
            uid TEXT PRIMARY KEY,
            note_name TEXT NOT NULL,
            note_path TEXT,
            deck TEXT DEFAULT 'Knowledge',
            created_at INTEGER,
            updated_at INTEGER
        )
    `);

    try {
        db.run("CREATE INDEX IF NOT EXISTS idx_cards_source_uid ON cards(source_uid)");
        db.run("CREATE INDEX IF NOT EXISTS idx_source_notes_name ON source_notes(note_name)");
    } catch {
        // Indexes might already exist
    }

    db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '2')");
    console.log("[Episteme] Schema migration v1->v2 completed");
}
