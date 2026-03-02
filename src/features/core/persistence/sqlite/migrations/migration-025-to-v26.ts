/**
 * Migration v25 → v26: Note Types
 *
 * Creates note_types and notes tables, migrates existing cards
 * to use notes as their data source (removes question/answer from cards).
 */
import type { DatabaseLike } from "@features/core/persistence/sqlite/sqlite.types";

export function migration025ToV26(_db: DatabaseLike): void {
	throw new Error("Not implemented");
}
