import { escapeFts5Query } from "@features/core/persistence/sqlite/modules/NoteActions";
import type { SqliteDatabase } from "@features/core/persistence/sqlite/SqliteDatabase";
import {
	deriveCardType,
	renderTemplate,
} from "@features/core/services/template-engine";
import {
	normalizeIOImagePath,
	parseIODefinition,
} from "@features/image-occlusion/io-definition";
import { FLASHCARD_CONFIG } from "@shared/constants";
import type { FSRSCardData } from "@shared/types";
import type { CardTemplate } from "@shared/types/note.types";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_BASIC_REVERSED_ID,
	BUILTIN_CLOZE_ID,
	BUILTIN_IMAGE_OCCLUSION_ID,
} from "@shared/types/note.types";

// ── Column definitions (JOIN-based, computed q/a) ──────────────

const CARD_SELECT = `
    c.id, c.due, c.stability, c.difficulty, c.reps, c.lapses, c.state,
    c.last_review AS lastReview,
    c.scheduled_days AS scheduledDays,
    c.learning_step AS learningStep,
    c.suspended = 1 AS suspended,
    c.buried_until AS buriedUntil,
    c.created_at AS createdAt,
    c.source_uid AS sourceUid,
    c.note_id AS noteId,
    c.template_ord AS templateOrd,
    n.fields_json AS fieldsJson,
    n.tags AS noteTags,
    n.source_text AS sourceText,
    n.created_via AS createdVia,
    n.note_type_id AS noteTypeId,
    nt.type AS noteTypeType,
    nt.name AS noteTypeName,
    nt.templates_json AS templatesJson
`;

const CARD_SELECT_SYNC = `
    c.id, c.due, c.stability, c.difficulty, c.reps, c.lapses, c.state,
    c.last_review AS lastReview,
    c.scheduled_days AS scheduledDays,
    c.learning_step AS learningStep,
    c.suspended = 1 AS suspended,
    c.buried_until AS buriedUntil,
    c.created_at AS createdAt,
    c.updated_at AS updatedAt,
    c.deleted_at AS deletedAt,
    c.source_uid AS sourceUid,
    c.note_id AS noteId,
    c.template_ord AS templateOrd,
    n.fields_json AS fieldsJson,
    n.tags AS noteTags,
    n.source_text AS sourceText,
    n.created_via AS createdVia,
    n.note_type_id AS noteTypeId,
    nt.type AS noteTypeType,
    nt.name AS noteTypeName,
    nt.templates_json AS templatesJson
`;

const CARD_FROM = `
    FROM cards c
    JOIN notes n ON c.note_id = n.id
    JOIN note_types nt ON n.note_type_id = nt.id
`;

interface CardRow {
	id: string;
	due: string;
	stability: number;
	difficulty: number;
	reps: number;
	lapses: number;
	state: number;
	lastReview: string | null;
	scheduledDays: number;
	learningStep: number;
	suspended: number;
	buriedUntil: string | null;
	createdAt: number | null;
	updatedAt?: number | null;
	deletedAt?: number | null;
	sourceUid: string | null;
	noteId: string;
	templateOrd: number;
	fieldsJson: string;
	noteTags: string | null;
	sourceText: string | null;
	createdVia: string | null;
	noteTypeId: string;
	noteTypeType: number;
	noteTypeName: string;
	templatesJson: string;
}

