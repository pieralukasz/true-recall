/**
 * Migration v21 -> v22
 * Add preset_name column to review_log for per-preset FSRS optimization
 */
import type { DatabaseLike } from "../sqlite.types";

export function migration021ToV22(db: DatabaseLike): void {
	db.run(`ALTER TABLE review_log ADD COLUMN preset_name TEXT`);
	db.run(`CREATE INDEX IF NOT EXISTS idx_revlog_preset ON review_log(preset_name)`);
	db.run(`UPDATE meta SET value = '22' WHERE key = 'schema_version'`);
}
