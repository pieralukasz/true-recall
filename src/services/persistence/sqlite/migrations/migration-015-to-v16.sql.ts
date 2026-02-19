/**
 * Migration V15 -> V16
 * Remove projects table - projects are now exclusively in frontmatter YAML
 */
import type { DatabaseLike } from "../sqlite.types";

export function migrate(db: DatabaseLike): void {
	// Drop projects table (data is now in frontmatter only)
	db.exec("DROP TABLE IF EXISTS projects");

	// Update schema version
	db.run(
		`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '16')`,
	);
}