function mapRow(row: CardRow): FSRSCardData {
	const fields = JSON.parse(row.fieldsJson) as Record<string, string>;
	const noteTags =
		row.noteTags
			?.split(" ")
			.map((t) => t.trim())
			.filter(Boolean) ?? [];
	const templates = JSON.parse(row.templatesJson) as CardTemplate[];

	// Cloze types: always use first template (templateOrd = cloze index, not template ordinal)
	let template: CardTemplate | undefined;
	if (row.noteTypeType === 1) {
		template = templates[0];
	} else {
		template = templates.find((t) => t.ordinal === row.templateOrd);
	}

	const noteTypeInfo = {
		id: row.noteTypeId,
		type: row.noteTypeType as 0 | 1,
	};
	const cardType = deriveCardType(noteTypeInfo, row.templateOrd);

	const ioImagePath =
		cardType === "image-occlusion"
			? normalizeIOImagePath(fields.Image ?? "")
			: undefined;
	const ioRegionsJson =
		cardType === "image-occlusion" ? (fields.Regions ?? "") : undefined;
	const ioDefinition =
		cardType === "image-occlusion" && ioRegionsJson
			? parseIODefinition(ioRegionsJson)
			: null;

	let question = "";
	let answer = "";

	if (cardType === "image-occlusion") {
		question =
			ioImagePath && ioDefinition
				? `Image occlusion ${row.templateOrd + 1}`
				: "Image occlusion";
		answer = "Reveal image occlusion";
	} else if (template) {
		const context = { fields, clozeIndex: row.templateOrd };
		question = renderTemplate(template.qfmt, context);
		answer = renderTemplate(template.afmt, {
			...context,
			frontSide: "",
		});
	}

	const isCloze = noteTypeInfo.type === 1;

	// Derive cloze field name from template's {{cloze:FieldName}} instead of hardcoding "Text"
	let clozeFieldName = "Text";
	if (isCloze && template) {
		const m = template.qfmt.match(/\{\{\s*cloze:(\w+)\s*\}\}/);
		if (m?.[1]) clozeFieldName = m[1];
	}

	return {
		id: row.id,
		due: row.due,
		stability: row.stability,
		difficulty: row.difficulty,
		reps: row.reps,
		lapses: row.lapses,
		state: row.state,
		lastReview: row.lastReview,
		scheduledDays: row.scheduledDays,
		learningStep: row.learningStep,
		suspended: row.suspended === 1,
		buriedUntil: row.buriedUntil ?? undefined,
		createdAt: row.createdAt ?? undefined,
		question,
		answer,
		sourceUid: row.sourceUid ?? undefined,
		cardType,
		clozeTemplate: isCloze ? (fields[clozeFieldName] ?? undefined) : undefined,
		clozeIndex: isCloze ? row.templateOrd : undefined,
		createdVia: row.createdVia ?? undefined,
		sourceText: row.sourceText ?? undefined,
		noteId: row.noteId,
		templateOrd: row.templateOrd,
		noteTypeId: row.noteTypeId,
		noteTypeName: row.noteTypeName,
		ioImagePath,
		ioRegionsJson,
		ioGroupKey:
			cardType === "image-occlusion" ? String(row.templateOrd) : undefined,
		alwaysTypeIn: noteTags.includes(FLASHCARD_CONFIG.alwaysTypeInTag),
	};
}

function mapRowWithSync(
	row: CardRow,
): FSRSCardData & { updatedAt?: number; deletedAt?: number | null } {
	return {
		...mapRow(row),
		updatedAt: row.updatedAt ?? undefined,
		deletedAt: row.deletedAt,
	};
}

// ── Note mapping helper ───────────────────────────────────────

function resolveNoteMapping(data: FSRSCardData): {
	noteTypeId: string;
	fieldsJson: string;
	templateOrd: number;
} {
	if (data.noteTypeId) {
		if (data.noteTypeId === BUILTIN_IMAGE_OCCLUSION_ID) {
			return {
				noteTypeId: BUILTIN_IMAGE_OCCLUSION_ID,
				fieldsJson: JSON.stringify({
					Image: data.ioImagePath ?? "",
					Regions: data.ioRegionsJson ?? "[]",
				}),
				templateOrd: data.templateOrd ?? 0,
			};
		}

		// Caller provides explicit field values (e.g. Anki import with custom note types)
		if (data.fields) {
			return {
				noteTypeId: data.noteTypeId,
				fieldsJson: JSON.stringify(data.fields),
				templateOrd: data.templateOrd ?? 0,
			};
		}

		// Fallback: derive fields from question/answer for legacy callers
		return {
			noteTypeId: data.noteTypeId,
			fieldsJson: JSON.stringify(
				data.cardType === "cloze"
					? { Text: data.clozeTemplate ?? "", Extra: "" }
					: { Front: data.question ?? "", Back: data.answer ?? "" },
			),
			templateOrd: data.templateOrd ?? 0,
		};
	}

	if (data.cardType === "cloze") {
		return {
			noteTypeId: BUILTIN_CLOZE_ID,
			fieldsJson: JSON.stringify({
				Text: data.clozeTemplate ?? "",
				Extra: "",
			}),
			templateOrd: data.clozeIndex ?? 0,
		};
	}

	if (data.cardType === "reversed") {
		return {
			noteTypeId: BUILTIN_BASIC_REVERSED_ID,
			fieldsJson: JSON.stringify({
				Front: data.question ?? "",
				Back: data.answer ?? "",
			}),
			templateOrd: data.templateOrd ?? 1,
		};
	}

	return {
		noteTypeId: BUILTIN_BASIC_ID,
		fieldsJson: JSON.stringify({
			Front: data.question ?? "",
			Back: data.answer ?? "",
		}),
		templateOrd: data.templateOrd ?? 0,
	};
}

