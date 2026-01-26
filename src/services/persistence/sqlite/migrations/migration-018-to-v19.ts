/**
 * Migration v18 -> v19
 * Delete review_log entries with invalid reviewed_at values
 *
 * Root cause: mapRemoteReviewLogToLocal() didn't validate timestamps from Supabase,
 * allowing invalid dates (0, null, epoch) to be stored as "1970-01-01T..." or "Invalid Date".
 */
import type { DatabaseLike } from "../sqlite.types";

export function migration018ToV19(db: DatabaseLike): void {
	// Delete records with invalid reviewed_at (NULL, empty, or non-ISO format)
	db.run(`
		DELETE FROM review_log
		WHERE reviewed_at IS NULL
		   OR reviewed_at = ''
		   OR reviewed_at NOT LIKE '____-__-__T%'
	`);

	db.run(`UPDATE meta SET value = '19' WHERE key = 'schema_version'`);
}
