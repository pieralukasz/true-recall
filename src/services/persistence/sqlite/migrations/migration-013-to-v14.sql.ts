/**
 * Migration V13 -> V14
 * Add soft delete support (deleted_at, updated_at columns) for multi-device sync
 */
import type { DatabaseLike } from "../sqlite.types";

export function migrate(db: DatabaseLike): void {
    console.log("[Episteme] Migrating schema v13 -> v14...");

    // Add deleted_at to cards
    db.run(`ALTER TABLE cards ADD COLUMN deleted_at INTEGER DEFAULT NULL`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_cards_deleted ON cards(deleted_at)`);

    // Add updated_at and deleted_at to review_log
    db.run(`ALTER TABLE review_log ADD COLUMN updated_at INTEGER`);
    db.run(`ALTER TABLE review_log ADD COLUMN deleted_at INTEGER DEFAULT NULL`);
    db.run(`
        UPDATE review_log
        SET updated_at = CAST(strftime('%s', reviewed_at) AS INTEGER) * 1000
        WHERE updated_at IS NULL
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_revlog_deleted ON review_log(deleted_at)`);

    // Add deleted_at to projects
    db.run(`ALTER TABLE projects ADD COLUMN deleted_at INTEGER DEFAULT NULL`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_projects_deleted ON projects(deleted_at)`);

    // Add updated_at and deleted_at to note_projects
    db.run(`ALTER TABLE note_projects ADD COLUMN updated_at INTEGER`);
    db.run(`ALTER TABLE note_projects ADD COLUMN deleted_at INTEGER DEFAULT NULL`);
    db.run(`UPDATE note_projects SET updated_at = created_at WHERE updated_at IS NULL`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_note_projects_deleted ON note_projects(deleted_at)`);

    // Add deleted_at to source_notes
    db.run(`ALTER TABLE source_notes ADD COLUMN deleted_at INTEGER DEFAULT NULL`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_source_notes_deleted ON source_notes(deleted_at)`);

    // Add updated_at and deleted_at to card_image_refs
    db.run(`ALTER TABLE card_image_refs ADD COLUMN updated_at INTEGER`);
    db.run(`ALTER TABLE card_image_refs ADD COLUMN deleted_at INTEGER DEFAULT NULL`);
    db.run(`UPDATE card_image_refs SET updated_at = created_at WHERE updated_at IS NULL`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_image_refs_deleted ON card_image_refs(deleted_at)`);

    // Update schema version
    db.run(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '14')`);

    console.log("[Episteme] Schema migration v13->v14 completed");
}
