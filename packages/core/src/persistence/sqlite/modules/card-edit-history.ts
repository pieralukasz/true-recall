import type { NoteEditSource } from "../../../types/note.types";
import type { SqliteDatabase } from "../SqliteDatabase";
import type { DatabaseLike } from "../sqlite.types";

export const CARD_EDIT_HISTORY_RETENTION = {
	perNote: 50,
	global: 10_000,
	maxAgeDays: 90,
} as const;

export function historyCutoff(now: number): number {
	return now - CARD_EDIT_HISTORY_RETENTION.maxAgeDays * 24 * 60 * 60 * 1000;
}

export function pruneCardEditHistory(
	db: Pick<DatabaseLike, "run">,
	now: number,
): void {
	db.run("DELETE FROM card_edit_history WHERE edited_at < ?", [
		historyCutoff(now),
	]);
	db.run(
		`DELETE FROM card_edit_history WHERE sequence IN (
  SELECT sequence FROM card_edit_history ORDER BY edited_at DESC, sequence DESC LIMIT -1 OFFSET ?
 )`,
		[CARD_EDIT_HISTORY_RETENTION.global],
	);
}

/** Local-only additive schema; not part of the device/cloud row sync contract. */
export function createCardEditHistorySchema(db: DatabaseLike): void {
	db.run(`CREATE TABLE IF NOT EXISTS card_edit_history (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  note_id TEXT NOT NULL,
  edited_at INTEGER NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('manual','ai','system')),
  device_id TEXT,
  source_uid TEXT,
  before_fields_json TEXT NOT NULL,
  after_fields_json TEXT NOT NULL,
  before_note_type_json TEXT NOT NULL,
  after_note_type_json TEXT NOT NULL
 );
 CREATE INDEX IF NOT EXISTS idx_card_edits_note_time ON card_edit_history(note_id, edited_at DESC, sequence DESC);
 CREATE INDEX IF NOT EXISTS idx_card_edits_time ON card_edit_history(edited_at DESC, sequence DESC);
 CREATE INDEX IF NOT EXISTS idx_card_edits_source_time ON card_edit_history(source, edited_at DESC, sequence DESC);
 CREATE INDEX IF NOT EXISTS idx_card_edits_uid_time ON card_edit_history(source_uid, edited_at DESC, sequence DESC);`);
	db.run(
		`INSERT OR IGNORE INTO meta(key,value) VALUES ('card_edit_history_started_at','${Date.now()}')`,
	);
	pruneCardEditHistory(db, Date.now());
}

function snapshot(db: SqliteDatabase, noteId: string) {
	return db.get<{
		fields_json: string;
		source_uid: string | null;
		note_type_id: string;
		name: string;
		type: number;
		templates_json: string;
	}>(
		`SELECT n.fields_json, n.source_uid, n.note_type_id, t.name, t.type, t.templates_json
   FROM notes n JOIN note_types t ON t.id=n.note_type_id WHERE n.id=?`,
		[noteId],
	);
}

/** Snapshot and write share a transaction, including existing outer command transactions. */
export function recordContentEdit(
	db: SqliteDatabase,
	noteId: string,
	source: NoteEditSource,
	now: number,
	write: () => void,
): void {
	db.transaction(() => {
		const before = snapshot(db, noteId);
		write();
		const after = snapshot(db, noteId);
		if (!before || !after || before.fields_json === after.fields_json) return;
		db.run(
			`INSERT INTO card_edit_history(id,note_id,edited_at,source,device_id,source_uid,before_fields_json,after_fields_json,before_note_type_json,after_note_type_json)
   VALUES (?,?,?,?,?,?,?,?,?,?)`,
			[
				crypto.randomUUID(),
				noteId,
				now,
				source,
				db.deviceId ?? null,
				after.source_uid,
				before.fields_json,
				after.fields_json,
				JSON.stringify({
					note_type_id: before.note_type_id,
					name: before.name,
					type: before.type,
					templates_json: before.templates_json,
				}),
				JSON.stringify({
					note_type_id: after.note_type_id,
					name: after.name,
					type: after.type,
					templates_json: after.templates_json,
				}),
			],
		);
		db.run(
			`DELETE FROM card_edit_history WHERE sequence IN (
   SELECT sequence FROM card_edit_history WHERE note_id=?
   ORDER BY edited_at DESC, sequence DESC LIMIT -1 OFFSET ?
  )`,
			[noteId, CARD_EDIT_HISTORY_RETENTION.perNote],
		);
		pruneCardEditHistory(db, now);
	});
}
