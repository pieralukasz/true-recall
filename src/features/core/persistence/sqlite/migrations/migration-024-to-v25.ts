import type { DatabaseLike } from "@features/core/persistence/sqlite/sqlite.types";

export function migration024ToV25(db: DatabaseLike): void {
	db.run(`ALTER TABLE cards ADD COLUMN source_text TEXT`);
	db.run(`UPDATE meta SET value = '25' WHERE key = 'schema_version'`);
}
