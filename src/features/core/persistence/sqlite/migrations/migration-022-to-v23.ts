/**
 * Migration v22 -> v23
 * Add image occlusion columns: io_image_path, io_regions_json, io_group_key, io_parent_id
 */
import type { DatabaseLike } from "@features/core/persistence/sqlite/sqlite.types";

export function migration022ToV23(db: DatabaseLike): void {
	db.run(`ALTER TABLE cards ADD COLUMN io_image_path TEXT`);
	db.run(`ALTER TABLE cards ADD COLUMN io_regions_json TEXT`);
	db.run(`ALTER TABLE cards ADD COLUMN io_group_key TEXT`);
	db.run(`ALTER TABLE cards ADD COLUMN io_parent_id TEXT`);

	db.run(
		`CREATE INDEX IF NOT EXISTS idx_cards_io_parent ON cards(io_parent_id)`,
	);

	db.run(`UPDATE meta SET value = '23' WHERE key = 'schema_version'`);
}