// ── CardActions class ─────────────────────────────────────────

export class CardActions {
	private fts5Available: boolean | null = null;

	constructor(private db: SqliteDatabase) {}

	private isFts5Available(): boolean {
		if (this.fts5Available === null) {
			const row = this.db.get<{ value: string }>(
				`SELECT value FROM meta WHERE key = 'fts5_available'`,
			);
			this.fts5Available = row?.value === "1";
		}
		return this.fts5Available;
	}

	private noteMatchCondition(param: string): { sql: string; param: string } {
		if (this.isFts5Available()) {
			return {
				sql: "n.rowid IN (SELECT rowid FROM notes_fts WHERE notes_fts MATCH ?)",
				param: escapeFts5Query(param),
			};
		}
		return { sql: "n.fields_json LIKE ?", param: `%${param}%` };
	}

	// ── Read methods ──────────────────────────────────────────

	get(cardId: string): FSRSCardData | undefined {
		const row = this.db.get<CardRow>(
			`SELECT ${CARD_SELECT} ${CARD_FROM} WHERE c.id = ? AND c.deleted_at IS NULL`,
			[cardId],
		);
		if (!row) return undefined;
		return mapRow(row);
	}

	getAll(): FSRSCardData[] {
		const rows = this.db.query<CardRow>(
			`SELECT ${CARD_SELECT} ${CARD_FROM} WHERE c.deleted_at IS NULL`,
		);
		return rows.map(mapRow);
	}

	getByIds(cardIds: string[]): FSRSCardData[] {
		if (cardIds.length === 0) return [];
		const placeholders = cardIds.map(() => "?").join(",");
		const rows = this.db.query<CardRow>(
			`SELECT ${CARD_SELECT} ${CARD_FROM} WHERE c.id IN (${placeholders}) AND c.deleted_at IS NULL`,
			cardIds,
		);
		return rows.map(mapRow);
	}

	getCardsBySourceUid(sourceUid: string): FSRSCardData[] {
		const rows = this.db.query<CardRow>(
			`SELECT ${CARD_SELECT} ${CARD_FROM} WHERE c.source_uid = ? AND c.deleted_at IS NULL ORDER BY c.created_at ASC, c.id ASC`,
			[sourceUid],
		);
		return rows.map(mapRow);
	}

	getBySourceUid(sourceUid: string): FSRSCardData[] {
		return this.getCardsBySourceUid(sourceUid);
	}

	getCardsWithContent(): FSRSCardData[] {
		return this.getAll().map((card) => ({
			...card,
			sourceNoteName: "",
			sourceNotePath: "",
		}));
	}

	getAllIncludingDeleted(): FSRSCardData[] {
		const rows = this.db.query<CardRow>(`SELECT ${CARD_SELECT} ${CARD_FROM}`);
		return rows.map(mapRow);
	}

	getModifiedSince(
		timestamp: number,
	): (FSRSCardData & { updatedAt?: number; deletedAt?: number | null })[] {
		const rows = this.db.query<CardRow>(
			`SELECT ${CARD_SELECT_SYNC} ${CARD_FROM} WHERE c.updated_at > ?`,
			[timestamp],
		);
		return rows.map(mapRowWithSync);
	}

	getDueCardsByDateRange(startDate: string, endDate: string): FSRSCardData[] {
		const rows = this.db.query<CardRow>(
			`SELECT ${CARD_SELECT} ${CARD_FROM}
                 WHERE c.deleted_at IS NULL
                   AND c.suspended = 0
                   AND (c.buried_until IS NULL OR c.buried_until <= datetime('now'))
                   AND c.state NOT IN (1, 3)
                   AND date(c.due) BETWEEN ? AND ?
                 ORDER BY c.due ASC`,
			[startDate, endDate],
		);
		return rows.map(mapRow);
	}

