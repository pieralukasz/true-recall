/**
 * Migration V7 -> V8
 * Remove tags column from cards
 */
import type { DatabaseLike } from "../sqlite.types";

export function migrate(db: DatabaseLike): void {
    console.log("[Episteme] Migrating schema v7 -> v8...");

    db.exec(`
        CREATE TABLE cards_new (
            id TEXT PRIMARY KEY,
            due TEXT NOT NULL,
            stability REAL DEFAULT 0,
            difficulty REAL DEFAULT 0,
            reps INTEGER DEFAULT 0,
            lapses INTEGER DEFAULT 0,
            state INTEGER DEFAULT 0,
            last_review TEXT,
            scheduled_days INTEGER DEFAULT 0,
            learning_step INTEGER DEFAULT 0,
            suspended INTEGER DEFAULT 0,
            buried_until TEXT,
            created_at INTEGER,
            updated_at INTEGER,
            question TEXT,
            answer TEXT,
            source_uid TEXT
        );
    `);

    db.exec(`
        INSERT INTO cards_new
        SELECT id, due, stability, difficulty, reps, lapses, state,
               last_review, scheduled_days, learning_step, suspended,
               buried_until, created_at, updated_at,
               question, answer, source_uid
        FROM cards;
    `);

    db.exec(`DROP TABLE cards;`);
    db.exec(`ALTER TABLE cards_new RENAME TO cards;`);
    db.exec(`CREATE INDEX idx_cards_due ON cards(due);`);
    db.exec(`CREATE INDEX idx_cards_state ON cards(state);`);
    db.exec(`CREATE INDEX idx_cards_suspended ON cards(suspended);`);
    db.exec(`CREATE INDEX idx_cards_source_uid ON cards(source_uid);`);

    db.exec(`
        INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '8');
    `);
    console.log("[Episteme] Schema migration v7->v8 completed");
}
