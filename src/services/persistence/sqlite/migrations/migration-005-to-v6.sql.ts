/**
 * Migration V5 -> V6
 * Fix data corruption
 */
import { getQueryResult } from "../sqlite.types";
import type { DatabaseLike } from "../sqlite.types";

export function migrate(db: DatabaseLike): void {
    console.log("[Episteme] Migrating schema v5 -> v6 (fixing data corruption)...");

    // Fix created_at for cards that have reviews before their creation date
    const createdAtResult = db.exec(`
        SELECT c.id, c.created_at,
               MIN(strftime('%s', r.reviewed_at) * 1000) as earliest_review
        FROM cards c
        JOIN review_log r ON r.card_id = c.id
        WHERE c.created_at IS NOT NULL
        GROUP BY c.id
        HAVING earliest_review < c.created_at
    `);

    const createdAtData = getQueryResult(createdAtResult);
    if (createdAtData && createdAtData.values.length > 0) {
        console.log(`[Episteme] Found ${createdAtData.values.length} cards with corrupted created_at`);

        for (const row of createdAtData.values) {
            const cardId = row[0] as string;
            const earliestReview = row[2] as number;

            db.run(
                `UPDATE cards SET created_at = ? WHERE id = ?`,
                [earliestReview, cardId]
            );
        }

        console.log(`[Episteme] Fixed created_at for ${createdAtData.values.length} cards`);
    } else {
        console.log("[Episteme] No cards with corrupted created_at found");
    }

    // Fix state for cards that have reviews but are marked as New
    const stateResult = db.exec(`
        SELECT c.id,
               (SELECT rating FROM review_log WHERE card_id = c.id ORDER BY reviewed_at DESC LIMIT 1) as last_rating
        FROM cards c
        WHERE c.state = 0
          AND EXISTS (SELECT 1 FROM review_log WHERE card_id = c.id)
    `);

    const stateData = getQueryResult(stateResult);
    if (stateData && stateData.values.length > 0) {
        console.log(`[Episteme] Found ${stateData.values.length} cards with corrupted state (New with reviews)`);

        for (const row of stateData.values) {
            const cardId = row[0] as string;
            const lastRating = row[1] as number;
            const newState = (lastRating <= 2) ? 3 : 2;

            db.run(
                `UPDATE cards SET state = ? WHERE id = ?`,
                [newState, cardId]
            );
        }

        console.log(`[Episteme] Fixed state for ${stateData.values.length} cards`);
    } else {
        console.log("[Episteme] No cards with corrupted state found");
    }

    db.exec(`
        INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '6');
    `);
    console.log("[Episteme] Schema migration v5->v6 completed");
}
