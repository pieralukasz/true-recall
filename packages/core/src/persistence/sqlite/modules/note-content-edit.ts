import type { NoteEditSource } from "../../../types/note.types";
import type { SqliteDatabase } from "../SqliteDatabase";

/** Preserve stored serialization for a semantic no-op (field order is not content). */
export function fieldsJsonForEdit(
	db: SqliteDatabase,
	noteId: string,
	fieldsJson: string,
): string {
	const old = db.get<{ fields_json: string }>(
		"SELECT fields_json FROM notes WHERE id=?",
		[noteId],
	);
	if (!old) return fieldsJson;
	const before = JSON.parse(old.fields_json) as Record<string, string>;
	const after = JSON.parse(fieldsJson) as Record<string, string>;
	return Object.keys(before).length === Object.keys(after).length &&
		Object.keys(before).every(
			(key) => Object.hasOwn(after, key) && before[key] === after[key],
		)
		? old.fields_json
		: fieldsJson;
}

const COUNTER_COLUMN: Record<NoteEditSource, string | null> = {
	manual: "edit_count",
	ai: "ai_edit_count",
	system: null,
};

export interface ContentEditSet {
	/** SET assignments for the fields_json write, without a trailing comma. */
	clause: string;
	params: (string | number)[];
}

/**
 * Build the SET assignments for a write that rewrites a note's fields.
 *
 * The counters and the edit timestamp only move when the new fields differ from
 * the stored ones — the card editor persists on blur, so saving an untouched
 * field must not read as an edit. Comparing old against new inside a single
 * statement works because SQLite evaluates every right-hand side against the
 * pre-update row.
 *
 * Callers keep owning `updated_at`, which bumps on every write (device sync
 * compares it) regardless of whether the content actually changed.
 */
export function buildContentEditSet(
	fieldsJson: string,
	source: NoteEditSource,
	now: number,
): ContentEditSet {
	const parts = [
		"fields_json = ?",
		"content_edited_at = CASE WHEN fields_json <> ? THEN ? ELSE content_edited_at END",
	];
	const params: (string | number)[] = [fieldsJson, fieldsJson, now];

	const counter = COUNTER_COLUMN[source];
	if (counter) {
		parts.push(`${counter} = ${counter} + (fields_json <> ?)`);
		params.push(fieldsJson);
	}

	return { clause: parts.join(", "), params };
}
