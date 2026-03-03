/**
 * Migration v25 → v26: Note Types
 *
 * Creates note_types and notes tables, migrates existing cards
 * to use notes as their data source (removes question/answer from cards).
 */
import type {
	BindParams,
	DatabaseLike,
	QueryExecResult,
} from "@features/core/persistence/sqlite/loader";
import { getBuiltinNoteTypes } from "@features/core/persistence/sqlite/modules/NoteTypeActions";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_BASIC_REVERSED_ID,
	BUILTIN_CLOZE_ID,
	BUILTIN_IMAGE_OCCLUSION_ID,
} from "@shared/types/note.types";

function queryAll(
	db: DatabaseLike,
	sql: string,
	params?: BindParams,
): Record<string, unknown>[] {
	const result: QueryExecResult[] = db.exec(sql, params);
	if (result.length === 0) return [];
	const first = result[0]!;
	return first.values.map((row) => {
		const obj: Record<string, unknown> = {};
		first.columns.forEach((col, i) => {
			obj[col] = row[i];
		});
		return obj;
	});
}

export function migration025ToV26(db: DatabaseLike): void {
	// 1. Create note_types table
	db.run(`
		CREATE TABLE IF NOT EXISTS note_types (
			id TEXT PRIMARY KEY NOT NULL,
			name TEXT NOT NULL,
			type INTEGER NOT NULL DEFAULT 0,
			fields_json TEXT NOT NULL,
			templates_json TEXT NOT NULL,
			css TEXT DEFAULT '',
			is_builtin INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER,
			updated_at INTEGER,
			deleted_at INTEGER DEFAULT NULL
		)
	`);

	// 2. Create notes table
	db.run(`
		CREATE TABLE IF NOT EXISTS notes (
			id TEXT PRIMARY KEY NOT NULL,
			note_type_id TEXT NOT NULL,
			fields_json TEXT NOT NULL,
			tags TEXT DEFAULT '',
			source_uid TEXT,
			source_text TEXT,
			created_via TEXT DEFAULT 'manual',
			created_at INTEGER,
			updated_at INTEGER,
			deleted_at INTEGER DEFAULT NULL,
			FOREIGN KEY (note_type_id) REFERENCES note_types(id)
		)
	`);

	// 3. Seed 4 built-in note types
	const builtins = getBuiltinNoteTypes();
	for (const nt of builtins) {
		db.run(
			`INSERT OR IGNORE INTO note_types (id, name, type, fields_json, templates_json, css, is_builtin, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
			[
				nt.id,
				nt.name,
				nt.type,
				JSON.stringify(nt.fields),
				JSON.stringify(nt.templates),
				nt.css,
				Date.now(),
				Date.now(),
			],
		);
	}

	// 4. Add temporary mapping columns to old cards table
	db.run(`ALTER TABLE cards ADD COLUMN note_id TEXT`);
	db.run(`ALTER TABLE cards ADD COLUMN template_ord INTEGER DEFAULT 0`);

	const now = Date.now();

	// 5. Process reversed pairs first
	migrateReversedPairs(db, now);

	// 6. Process cloze groups
	migrateClozeCards(db, now);

	// 7. Process image-occlusion groups
	migrateIOCards(db, now);

	// 8. Process remaining cards as basic
	migrateBasicCards(db, now);

	// 9. Recreate cards table without old columns (rename-create-copy-drop)
	db.run(`ALTER TABLE cards RENAME TO cards_old`);

	db.run(`
		CREATE TABLE cards (
			id TEXT PRIMARY KEY NOT NULL,
			note_id TEXT NOT NULL,
			template_ord INTEGER NOT NULL DEFAULT 0,
			due TEXT NOT NULL,
			stability REAL DEFAULT 0,
			difficulty REAL DEFAULT 0,
			reps INTEGER DEFAULT 0,
			lapses INTEGER DEFAULT 0,
			state INTEGER DEFAULT 0,
			last_review TEXT,
			scheduled_days INTEGER DEFAULT 0,
			learning_step INTEGER DEFAULT 0,
			suspended INTEGER DEFAULT 0,
			buried_until TEXT,
			created_at INTEGER,
			updated_at INTEGER,
			deleted_at INTEGER DEFAULT NULL,
			source_uid TEXT,
			FOREIGN KEY (note_id) REFERENCES notes(id)
		)
	`);

	db.run(`
		INSERT INTO cards (
			id, note_id, template_ord, due, stability, difficulty,
			reps, lapses, state, last_review, scheduled_days,
			learning_step, suspended, buried_until,
			created_at, updated_at, deleted_at, source_uid
		)
		SELECT
			id, note_id, template_ord, due, stability, difficulty,
			reps, lapses, state, last_review, scheduled_days,
			learning_step, suspended, buried_until,
			created_at, updated_at, deleted_at, source_uid
		FROM cards_old
	`);

	db.run(`DROP TABLE cards_old`);

	// 10. Create indexes
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_notes_note_type ON notes(note_type_id)`,
	);
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_notes_source_uid ON notes(source_uid)`,
	);
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes(deleted_at)`,
	);
	db.run(`CREATE INDEX IF NOT EXISTS idx_cards_note_id ON cards(note_id)`);
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_cards_note_template ON cards(note_id, template_ord)`,
	);
	db.run(`CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(due)`);
	db.run(`CREATE INDEX IF NOT EXISTS idx_cards_state ON cards(state)`);
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_cards_source_uid ON cards(source_uid)`,
	);
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_cards_deleted ON cards(deleted_at)`,
	);

	// 11. Update schema version
	db.run(
		`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '26')`,
	);
}

/**
 * Migrate reversed pairs: find cards with card_type='reversed' and reverse_of
 * pointing to an existing card. Create 1 note per pair.
 */
function migrateReversedPairs(db: DatabaseLike, now: number): void {
	const reversedCards = queryAll(
		db,
		`SELECT id, reverse_of, question, answer, source_uid, source_text, created_via, created_at
		 FROM cards WHERE card_type = 'reversed' AND reverse_of IS NOT NULL`,
	);

	for (const rev of reversedCards) {
		const origId = rev.reverse_of as string;

		// Check if original card exists
		const originals = queryAll(
			db,
			`SELECT id, question, answer, source_uid, source_text, created_via, created_at
			 FROM cards WHERE id = ?`,
			[origId],
		);

		if (originals.length === 0) {
			// Orphan — will be processed as basic later
			continue;
		}

		const orig = originals[0]!;

		// Check if original already has a note_id (already processed)
		const origMapping = queryAll(
			db,
			`SELECT note_id FROM cards WHERE id = ? AND note_id IS NOT NULL`,
			[origId],
		);
		if (origMapping.length > 0) {
			// Original already part of another pair — process reversed as basic
			continue;
		}

		// Create a reversed-pair note using original's question/answer
		const noteId = crypto.randomUUID();
		db.run(
			`INSERT INTO notes (id, note_type_id, fields_json, tags, source_uid, source_text, created_via, created_at, updated_at)
			 VALUES (?, ?, ?, '', ?, ?, ?, ?, ?)`,
			[
				noteId,
				BUILTIN_BASIC_REVERSED_ID,
				JSON.stringify({
					Front: (orig.question as string) ?? "",
					Back: (orig.answer as string) ?? "",
				}),
				(orig.source_uid as string) ?? null,
				(orig.source_text as string) ?? null,
				(orig.created_via as string) ?? "manual",
				(orig.created_at as number) ?? now,
				now,
			],
		);

		// Map original → template_ord=0, reversed → template_ord=1
		db.run(`UPDATE cards SET note_id = ?, template_ord = 0 WHERE id = ?`, [
			noteId,
			origId,
		]);
		db.run(`UPDATE cards SET note_id = ?, template_ord = 1 WHERE id = ?`, [
			noteId,
			rev.id as string,
		]);
	}
}

/**
 * Migrate cloze cards: group by cloze_template, create 1 note per group.
 */
function migrateClozeCards(db: DatabaseLike, now: number): void {
	const clozeCards = queryAll(
		db,
		`SELECT id, cloze_template, cloze_index, source_uid, source_text, created_via, created_at
		 FROM cards WHERE card_type = 'cloze' AND note_id IS NULL
		 ORDER BY cloze_template, cloze_index`,
	);

	// Group by cloze_template
	const groups = new Map<
		string,
		Array<Record<string, unknown>>
	>();
	for (const card of clozeCards) {
		const key = (card.cloze_template as string) ?? "";
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key)!.push(card);
	}

	for (const [template, cards] of groups) {
		const first = cards[0]!;
		const noteId = crypto.randomUUID();

		db.run(
			`INSERT INTO notes (id, note_type_id, fields_json, tags, source_uid, source_text, created_via, created_at, updated_at)
			 VALUES (?, ?, ?, '', ?, ?, ?, ?, ?)`,
			[
				noteId,
				BUILTIN_CLOZE_ID,
				JSON.stringify({ Text: template, Extra: "" }),
				(first.source_uid as string) ?? null,
				(first.source_text as string) ?? null,
				(first.created_via as string) ?? "manual",
				(first.created_at as number) ?? now,
				now,
			],
		);

		for (const card of cards) {
			const templateOrd = (card.cloze_index as number) ?? 0;
			db.run(
				`UPDATE cards SET note_id = ?, template_ord = ? WHERE id = ?`,
				[noteId, templateOrd, card.id as string],
			);
		}
	}
}

/**
 * Migrate image-occlusion cards: group by io_parent_id, create 1 note per group.
 */
function migrateIOCards(db: DatabaseLike, now: number): void {
	// Find IO parent cards (have io_image_path, no io_parent_id)
	const parents = queryAll(
		db,
		`SELECT id, io_image_path, io_regions_json, source_uid, source_text, created_via, created_at
		 FROM cards WHERE card_type = 'image-occlusion' AND io_parent_id IS NULL AND note_id IS NULL`,
	);

	for (const parent of parents) {
		const parentId = parent.id as string;
		const noteId = crypto.randomUUID();

		db.run(
			`INSERT INTO notes (id, note_type_id, fields_json, tags, source_uid, source_text, created_via, created_at, updated_at)
			 VALUES (?, ?, ?, '', ?, ?, ?, ?, ?)`,
			[
				noteId,
				BUILTIN_IMAGE_OCCLUSION_ID,
				JSON.stringify({
					Image: (parent.io_image_path as string) ?? "",
					Regions: (parent.io_regions_json as string) ?? "",
				}),
				(parent.source_uid as string) ?? null,
				(parent.source_text as string) ?? null,
				(parent.created_via as string) ?? "manual",
				(parent.created_at as number) ?? now,
				now,
			],
		);

		// Parent → template_ord=0
		db.run(
			`UPDATE cards SET note_id = ?, template_ord = 0 WHERE id = ?`,
			[noteId, parentId],
		);

		// Children → template_ord = 1, 2, 3...
		const children = queryAll(
			db,
			`SELECT id, io_group_key FROM cards WHERE io_parent_id = ? AND note_id IS NULL ORDER BY io_group_key`,
			[parentId],
		);

		for (let i = 0; i < children.length; i++) {
			db.run(
				`UPDATE cards SET note_id = ?, template_ord = ? WHERE id = ?`,
				[noteId, i + 1, children[i]!.id as string],
			);
		}
	}
}

/**
 * Migrate remaining cards (no note_id yet) as basic 1:1 notes.
 * Includes: regular basic cards, orphaned reversed cards, orphaned IO children.
 */
function migrateBasicCards(db: DatabaseLike, now: number): void {
	const remaining = queryAll(
		db,
		`SELECT id, question, answer, source_uid, source_text, created_via, created_at
		 FROM cards WHERE note_id IS NULL`,
	);

	for (const card of remaining) {
		const noteId = crypto.randomUUID();

		db.run(
			`INSERT INTO notes (id, note_type_id, fields_json, tags, source_uid, source_text, created_via, created_at, updated_at)
			 VALUES (?, ?, ?, '', ?, ?, ?, ?, ?)`,
			[
				noteId,
				BUILTIN_BASIC_ID,
				JSON.stringify({
					Front: (card.question as string) ?? "",
					Back: (card.answer as string) ?? "",
				}),
				(card.source_uid as string) ?? null,
				(card.source_text as string) ?? null,
				(card.created_via as string) ?? "manual",
				(card.created_at as number) ?? now,
				now,
			],
		);

		db.run(
			`UPDATE cards SET note_id = ?, template_ord = 0 WHERE id = ?`,
			[noteId, card.id as string],
		);
	}
}
