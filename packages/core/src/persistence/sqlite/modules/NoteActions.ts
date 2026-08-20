/**
 * Note Actions Module
 * CRUD operations for notes table
 */

import type { Note } from "../../../types/note.types";
import type { SqliteDatabase } from "../SqliteDatabase";

interface NoteRow {
	id: string;
	note_type_id: string;
	fields_json: string;
	tags: string | null;
	source_uid: string | null;
	source_text: string | null;
	user_comment: string | null;
	created_via: string | null;
	created_at: number | null;
	updated_at: number | null;
	deleted_at: number | null;
}

function mapRowToNote(row: NoteRow): Note {
	return {
		id: row.id,
		noteTypeId: row.note_type_id,
		fields: JSON.parse(row.fields_json) as Record<string, string>,
		tags: row.tags ? row.tags.split(" ").filter(Boolean) : [],
		sourceUid: row.source_uid ?? undefined,
		sourceText: row.source_text ?? undefined,
		userComment: row.user_comment ?? undefined,
		createdVia: row.created_via ?? undefined,
		createdAt: row.created_at ?? undefined,
		updatedAt: row.updated_at ?? undefined,
	};
}

/** Escape user input for FTS5 MATCH — wraps in double quotes to treat as phrase */
export function escapeFts5Query(input: string): string {
	return `"${input.replace(/"/g, '""')}"`;
}

export class NoteActions {
	private fts5Available: boolean | null = null;

	constructor(private db: SqliteDatabase) {}

	isFts5Available(): boolean {
		if (this.fts5Available === null) {
			const row = this.db.get<{ value: string }>(
				`SELECT value FROM meta WHERE key = 'fts5_available'`,
			);
			this.fts5Available = row?.value === "1";
		}
		return this.fts5Available;
	}

	getById(id: string): Note | null {
		const row = this.db.get<NoteRow>(
			`SELECT * FROM notes WHERE id = ? AND deleted_at IS NULL`,
			[id],
		);
		return row ? mapRowToNote(row) : null;
	}

	// ── Device sync (raw rows, LWW by updated_at) ─────────────

	getRawRowsModifiedSince(timestamp: number): NoteRow[] {
		return this.db.query<NoteRow>(`SELECT * FROM notes WHERE updated_at > ?`, [
			timestamp,
		]);
	}

	getRawRowsByIds(ids: string[]): NoteRow[] {
		if (ids.length === 0) return [];
		const placeholders = ids.map(() => "?").join(",");
		return this.db.query<NoteRow>(
			`SELECT * FROM notes WHERE id IN (${placeholders})`,
			ids,
		);
	}

	hasRow(id: string): boolean {
		return (
			this.db.get<{ id: string }>(`SELECT id FROM notes WHERE id = ?`, [id]) !==
			null
		);
	}

	/** Last-writer-wins upsert of a remote device's note row. */
	upsertRowFromRemote(row: NoteRow): boolean {
		this.db.run(
			`INSERT INTO notes (id, note_type_id, fields_json, tags, source_uid, source_text, user_comment, created_via, created_at, updated_at, deleted_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET
				note_type_id = excluded.note_type_id,
				fields_json = excluded.fields_json,
				tags = excluded.tags,
				source_uid = excluded.source_uid,
				source_text = excluded.source_text,
				user_comment = excluded.user_comment,
				created_via = excluded.created_via,
				updated_at = excluded.updated_at,
				deleted_at = excluded.deleted_at
			 WHERE COALESCE(excluded.updated_at, 0) > COALESCE(notes.updated_at, 0)`,
			// `?? null` everywhere: rows read via SELECT * from an older remote
			// schema can be missing columns entirely, and undefined cannot bind.
			[
				row.id,
				row.note_type_id,
				row.fields_json,
				row.tags ?? null,
				row.source_uid ?? null,
				row.source_text ?? null,
				row.user_comment ?? null,
				row.created_via ?? null,
				row.created_at ?? null,
				row.updated_at ?? null,
				row.deleted_at ?? null,
			],
		);
		return this.db.getRowsModified() > 0;
	}

	getBySourceUid(sourceUid: string): Note[] {
		const rows = this.db.query<NoteRow>(
			`SELECT * FROM notes WHERE source_uid = ? AND deleted_at IS NULL`,
			[sourceUid],
		);
		return rows.map(mapRowToNote);
	}

	getByNoteTypeId(noteTypeId: string): Note[] {
		const rows = this.db.query<NoteRow>(
			`SELECT * FROM notes WHERE note_type_id = ? AND deleted_at IS NULL`,
			[noteTypeId],
		);
		return rows.map(mapRowToNote);
	}

	create(note: Note): void {
		const now = Date.now();
		this.db.run(
			`INSERT INTO notes (id, note_type_id, fields_json, tags, source_uid, source_text, user_comment, created_via, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				note.id,
				note.noteTypeId,
				JSON.stringify(note.fields),
				note.tags.join(" "),
				note.sourceUid ?? null,
				note.sourceText ?? null,
				note.userComment ?? null,
				note.createdVia ?? "manual",
				note.createdAt ?? now,
				note.updatedAt ?? now,
			],
		);
	}

	update(id: string, updates: Partial<Note>): void {
		const now = Date.now();
		const sets: string[] = [];
		const params: (string | number | null)[] = [];

		if (updates.noteTypeId !== undefined) {
			sets.push("note_type_id = ?");
			params.push(updates.noteTypeId);
		}
		if (updates.fields !== undefined) {
			sets.push("fields_json = ?");
			params.push(JSON.stringify(updates.fields));
		}
		if (updates.tags !== undefined) {
			sets.push("tags = ?");
			params.push(updates.tags.join(" "));
		}
		if (updates.sourceUid !== undefined) {
			sets.push("source_uid = ?");
			params.push(updates.sourceUid);
		}
		if (updates.sourceText !== undefined) {
			sets.push("source_text = ?");
			params.push(updates.sourceText);
		}
		if (updates.userComment !== undefined) {
			sets.push("user_comment = ?");
			params.push(updates.userComment || null);
		}
		if (updates.createdVia !== undefined) {
			sets.push("created_via = ?");
			params.push(updates.createdVia);
		}

		sets.push("updated_at = ?");
		params.push(now);
		params.push(id);

		this.db.run(`UPDATE notes SET ${sets.join(", ")} WHERE id = ?`, params);
	}

	delete(id: string): void {
		this.db.run(`UPDATE notes SET deleted_at = ? WHERE id = ?`, [
			Date.now(),
			id,
		]);
	}

	count(): number {
		const row = this.db.get<{ cnt: number }>(
			`SELECT COUNT(*) as cnt FROM notes WHERE deleted_at IS NULL`,
		);
		return row?.cnt ?? 0;
	}

	countByNoteType(noteTypeId: string): number {
		const row = this.db.get<{ cnt: number }>(
			`SELECT COUNT(*) as cnt FROM notes WHERE note_type_id = ? AND deleted_at IS NULL`,
			[noteTypeId],
		);
		return row?.cnt ?? 0;
	}

	search(query: string): Note[] {
		const rows = this.isFts5Available()
			? this.db.query<NoteRow>(
					`SELECT * FROM notes WHERE rowid IN (
						SELECT rowid FROM notes_fts WHERE notes_fts MATCH ?
					) AND deleted_at IS NULL`,
					[escapeFts5Query(query)],
				)
			: this.db.query<NoteRow>(
					`SELECT * FROM notes WHERE fields_json LIKE ? AND deleted_at IS NULL`,
					[`%${query}%`],
				);
		return rows.map(mapRowToNote);
	}
}
