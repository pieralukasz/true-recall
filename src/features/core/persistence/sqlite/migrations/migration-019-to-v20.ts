/**
 * Migration v19 -> v20
 * Add composite indexes for common query patterns
 */
import type { DatabaseLike } from "@features/core/persistence/sqlite/sqlite.types";

export function migration019ToV20(db: DatabaseLike): void {
	// Add composite indexes for cards table
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_cards_active ON cards(deleted_at, suspended, state)`,
	);
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_cards_due_active ON cards(due, deleted_at, suspended)`,
	);

	// Add composite index for review_log table
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_revlog_card_active ON review_log(card_id, deleted_at)`,
	);

	db.run(`UPDATE meta SET value = '20' WHERE key = 'schema_version'`);
}
