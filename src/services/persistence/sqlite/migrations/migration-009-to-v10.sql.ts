/**
 * Migration V9 -> V10
 * UUID primary keys
 */
import { getQueryResult, generateUUID } from "../sqlite.types";
import type { DatabaseLike } from "../sqlite.types";

export function migrate(db: DatabaseLike): void {
    console.log("[Episteme] Migrating schema v9 -> v10 (UUID PKs)...");

    // 1. Create mapping table for old project IDs to new UUIDs
    db.exec(`
        CREATE TEMPORARY TABLE project_id_mapping (
            old_id INTEGER PRIMARY KEY,
            new_id TEXT NOT NULL
        );
    `);

    // 2. Generate UUIDs for existing projects
    const projectsResult = db.exec("SELECT id FROM projects");
    const projectsData = getQueryResult(projectsResult);
    if (projectsData) {
        for (const row of projectsData.values) {
            const oldId = row[0] as number;
            const newId = generateUUID();
            db.run(
                "INSERT INTO project_id_mapping (old_id, new_id) VALUES (?, ?)",
                [oldId, newId]
            );
        }
    }

    // 3. Create new projects table with TEXT UUID PK
    db.exec(`
        CREATE TABLE projects_new (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT UNIQUE NOT NULL,
            created_at INTEGER,
            updated_at INTEGER
        );
    `);

    // 4. Copy projects with new UUIDs
    db.exec(`
        INSERT INTO projects_new (id, name, created_at, updated_at)
        SELECT m.new_id, p.name, p.created_at, p.updated_at
        FROM projects p
        JOIN project_id_mapping m ON p.id = m.old_id;
    `);

    // 5. Create new note_projects table with TEXT project_id
    db.exec(`
        CREATE TABLE note_projects_new (
            source_uid TEXT NOT NULL,
            project_id TEXT NOT NULL,
            created_at INTEGER,
            PRIMARY KEY (source_uid, project_id),
            FOREIGN KEY (source_uid) REFERENCES source_notes(uid) ON DELETE CASCADE,
            FOREIGN KEY (project_id) REFERENCES projects_new(id) ON DELETE CASCADE
        );
    `);

    // 6. Copy note_projects with new project IDs
    db.exec(`
        INSERT INTO note_projects_new (source_uid, project_id, created_at)
        SELECT np.source_uid, m.new_id, np.created_at
        FROM note_projects np
        JOIN project_id_mapping m ON np.project_id = m.old_id;
    `);

    // 7. Drop old tables and rename new ones
    db.exec("DROP TABLE note_projects;");
    db.exec("DROP TABLE projects;");
    db.exec("ALTER TABLE projects_new RENAME TO projects;");
    db.exec("ALTER TABLE note_projects_new RENAME TO note_projects;");

    // 8. Recreate indexes
    db.exec("CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_note_projects_source ON note_projects(source_uid);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_note_projects_project ON note_projects(project_id);");

    // 9. Migrate review_log to TEXT UUID PK
    db.exec(`
        CREATE TABLE review_log_new (
            id TEXT PRIMARY KEY NOT NULL,
            card_id TEXT NOT NULL,
            reviewed_at TEXT NOT NULL,
            rating INTEGER NOT NULL,
            scheduled_days INTEGER,
            elapsed_days INTEGER,
            state INTEGER,
            time_spent_ms INTEGER,
            FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
        );
    `);

    const reviewLogResult = db.exec("SELECT * FROM review_log");
    const reviewLogData = getQueryResult(reviewLogResult);
    if (reviewLogData) {
        const cols = reviewLogData.columns;
        const cardIdIdx = cols.indexOf("card_id");
        const reviewedAtIdx = cols.indexOf("reviewed_at");
        const ratingIdx = cols.indexOf("rating");
        const scheduledDaysIdx = cols.indexOf("scheduled_days");
        const elapsedDaysIdx = cols.indexOf("elapsed_days");
        const stateIdx = cols.indexOf("state");
        const timeSpentMsIdx = cols.indexOf("time_spent_ms");

        for (const row of reviewLogData.values) {
            const newId = generateUUID();
            db.run(`
                INSERT INTO review_log_new (id, card_id, reviewed_at, rating, scheduled_days, elapsed_days, state, time_spent_ms)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                newId,
                row[cardIdIdx] ?? null,
                row[reviewedAtIdx] ?? null,
                row[ratingIdx] ?? null,
                row[scheduledDaysIdx] ?? null,
                row[elapsedDaysIdx] ?? null,
                row[stateIdx] ?? null,
                row[timeSpentMsIdx] ?? null,
            ]);
        }
    }

    db.exec("DROP TABLE review_log;");
    db.exec("ALTER TABLE review_log_new RENAME TO review_log;");
    db.exec("CREATE INDEX IF NOT EXISTS idx_revlog_card ON review_log(card_id);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_revlog_date ON review_log(reviewed_at);");

    // 10. Migrate card_image_refs to TEXT UUID PK
    db.exec(`
        CREATE TABLE card_image_refs_new (
            id TEXT PRIMARY KEY NOT NULL,
            card_id TEXT NOT NULL,
            image_path TEXT NOT NULL,
            field TEXT NOT NULL,
            created_at INTEGER,
            FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
        );
    `);

    const imageRefsResult = db.exec("SELECT * FROM card_image_refs");
    const imageRefsData = getQueryResult(imageRefsResult);
    if (imageRefsData) {
        const cols = imageRefsData.columns;
        const cardIdIdx = cols.indexOf("card_id");
        const imagePathIdx = cols.indexOf("image_path");
        const fieldIdx = cols.indexOf("field");
        const createdAtIdx = cols.indexOf("created_at");

        for (const row of imageRefsData.values) {
            const newId = generateUUID();
            db.run(`
                INSERT INTO card_image_refs_new (id, card_id, image_path, field, created_at)
                VALUES (?, ?, ?, ?, ?)
            `, [newId, row[cardIdIdx] ?? null, row[imagePathIdx] ?? null, row[fieldIdx] ?? null, row[createdAtIdx] ?? null]);
        }
    }

    db.exec("DROP TABLE card_image_refs;");
    db.exec("ALTER TABLE card_image_refs_new RENAME TO card_image_refs;");
    db.exec("CREATE INDEX IF NOT EXISTS idx_image_refs_path ON card_image_refs(image_path);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_image_refs_card ON card_image_refs(card_id);");

    // 11. Drop temporary mapping table
    db.exec("DROP TABLE project_id_mapping;");

    db.exec(`
        INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '10');
    `);
    console.log("[Episteme] Schema migration v9->v10 completed");
}
