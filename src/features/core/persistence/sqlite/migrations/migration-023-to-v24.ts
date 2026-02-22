/**
 * Migration v23 -> v24
 * Add created_via column to track card creation source (manual, ai, anki_import)
 */
import type { DatabaseLike } from "@features/core/persistence/sqlite/sqlite.types";

export function migration023ToV24(db: DatabaseLike): void {
	db.run(`ALTER TABLE cards ADD COLUMN created_via TEXT DEFAULT 'manual'`);

	db.run(`UPDATE meta SET value = '24' WHERE key = 'schema_version'`);
}
