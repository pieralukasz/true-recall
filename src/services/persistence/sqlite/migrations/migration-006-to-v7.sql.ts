/**
 * Migration V6 -> V7
 * Sync card created_at with source notes
 */
import { getQueryResult } from "../sqlite.types";
import type { DatabaseLike } from "../sqlite.types";

export function migrate(db: DatabaseLike): void {
    console.log("[Episteme] Migrating schema v6 -> v7 (syncing card created_at with source notes)...");

    const result = db.exec(`
        SELECT c.id, s.created_at as source_created_at
        FROM cards c
        INNER JOIN source_notes s ON c.source_uid = s.uid
        WHERE c.created_at != s.created_at
    `);

    const data = getQueryResult(result);

    if (data && data.values.length > 0) {
        console.log(`[Episteme] Found ${data.values.length} cards to sync with source notes`);

        for (const row of data.values) {
            const cardId = row[0] as string;
            const sourceCreatedAt = row[1] as number;

            db.run(
                `UPDATE cards SET created_at = ? WHERE id = ?`,
                [sourceCreatedAt, cardId]
            );
        }

        console.log(`[Episteme] Synced created_at for ${data.values.length} cards`);
    } else {
        console.log("[Episteme] No cards needed created_at sync");
    }

    db.exec(`
        INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '7');
    `);
    console.log("[Episteme] Schema migration v6->v7 completed");
}