	browserQuery(
		where: string,
		params: (string | number)[],
		orderBy: string,
		limit: number,
		offset: number,
	): FSRSCardData[] {
		const sql = `SELECT ${CARD_SELECT} ${CARD_FROM} WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
		const rows = this.db.query<CardRow>(sql, [...params, limit, offset]);
		return rows.map(mapRow);
	}

	browserCount(where: string, params: (string | number)[]): number {
		const sql = `SELECT COUNT(*) as count ${CARD_FROM} WHERE ${where}`;
		return this.db.get<{ count: number }>(sql, params)?.count ?? 0;
	}

	// ── Sibling / relationship queries ────────────────────────

	getCardByReverseOf(originalCardId: string): FSRSCardData | undefined {
		const original = this.db.get<{
			note_id: string;
			template_ord: number;
		}>(
			`SELECT note_id, template_ord FROM cards WHERE id = ? AND deleted_at IS NULL`,
			[originalCardId],
		);
		if (!original) return undefined;
		const row = this.db.get<CardRow>(
			`SELECT ${CARD_SELECT} ${CARD_FROM}
                 WHERE c.note_id = ? AND c.template_ord != ? AND c.deleted_at IS NULL LIMIT 1`,
			[original.note_id, original.template_ord],
		);
		if (!row) return undefined;
		return mapRow(row);
	}

	getCardsByNoteId(noteId: string): FSRSCardData[] {
		const rows = this.db.query<CardRow>(
			`SELECT ${CARD_SELECT} ${CARD_FROM}
				 WHERE c.note_id = ? AND c.deleted_at IS NULL
				 ORDER BY c.template_ord`,
			[noteId],
		);
		return rows.map(mapRow);
	}

	getNoteInfoForCardIds(
		cardIds: string[],
	): Array<{ noteId: string; noteTypeId: string }> {
		if (cardIds.length === 0) return [];
		const placeholders = cardIds.map(() => "?").join(",");
		return this.db.query<{ noteId: string; noteTypeId: string }>(
			`SELECT DISTINCT c.note_id AS noteId, n.note_type_id AS noteTypeId
			 FROM cards c JOIN notes n ON c.note_id = n.id
			 WHERE c.id IN (${placeholders}) AND c.deleted_at IS NULL`,
			cardIds,
		);
	}

	findClozeCard(
		sourceUid: string,
		_clozeTemplate: string,
		clozeIndex: number,
	): string | undefined {
		return this.db.get<{ id: string }>(
			`SELECT c.id FROM cards c
                 JOIN notes n ON c.note_id = n.id
                 WHERE n.source_uid = ? AND c.template_ord = ? AND c.deleted_at IS NULL
                 LIMIT 1`,
			[sourceUid, clozeIndex],
		)?.id;
	}

	getIOChildren(parentId: string): FSRSCardData[] {
		const parent = this.db.get<{ note_id: string }>(
			`SELECT note_id FROM cards WHERE id = ? AND deleted_at IS NULL`,
			[parentId],
		);
		if (!parent) return [];
		const rows = this.db.query<CardRow>(
			`SELECT ${CARD_SELECT} ${CARD_FROM}
                 WHERE c.note_id = ? AND c.template_ord > 0 AND c.deleted_at IS NULL
                 ORDER BY c.template_ord`,
			[parent.note_id],
		);
		return rows.map(mapRow);
	}

	softDeleteIOFamily(parentId: string): string[] {
		const children = this.getIOChildren(parentId);
		const allIds = [parentId, ...children.map((c) => c.id)];
		this.bulkSoftDelete(allIds);
		return allIds;
	}

	getClozeSiblings(sourceUid: string, _clozeTemplate: string): FSRSCardData[] {
		const rows = this.db.query<CardRow>(
			`SELECT ${CARD_SELECT} ${CARD_FROM}
                 WHERE n.source_uid = ? AND c.deleted_at IS NULL
                 ORDER BY c.template_ord ASC`,
			[sourceUid],
		);
		return rows.map(mapRow);
	}

	// ── Write methods ─────────────────────────────────────────

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
		this.db.run(
			`INSERT OR REPLACE INTO cards (
                    id, note_id, template_ord, due, stability, difficulty,
                    reps, lapses, state, last_review, scheduled_days,
                    learning_step, suspended, buried_until,
                    created_at, updated_at, source_uid
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
		const card = this.db.get<{ note_id: string; note_type_id: string }>(
			`SELECT c.note_id, n.note_type_id
			 FROM cards c
			 JOIN notes n ON c.note_id = n.id
			 WHERE c.id = ?`,
			[cardId],
		);
		if (!card) return;
		if (card.note_type_id === BUILTIN_IMAGE_OCCLUSION_ID) {
			throw new Error(
				"Image occlusion cards must be edited in the image occlusion editor.",
			);
		}
		this.db.run(
			`UPDATE notes SET fields_json = ?, updated_at = ? WHERE id = ?`,
			[
				JSON.stringify({ Front: question, Back: answer }),
				Date.now(),
				card.note_id,
			],
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
		if (!card) return;
		const note = this.db.get<{ fields_json: string }>(
			`SELECT fields_json FROM notes WHERE id = ?`,
			[card.note_id],
		);
		const fields = note
			? (JSON.parse(note.fields_json) as Record<string, string>)
			: {};
		fields.Text = clozeTemplate;
		this.db.run(
			`UPDATE notes SET fields_json = ?, updated_at = ? WHERE id = ?`,
			[JSON.stringify(fields), Date.now(), card.note_id],
		);
	}

	upsertFromRemote(
		data: FSRSCardData & { updatedAt?: number; deletedAt?: number | null },
	): void {
		const now = Date.now();

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
		this.db.run(
			`INSERT OR REPLACE INTO cards (
                    id, note_id, template_ord, due, stability, difficulty,
                    reps, lapses, state, last_review, scheduled_days,
                    learning_step, suspended, buried_until,
                    created_at, updated_at, deleted_at, source_uid
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
	}

	// ── Lookup methods ────────────────────────────────────────

	getCardIdByQuestion(question: string): string | undefined {
		const match = this.noteMatchCondition(question);
		return this.db.get<{ id: string }>(
			`SELECT c.id FROM cards c
                 JOIN notes n ON c.note_id = n.id
                 WHERE ${match.sql} AND c.deleted_at IS NULL
                 LIMIT 1`,
			[match.param],
		)?.id;
	}

	getCardInfoByQuestion(
		question: string,
		excludeCardId?: string,
	): { id: string; sourceUid?: string } | undefined {
		const match = this.noteMatchCondition(question);
		const sql = excludeCardId
			? `SELECT c.id, c.source_uid AS sourceUid FROM cards c
                   JOIN notes n ON c.note_id = n.id
                   WHERE ${match.sql} AND c.id != ? AND c.deleted_at IS NULL LIMIT 1`
			: `SELECT c.id, c.source_uid AS sourceUid FROM cards c
                   JOIN notes n ON c.note_id = n.id
                   WHERE ${match.sql} AND c.deleted_at IS NULL LIMIT 1`;
		const params = excludeCardId ? [match.param, excludeCardId] : [match.param];
		const row = this.db.get<{
			id: string;
			sourceUid: string | null;
		}>(sql, params);
		if (!row) return undefined;
		return { id: row.id, sourceUid: row.sourceUid ?? undefined };
	}

	getCardIdByQuestionAndClozeIndex(
		question: string,
		clozeIndex: number,
	): string | undefined {
		const match = this.noteMatchCondition(question);
		return this.db.get<{ id: string }>(
			`SELECT c.id FROM cards c
                 JOIN notes n ON c.note_id = n.id
                 WHERE ${match.sql} AND c.template_ord = ? AND c.deleted_at IS NULL
                 LIMIT 1`,
			[match.param, clozeIndex],
		)?.id;
	}

	// ── Content checks ────────────────────────────────────────

	hasCardContent(cardId: string): boolean {
		return this.has(cardId);
	}

	hasAnyCardContent(): boolean {
		return this.size() > 0;
	}

	getCardsWithContentCount(): number {
		return this.size();
	}

	// ── FSRS-only methods (no schema branching needed) ────────

	has(cardId: string): boolean {
		return (
			this.db.get<{ found: number }>(
				`SELECT 1 as found FROM cards WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
				[cardId],
			) !== null
		);
	}

	keys(): string[] {
		const rows = this.db.query<{ id: string }>(
			`SELECT id FROM cards WHERE deleted_at IS NULL`,
		);
		return rows.map((r) => r.id);
	}

	size(): number {
		return (
			this.db.get<{ count: number }>(
				`SELECT COUNT(*) as count FROM cards WHERE deleted_at IS NULL`,
			)?.count ?? 0
		);
	}

	softDelete(cardId: string): void {
		const now = Date.now();
		this.db.run(
			`UPDATE cards SET deleted_at = ?, updated_at = ? WHERE id = ?`,
			[now, now, cardId],
		);
	}

	/** @deprecated Use softDelete() instead for sync compatibility */
	delete(cardId: string): void {
		this.db.run(`DELETE FROM cards WHERE id = ?`, [cardId]);
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
			this.db.run(
				`UPDATE review_log SET deleted_at = ?, updated_at = ? WHERE card_id = ?`,
				[now, now, cardId],
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

	// ── Bulk operations ───────────────────────────────────────

	bulkSuspend(cardIds: string[]): number {
		if (cardIds.length === 0) return 0;
		const placeholders = cardIds.map(() => "?").join(",");
		const params = [Date.now(), ...cardIds] as [number, ...string[]];
		this.db.run(
			`UPDATE cards SET suspended = 1, updated_at = ? WHERE id IN (${placeholders})`,
			params,
		);
		return this.db.getRowsModified();
	}

	bulkUnsuspend(cardIds: string[]): number {
		if (cardIds.length === 0) return 0;
		const placeholders = cardIds.map(() => "?").join(",");
		const params = [Date.now(), ...cardIds] as [number, ...string[]];
		this.db.run(
			`UPDATE cards SET suspended = 0, updated_at = ? WHERE id IN (${placeholders})`,
			params,
		);
		return this.db.getRowsModified();
	}

	bulkBury(cardIds: string[], untilDate: string): number {
		if (cardIds.length === 0) return 0;
		const placeholders = cardIds.map(() => "?").join(",");
		const params = [untilDate, Date.now(), ...cardIds] as [
			string,
			number,
			...string[],
		];
		this.db.run(
			`UPDATE cards SET buried_until = ?, updated_at = ? WHERE id IN (${placeholders})`,
			params,
		);
		return this.db.getRowsModified();
	}

	bulkUnbury(cardIds: string[]): number {
		if (cardIds.length === 0) return 0;
		const placeholders = cardIds.map(() => "?").join(",");
		const params = [Date.now(), ...cardIds] as [number, ...string[]];
		this.db.run(
			`UPDATE cards SET buried_until = NULL, updated_at = ? WHERE id IN (${placeholders})`,
			params,
		);
		return this.db.getRowsModified();
	}

	bulkSoftDelete(cardIds: string[]): number {
		if (cardIds.length === 0) return 0;
		const now = Date.now();
		const placeholders = cardIds.map(() => "?").join(",");
		this.db.transaction(() => {
			this.db.run(
				`UPDATE review_log SET deleted_at = ?, updated_at = ? WHERE card_id IN (${placeholders})`,
				[now, now, ...cardIds],
			);
			this.db.run(
				`UPDATE cards SET deleted_at = ?, updated_at = ? WHERE id IN (${placeholders})`,
				[now, now, ...cardIds],
			);
		});
		return cardIds.length;
	}

	/** @deprecated Use bulkSoftDelete() instead for sync compatibility */
	bulkDelete(cardIds: string[]): number {
		if (cardIds.length === 0) return 0;
		const placeholders = cardIds.map(() => "?").join(",");
		this.db.transaction(() => {
			this.db.run(
				`DELETE FROM review_log WHERE card_id IN (${placeholders})`,
				cardIds,
			);
			this.db.run(`DELETE FROM cards WHERE id IN (${placeholders})`, cardIds);
		});
		return cardIds.length;
	}

	bulkReset(cardIds: string[]): number {
		if (cardIds.length === 0) return 0;
		const placeholders = cardIds.map(() => "?").join(",");
		const now = new Date().toISOString();
		const params = [now, Date.now(), ...cardIds] as [
			string,
			number,
			...string[],
		];
		this.db.run(
			`UPDATE cards SET
                state = 0, reps = 0, lapses = 0,
                stability = 0, difficulty = 0, scheduled_days = 0,
                learning_step = 0, due = ?, last_review = NULL,
                suspended = 0, buried_until = NULL, updated_at = ?
            WHERE id IN (${placeholders})`,
			params,
		);
		return this.db.getRowsModified();
	}

	bulkReschedule(cardIds: string[], dueDate: string): number {
		if (cardIds.length === 0) return 0;
		const placeholders = cardIds.map(() => "?").join(",");
		const params = [dueDate, Date.now(), ...cardIds] as [
			string,
			number,
			...string[],
		];
		this.db.run(
			`UPDATE cards SET due = ?, updated_at = ? WHERE id IN (${placeholders})`,
			params,
		);
		return this.db.getRowsModified();
	}
}
