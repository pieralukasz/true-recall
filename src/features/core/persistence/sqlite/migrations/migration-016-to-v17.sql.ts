/**
 * Migration V16 -> V17
 * Remove source_notes table - it serves only as sync registry
 * All source note metadata is resolved from vault at runtime via flashcard_uid
 */
import type { DatabaseLike } from "../sqlite.types";

export function migrate(db: DatabaseLike): void {
	// Drop source_notes table (no longer needed)
	db.exec("DROP TABLE IF EXISTS source_notes");

	// Update schema version
	db.run(
		`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '17')`,
	);
}
