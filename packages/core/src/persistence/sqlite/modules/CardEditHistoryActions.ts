import { NotFoundError, ValidationError } from "../../../errors";
import { renderTemplate } from "../../../services/cards/template-engine";
import type { CardTemplate, NoteEditSource } from "../../../types/note.types";
import type { SqliteDatabase } from "../SqliteDatabase";
import { CardActions } from "./CardActions";
import {
	CARD_EDIT_HISTORY_RETENTION,
	historyCutoff,
} from "./card-edit-history";

export interface CardEditHistoryFilter {
	since?: number;
	until?: number;
	editSource?: NoteEditSource;
	sourceUid?: string;
	limit?: number;
	offset?: number;
}
interface EditRow {
	id: string;
	note_id: string;
	edited_at: number;
	source: NoteEditSource;
	device_id: string | null;
	source_uid: string | null;
	before_fields_json: string;
	after_fields_json: string;
	before_note_type_json: string;
	after_note_type_json: string;
}
interface TypeSnapshot {
	note_type_id: string;
	name: string;
	type: number;
	templates_json: string;
}

function renderHistorical(
	fields: Record<string, string>,
	snapshotJson: string,
	ordinal: number,
) {
	const type = JSON.parse(snapshotJson) as TypeSnapshot;
	const templates = JSON.parse(type.templates_json) as CardTemplate[];
	const template =
		type.type === 1
			? templates[0]
			: templates.find((t) => t.ordinal === ordinal);
	if (!template || type.note_type_id === "builtin-image-occlusion")
		return {
			supported: false as const,
			reason: "Historical rendering unsupported; fields are authoritative",
		};
	const context = { fields, clozeIndex: ordinal };
	return {
		supported: true as const,
		question: renderTemplate(template.qfmt, context),
		answer: renderTemplate(template.afmt, { ...context, frontSide: "" }),
	};
}

export class CardEditHistoryActions {
	constructor(private db: SqliteDatabase) {}

	forCard(cardId: string, filters: CardEditHistoryFilter = {}) {
		if (!cardId.trim()) throw new ValidationError("Missing card ID");
		const current = new CardActions(this.db).get(cardId);
		if (!current?.noteId) throw new NotFoundError("Card", cardId);
		return {
			...this.read(filters, current.noteId, cardId),
			cardId,
			noteId: current.noteId,
			sharedNoteHistory: true,
			current: { question: current.question, answer: current.answer },
			siblingCardIds: this.siblings(current.noteId).map((c) => c.id),
		};
	}

	list(filters: CardEditHistoryFilter = {}) {
		return this.read(filters);
	}

	private siblings(noteId: string) {
		return this.db.query<{ id: string; template_ord: number }>(
			"SELECT id,template_ord FROM cards WHERE note_id=? AND deleted_at IS NULL ORDER BY id",
			[noteId],
		);
	}

	private read(
		filters: CardEditHistoryFilter,
		noteId?: string,
		cardId?: string,
	) {
		const limit = filters.limit ?? 50,
			offset = filters.offset ?? 0;
		if (
			!Number.isSafeInteger(limit) ||
			limit < 1 ||
			limit > 200 ||
			!Number.isSafeInteger(offset) ||
			offset < 0
		)
			throw new ValidationError("Invalid history pagination");
		if (
			[filters.since, filters.until].some(
				(v) => v !== undefined && !Number.isSafeInteger(v),
			)
		)
			throw new ValidationError("Invalid history date");
		if (
			filters.since !== undefined &&
			filters.until !== undefined &&
			filters.until <= filters.since
		)
			throw new ValidationError("until must be later than since");
		if (
			filters.editSource !== undefined &&
			!["manual", "ai", "system"].includes(filters.editSource)
		)
			throw new ValidationError("Invalid edit source");
		const conditions = ["edited_at >= ?"];
		const params: (string | number)[] = [historyCutoff(Date.now())];
		for (const [clause, value] of [
			["note_id = ?", noteId],
			["edited_at >= ?", filters.since],
			["edited_at < ?", filters.until],
			["source = ?", filters.editSource],
			["source_uid = ?", filters.sourceUid],
		] as const) {
			if (value !== undefined) {
				conditions.push(clause);
				params.push(value);
			}
		}
		const where = conditions.join(" AND ");
		const total = this.db.get<{ total: number }>(
			`SELECT COUNT(*) total FROM card_edit_history WHERE ${where}`,
			params,
		)!.total;
		const rows = this.db.query<EditRow>(
			`SELECT * FROM card_edit_history WHERE ${where} ORDER BY edited_at DESC,sequence DESC LIMIT ? OFFSET ?`,
			[...params, limit, offset],
		);
		const cards = new CardActions(this.db);
		const events = rows.map((row) => {
			const fieldsBefore = JSON.parse(row.before_fields_json) as Record<
				string,
				string
			>;
			const fieldsAfter = JSON.parse(row.after_fields_json) as Record<
				string,
				string
			>;
			return {
				id: row.id,
				noteId: row.note_id,
				editedAt: row.edited_at,
				source: row.source,
				deviceId: row.device_id,
				sourceUid: row.source_uid,
				fieldsBefore,
				fieldsAfter,
				noteTypeBefore: JSON.parse(row.before_note_type_json) as TypeSnapshot,
				noteTypeAfter: JSON.parse(row.after_note_type_json) as TypeSnapshot,
				cards: this.siblings(row.note_id)
					.filter((c) => cardId === undefined || c.id === cardId)
					.map((c) => {
						const current = cards.get(c.id);
						return {
							id: c.id,
							templateOrd: c.template_ord,
							before: renderHistorical(
								fieldsBefore,
								row.before_note_type_json,
								c.template_ord,
							),
							after: renderHistorical(
								fieldsAfter,
								row.after_note_type_json,
								c.template_ord,
							),
							current: current
								? { question: current.question, answer: current.answer }
								: null,
						};
					}),
			};
		});
		return {
			total,
			count: events.length,
			limit,
			offset,
			hasMore: offset + events.length < total,
			events,
			retention: CARD_EDIT_HISTORY_RETENTION,
			historyStartsAt: Number(
				this.db.get<{ value: string }>(
					"SELECT value FROM meta WHERE key='card_edit_history_started_at'",
				)?.value,
			),
			limitation:
				"Local edits only; no preinstallation history. History is shared by sibling cards; 50 events per note content owner. Historical fields are authoritative; rendering uses the saved note type and requested current card ordinal.",
		};
	}
}
