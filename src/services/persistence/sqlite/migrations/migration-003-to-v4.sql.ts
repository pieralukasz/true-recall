/**
 * Migration V3 -> V4
 * Add card_image_refs table
 */
import type { DatabaseLike } from "../sqlite.types";

export function migrate(db: DatabaseLike): void {
    console.log("[Episteme] Migrating schema v3 -> v4...");

    db.exec(`
        CREATE TABLE IF NOT EXISTS card_image_refs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_id TEXT NOT NULL,
            image_path TEXT NOT NULL,
            field TEXT NOT NULL,
            created_at INTEGER,
            FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
        );
    `);

    db.exec(`CREATE INDEX IF NOT EXISTS idx_image_refs_path ON card_image_refs(image_path);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_image_refs_card ON card_image_refs(card_id);`);

    db.exec(`
        INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '4');
    `);
    console.log("[Episteme] Schema migration v3->v4 completed");
}
