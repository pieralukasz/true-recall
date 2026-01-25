/**
 * Migration v17 -> v18
 * Remove card_image_refs table
 *
 * Rationale: Obsidian natively manages attachments. Tracking image references
 * in a separate table adds fragility without benefit - images are already
 * embedded in card content (question/answer fields) as markdown links.
 */
import type { DatabaseLike } from "../sqlite.types";

export function migration017ToV18(db: DatabaseLike): void {
	// Drop card_image_refs table (indexes are dropped automatically)
	db.run(`DROP TABLE IF EXISTS card_image_refs`);

	// Update schema version
	db.run(`UPDATE meta SET value = '18' WHERE key = 'schema_version'`);
}
