/**
 * Migration v18 -> v19
 * Convert review_log.reviewed_at from bigint string to ISO format
 *
 * Root cause: Data synced from Supabase was stored as numeric strings (e.g., "1769021590000")
 * instead of being converted to ISO format (e.g., "2026-01-21T12:13:10.000Z").
 */
import type { DatabaseLike } from "../sqlite.types";

export function migration018ToV19(db: DatabaseLike): void {
	// Convert bigint timestamps (stored as numeric strings) to ISO format
	// SQLite datetime() returns "YYYY-MM-DD HH:MM:SS", we append 'Z' for ISO
	db.run(`
		UPDATE review_log
		SET reviewed_at = strftime('%Y-%m-%dT%H:%M:%SZ', CAST(reviewed_at AS INTEGER) / 1000, 'unixepoch')
		WHERE reviewed_at GLOB '[0-9]*'
		  AND length(reviewed_at) >= 13
	`);

	db.run(`UPDATE meta SET value = '19' WHERE key = 'schema_version'`);
}
