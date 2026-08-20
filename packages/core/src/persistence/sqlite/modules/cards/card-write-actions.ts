import { FLASHCARD_CONFIG } from "../../../../constants";
import {
	DatabaseError,
	NotFoundError,
	ValidationError,
} from "../../../../errors";
import type { FSRSCardData } from "../../../../types";
import {
	BUILTIN_BASIC_REVERSED_ID,
	BUILTIN_IMAGE_OCCLUSION_ID,
} from "../../../../types/note.types";
import type { SqliteDatabase } from "../../SqliteDatabase";
import { resolveNoteMapping } from "./card-sql";

export class CardWriteActions {
	constructor(private db: SqliteDatabase) {}

	set(cardId: string, data: FSRSCardData): void {
		const now = Date.now();
		const existing = this.db.get<{ created_at: number | null }>(
			`SELECT created_at FROM cards WHERE id = ?`,
			[cardId],
		);
		const createdAt = data.createdAt ?? existing?.created_at ?? now;

		const { noteTypeId, fieldsJson, templateOrd } = resolveNoteMapping(data);

		let noteId = data.noteId;

		// Reversed cards share the original card's note (different template_ord)
		if (!noteId && data.cardType === "reversed" && data.reverseOf) {
			const orig = this.db.get<{ note_id: string }>(
				`SELECT note_id FROM cards WHERE id = ? AND deleted_at IS NULL`,
				[data.reverseOf],
			);
			if (orig) {
				noteId = orig.note_id;
				// Upgrade note type to basic-reversed so both templates are available
				this.db.run(
					`UPDATE notes SET note_type_id = ?, updated_at = ? WHERE id = ?`,
					[BUILTIN_BASIC_REVERSED_ID, now, noteId],
				);
			}
		}

		if (!noteId) {
			noteId = crypto.randomUUID();
			const noteTags = data.alwaysTypeIn
				? FLASHCARD_CONFIG.alwaysTypeInTag
				: "";
			this.db.run(
				`INSERT OR IGNORE INTO notes (id, note_type_id, fields_json, tags, source_uid, source_text, created_via, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					noteId,
					noteTypeId,
					fieldsJson,
					noteTags,
					data.sourceUid ?? null,
					data.sourceText ?? null,
					data.createdVia ?? null,
					now,
					now,
				],
			);
		}
		// Use UPSERT (INSERT … ON CONFLICT DO UPDATE) instead of INSERT OR REPLACE.
		// REPLACE deletes the existing row before inserting the new one, which
		// triggers ON DELETE CASCADE on review_log and wipes the card's review
		// history on every scheduling update.
		this.db.run(
			`INSERT INTO cards (
                    id, note_id, template_ord, due, stability, difficulty,
                    reps, lapses, state, last_review, scheduled_days,
                    learning_step, suspended, buried_until,
                    created_at, updated_at, source_uid
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    note_id = excluded.note_id,
                    template_ord = excluded.template_ord,
                    due = excluded.due,
                    stability = excluded.stability,
                    difficulty = excluded.difficulty,
                    reps = excluded.reps,
                    lapses = excluded.lapses,
                    state = excluded.state,
                    last_review = excluded.last_review,
                    scheduled_days = excluded.scheduled_days,
                    learning_step = excluded.learning_step,
                    suspended = excluded.suspended,
                    buried_until = excluded.buried_until,
                    updated_at = excluded.updated_at,
                    source_uid = excluded.source_uid`,
			[
				cardId,
				noteId,
				templateOrd,
				data.due,
				data.stability,
				data.difficulty,
				data.reps,
				data.lapses,
				data.state,
				data.lastReview ?? null,
				data.scheduledDays,
				data.learningStep,
				data.suspended ? 1 : 0,
				data.buriedUntil ?? null,
				createdAt,
				now,
				data.sourceUid ?? null,
			],
		);
	}

	updateCardContent(cardId: string, question: string, answer: string): void {
		const card = this.db.get<{
			note_id: string;
			note_type_id: string;
			template_ord: number;
		}>(
			`SELECT c.note_id, n.note_type_id, c.template_ord
			 FROM cards c
			 JOIN notes n ON c.note_id = n.id
			 WHERE c.id = ?`,
			[cardId],
		);
		if (!card) throw new NotFoundError("Card", cardId);
		if (card.note_type_id === BUILTIN_IMAGE_OCCLUSION_ID) {
			throw new ValidationError(
				"Image occlusion cards must be edited in the image occlusion editor.",
			);
		}
		// A reversed sibling (template_ord 1) renders question=Back and
		// answer=Front, so its edits must be written back in note orientation —
		// both cards of a reversed pair share this one note.
		const [front, back] =
			card.template_ord === 1 ? [answer, question] : [question, answer];
		this.db.run(
			`UPDATE notes SET fields_json = ?, updated_at = ? WHERE id = ?`,
			[JSON.stringify({ Front: front, Back: back }), Date.now(), card.note_id],
		);
	}

	updateClozeCardContent(
		cardId: string,
		_question: string,
		_answer: string,
		clozeTemplate: string,
	): void {
		const card = this.db.get<{ note_id: string }>(
			`SELECT note_id FROM cards WHERE id = ?`,
			[cardId],
		);
		if (!card) throw new NotFoundError("Card", cardId);
		const note = this.db.get<{ fields_json: string }>(
			`SELECT fields_json FROM notes WHERE id = ?`,
			[card.note_id],
		);
		let fields: Record<string, string>;
		try {
			fields = note
				? (JSON.parse(note.fields_json) as Record<string, string>)
				: {};
		} catch {
			throw new DatabaseError(
				`Corrupt fields JSON for card ${cardId}`,
				"card:parse",
			);
		}
		fields.Text = clozeTemplate;
		this.db.run(
			`UPDATE notes SET fields_json = ?, updated_at = ? WHERE id = ?`,
			[JSON.stringify(fields), Date.now(), card.note_id],
		);
	}

	upsertFromRemote(
		data: FSRSCardData & { updatedAt?: number; deletedAt?: number | null },
	): boolean {
		const now = Date.now();

		// LWW: skip if local version is newer or equal
		const existing = this.db.get<{ updated_at: number }>(
			`SELECT updated_at FROM cards WHERE id = ?`,
			[data.id],
		);
		if (existing && existing.updated_at >= (data.updatedAt ?? 0)) {
			return false;
		}

		const { noteTypeId, fieldsJson, templateOrd } = resolveNoteMapping(data);

		let noteId = data.noteId;
		if (!noteId) {
			noteId = crypto.randomUUID();
			const noteTags = data.alwaysTypeIn
				? FLASHCARD_CONFIG.alwaysTypeInTag
				: "";
			this.db.run(
				`INSERT OR IGNORE INTO notes (id, note_type_id, fields_json, tags, source_uid, source_text, created_via, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					noteId,
					noteTypeId,
					fieldsJson,
					noteTags,
					data.sourceUid ?? null,
					data.sourceText ?? null,
					data.createdVia ?? null,
					now,
					now,
				],
			);
		}
		// Use UPSERT instead of INSERT OR REPLACE — see comment in set() for why.
		this.db.run(
			`INSERT INTO cards (
                    id, note_id, template_ord, due, stability, difficulty,
                    reps, lapses, state, last_review, scheduled_days,
                    learning_step, suspended, buried_until,
                    created_at, updated_at, deleted_at, source_uid
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    note_id = excluded.note_id,
                    template_ord = excluded.template_ord,
                    due = excluded.due,
                    stability = excluded.stability,
                    difficulty = excluded.difficulty,
                    reps = excluded.reps,
                    lapses = excluded.lapses,
                    state = excluded.state,
                    last_review = excluded.last_review,
                    scheduled_days = excluded.scheduled_days,
                    learning_step = excluded.learning_step,
                    suspended = excluded.suspended,
                    buried_until = excluded.buried_until,
                    updated_at = excluded.updated_at,
                    deleted_at = excluded.deleted_at,
                    source_uid = excluded.source_uid`,
			[
				data.id,
				noteId,
				templateOrd,
				data.due,
				data.stability,
				data.difficulty,
				data.reps,
				data.lapses,
				data.state,
				data.lastReview ?? null,
				data.scheduledDays,
				data.learningStep,
				data.suspended ? 1 : 0,
				data.buriedUntil ?? null,
				data.createdAt ?? now,
				data.updatedAt ?? now,
				data.deletedAt ?? null,
				data.sourceUid ?? null,
			],
		);
		return true;
	}

	softDelete(cardId: string): void {
		const now = Date.now();
		this.db.run(
			`UPDATE cards SET deleted_at = ?, updated_at = ? WHERE id = ?`,
			[now, now, cardId],
		);
	}

	updateCardSourceUid(cardId: string, sourceUid: string): void {
		this.db.run(
			`UPDATE cards SET source_uid = ?, updated_at = ? WHERE id = ?`,
			[sourceUid, Date.now(), cardId],
		);
	}

	softDeleteWithCascade(cardId: string): void {
		const now = Date.now();
		this.db.transaction(() => {
			this.db.run(
				`UPDATE cards SET deleted_at = ?, updated_at = ? WHERE id = ?`,
				[now, now, cardId],
			);
			// Only stamp live rows: individually tombstoned review entries must
			// keep their original deleted_at so restoreWithCascade cannot revive
			// them alongside the cascade.
			this.db.run(
				`UPDATE review_log SET deleted_at = ?, updated_at = ? WHERE card_id = ? AND deleted_at IS NULL`,
				[now, now, cardId],
			);
		});
	}

	/** Reverse of {@link softDeleteWithCascade} for undo support: revives the
	 * card together with the review_log rows tombstoned by the same cascade
	 * (matched via the shared deleted_at stamp). Individually tombstoned review
	 * entries keep their tombstone — sync replay must keep ignoring them. */
	restoreWithCascade(cardId: string): void {
		const row = this.db.get<{ deleted_at: number | null }>(
			`SELECT deleted_at FROM cards WHERE id = ?`,
			[cardId],
		);
		if (!row?.deleted_at) return;
		const now = Date.now();
		this.db.transaction(() => {
			this.db.run(
				`UPDATE review_log SET deleted_at = NULL, updated_at = ? WHERE card_id = ? AND deleted_at = ?`,
				[now, cardId, row.deleted_at],
			);
			this.db.run(
				`UPDATE cards SET deleted_at = NULL, updated_at = ? WHERE id = ?`,
				[now, cardId],
			);
		});
	}

	updateCardDue(cardId: string, newDue: string): void {
		this.db.run(`UPDATE cards SET due = ?, updated_at = ? WHERE id = ?`, [
			newDue,
			Date.now(),
			cardId,
		]);
	}

	updateCardScheduling(
		cardId: string,
		data: { due: string; scheduledDays: number },
	): void {
		this.db.run(
			`UPDATE cards SET due = ?, scheduled_days = ?, updated_at = ? WHERE id = ?`,
			[data.due, data.scheduledDays, Date.now(), cardId],
		);
	}

	// ── Sync ──────────────────────────────────────────────────

	/**
	 * Write the scheduling state produced by an FSRS replay after a
	 * device-sync conflict. Touches only replay-derived fields; suspension,
	 * bury, deletion, and note linkage keep whatever the row-level merge chose.
	 */
	applyReplayedScheduling(cardId: string, data: FSRSCardData): void {
		this.db.run(
			`UPDATE cards SET
                due = ?,
                stability = ?,
                difficulty = ?,
                reps = ?,
                lapses = ?,
                state = ?,
                last_review = ?,
                scheduled_days = ?,
                learning_step = ?,
                updated_at = ?
             WHERE id = ? AND deleted_at IS NULL`,
			[
				data.due,
				data.stability,
				data.difficulty,
				data.reps,
				data.lapses,
				data.state,
				data.lastReview ?? null,
				data.scheduledDays,
				data.learningStep,
				Date.now(),
				cardId,
			],
		);
	}

	getSyncMetadata(key: string): string | null {
		const row = this.db.get<{ value: string }>(
			`SELECT value FROM meta WHERE key = ?`,
			[key],
		);
		return row?.value ?? null;
	}

	setSyncMetadata(key: string, value: string): void {
		this.db.run(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`, [
			key,
			value,
		]);
	}

	deleteAllForSync(): void {
		this.db.run(`DELETE FROM cards`);
	}
}
