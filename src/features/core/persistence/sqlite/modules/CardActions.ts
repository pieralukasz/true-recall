/**
 * Card Actions Module
 * CRUD operations for flashcard data
 *
 * Supports both v25 (stored question/answer) and v26 (computed via template JOINs).
 * Schema version is detected lazily from the meta table and cached.
 */

import type { SqliteDatabase } from "@features/core/persistence/sqlite/SqliteDatabase";
import {
	deriveCardType,
	renderTemplate,
} from "@features/core/services/template-engine";
import type { CardType, FSRSCardData } from "@shared/types";
import type { CardTemplate } from "@shared/types/note.types";
import { BUILTIN_BASIC_ID } from "@shared/types/note.types";

// ── v25 column definitions (stored question/answer) ───────────

const CARD_SELECT_V25 = `
    id, due, stability, difficulty, reps, lapses, state,
    last_review as lastReview,
    scheduled_days as scheduledDays,
    learning_step as learningStep,
    suspended = 1 as suspended,
    buried_until as buriedUntil,
    created_at as createdAt,
    question,
    answer,
    source_uid as sourceUid,
    card_type as cardType,
    cloze_template as clozeTemplate,
    cloze_index as clozeIndex,
    reverse_of as reverseOf,
    io_image_path as ioImagePath,
    io_regions_json as ioRegionsJson,
    io_group_key as ioGroupKey,
    io_parent_id as ioParentId,
    created_via as createdVia,
    source_text as sourceText
`;

const CARD_SELECT_V25_SYNC = `
    id, due, stability, difficulty, reps, lapses, state,
    last_review as lastReview,
    scheduled_days as scheduledDays,
    learning_step as learningStep,
    suspended = 1 as suspended,
    buried_until as buriedUntil,
    created_at as createdAt,
    updated_at as updatedAt,
    deleted_at as deletedAt,
    question,
    answer,
    source_uid as sourceUid,
    card_type as cardType,
    cloze_template as clozeTemplate,
    cloze_index as clozeIndex,
    reverse_of as reverseOf,
    io_image_path as ioImagePath,
    io_regions_json as ioRegionsJson,
    io_group_key as ioGroupKey,
    io_parent_id as ioParentId,
    created_via as createdVia,
    source_text as sourceText
`;

interface CardRowV25 {
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
	question: string | null;
	answer: string | null;
	sourceUid: string | null;
	cardType: string | null;
	clozeTemplate: string | null;
	clozeIndex: number | null;
	reverseOf: string | null;
	ioImagePath: string | null;
	ioRegionsJson: string | null;
	ioGroupKey: string | null;
	ioParentId: string | null;
	createdVia: string | null;
	sourceText: string | null;
}

function mapRowV25(row: CardRowV25): FSRSCardData {
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
		question: row.question ?? undefined,
		answer: row.answer ?? undefined,
		sourceUid: row.sourceUid ?? undefined,
		cardType: (row.cardType as CardType) ?? "basic",
		clozeTemplate: row.clozeTemplate ?? undefined,
		clozeIndex: row.clozeIndex ?? undefined,
		reverseOf: row.reverseOf ?? undefined,
		ioImagePath: row.ioImagePath ?? undefined,
		ioRegionsJson: row.ioRegionsJson ?? undefined,
		ioGroupKey: row.ioGroupKey ?? undefined,
		ioParentId: row.ioParentId ?? undefined,
		createdVia: row.createdVia ?? undefined,
		sourceText: row.sourceText ?? undefined,
	};
}

function mapRowV25WithSync(
	row: CardRowV25,
): FSRSCardData & { updatedAt?: number; deletedAt?: number | null } {
	return {
		...mapRowV25(row),
		updatedAt: row.updatedAt ?? undefined,
		deletedAt: row.deletedAt,
	};
}

// ── v26 column definitions (JOIN-based, computed q/a) ─────────

const CARD_SELECT_V26 = `
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
    n.source_text AS sourceText,
    n.created_via AS createdVia,
    n.note_type_id AS noteTypeId,
    nt.type AS noteTypeType,
    nt.name AS noteTypeName,
    nt.templates_json AS templatesJson
`;

const CARD_SELECT_V26_SYNC = `
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
    n.source_text AS sourceText,
    n.created_via AS createdVia,
    n.note_type_id AS noteTypeId,
    nt.type AS noteTypeType,
    nt.name AS noteTypeName,
    nt.templates_json AS templatesJson
`;

const CARD_FROM_V26 = `
    FROM cards c
    JOIN notes n ON c.note_id = n.id
    JOIN note_types nt ON n.note_type_id = nt.id
`;

interface CardRowV26 {
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
	sourceText: string | null;
	createdVia: string | null;
	noteTypeId: string;
	noteTypeType: number;
	noteTypeName: string;
	templatesJson: string;
}

function mapRowV26(row: CardRowV26): FSRSCardData {
	const fields = JSON.parse(row.fieldsJson) as Record<string, string>;
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

	let question = "";
	let answer = "";

	if (template) {
		const context = { fields, clozeIndex: row.templateOrd };
		question = renderTemplate(template.qfmt, context);
		// Pass empty frontSide — UI shows question separately, so {{FrontSide}} should not duplicate it
		answer = renderTemplate(template.afmt, {
			...context,
			frontSide: "",
		});
	}

	const isCloze = noteTypeInfo.type === 1;

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
		clozeTemplate: isCloze ? (fields["Text"] ?? undefined) : undefined,
		clozeIndex: isCloze ? row.templateOrd : undefined,
		createdVia: row.createdVia ?? undefined,
		sourceText: row.sourceText ?? undefined,
		noteId: row.noteId,
		templateOrd: row.templateOrd,
		noteTypeId: row.noteTypeId,
	};
}

function mapRowV26WithSync(
	row: CardRowV26,
): FSRSCardData & { updatedAt?: number; deletedAt?: number | null } {
	return {
		...mapRowV26(row),
		updatedAt: row.updatedAt ?? undefined,
		deletedAt: row.deletedAt,
	};
}

// ── CardActions class ─────────────────────────────────────────

export class CardActions {
	private _isV26: boolean | null = null;

	constructor(private db: SqliteDatabase) {}

	get v26(): boolean {
		return this.isV26;
	}

	private get isV26(): boolean {
		if (this._isV26 === null) {
			const meta = this.db.get<{ value: string }>(
				`SELECT value FROM meta WHERE key = 'schema_version'`,
			);
			this._isV26 = meta ? parseInt(meta.value, 10) >= 26 : false;
		}
		return this._isV26;
	}

	// ── Read methods ──────────────────────────────────────────

	get(cardId: string): FSRSCardData | undefined {
		if (this.isV26) {
			const row = this.db.get<CardRowV26>(
				`SELECT ${CARD_SELECT_V26} ${CARD_FROM_V26} WHERE c.id = ? AND c.deleted_at IS NULL`,
				[cardId],
			);
			if (!row) return undefined;
			return mapRowV26(row);
		}
		const row = this.db.get<CardRowV25>(
			`SELECT ${CARD_SELECT_V25} FROM cards WHERE id = ? AND deleted_at IS NULL`,
			[cardId],
		);
		if (!row || !row.question) return undefined;
		return mapRowV25(row);
	}

	getAll(): FSRSCardData[] {
		if (this.isV26) {
			const rows = this.db.query<CardRowV26>(
				`SELECT ${CARD_SELECT_V26} ${CARD_FROM_V26} WHERE c.deleted_at IS NULL`,
			);
			return rows.map(mapRowV26);
		}
		const rows = this.db.query<CardRowV25>(
			`SELECT ${CARD_SELECT_V25} FROM cards WHERE deleted_at IS NULL`,
		);
		return rows.map(mapRowV25);
	}

	getByIds(cardIds: string[]): FSRSCardData[] {
		if (cardIds.length === 0) return [];
		const placeholders = cardIds.map(() => "?").join(",");

		if (this.isV26) {
			const rows = this.db.query<CardRowV26>(
				`SELECT ${CARD_SELECT_V26} ${CARD_FROM_V26} WHERE c.id IN (${placeholders}) AND c.deleted_at IS NULL`,
				cardIds,
			);
			return rows.map(mapRowV26);
		}
		const rows = this.db.query<CardRowV25>(
			`SELECT ${CARD_SELECT_V25} FROM cards WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
			cardIds,
		);
		return rows.map(mapRowV25);
	}

	getCardsBySourceUid(sourceUid: string): FSRSCardData[] {
		if (this.isV26) {
			const rows = this.db.query<CardRowV26>(
				`SELECT ${CARD_SELECT_V26} ${CARD_FROM_V26} WHERE c.source_uid = ? AND c.deleted_at IS NULL ORDER BY c.created_at ASC, c.id ASC`,
				[sourceUid],
			);
			return rows.map(mapRowV26);
		}
		const rows = this.db.query<CardRowV25>(
			`SELECT ${CARD_SELECT_V25} FROM cards WHERE source_uid = ? AND deleted_at IS NULL ORDER BY created_at ASC, id ASC`,
			[sourceUid],
		);
		return rows.map(mapRowV25);
	}

	getBySourceUid(sourceUid: string): FSRSCardData[] {
		return this.getCardsBySourceUid(sourceUid);
	}

	getCardsWithContent(): FSRSCardData[] {
		if (this.isV26) {
			return this.getAll().map((card) => ({
				...card,
				sourceNoteName: "",
				sourceNotePath: "",
			}));
		}
		const rows = this.db.query<CardRowV25>(
			`SELECT ${CARD_SELECT_V25} FROM cards WHERE deleted_at IS NULL AND question IS NOT NULL`,
		);
		return rows.map((row) => ({
			...mapRowV25(row),
			sourceNoteName: "",
			sourceNotePath: "",
			projects: [],
		}));
	}

	getAllIncludingDeleted(): FSRSCardData[] {
		if (this.isV26) {
			const rows = this.db.query<CardRowV26>(
				`SELECT ${CARD_SELECT_V26} ${CARD_FROM_V26}`,
			);
			return rows.map(mapRowV26);
		}
		const rows = this.db.query<CardRowV25>(
			`SELECT ${CARD_SELECT_V25} FROM cards`,
		);
		return rows.map(mapRowV25);
	}

	getModifiedSince(
		timestamp: number,
	): (FSRSCardData & { updatedAt?: number; deletedAt?: number | null })[] {
		if (this.isV26) {
			const rows = this.db.query<CardRowV26>(
				`SELECT ${CARD_SELECT_V26_SYNC} ${CARD_FROM_V26} WHERE c.updated_at > ?`,
				[timestamp],
			);
			return rows.map(mapRowV26WithSync);
		}
		const rows = this.db.query<CardRowV25>(
			`SELECT ${CARD_SELECT_V25_SYNC} FROM cards WHERE updated_at > ?`,
			[timestamp],
		);
		return rows.map(mapRowV25WithSync);
	}

	getDueCardsByDateRange(
		startDate: string,
		endDate: string,
	): FSRSCardData[] {
		if (this.isV26) {
			const rows = this.db.query<CardRowV26>(
				`SELECT ${CARD_SELECT_V26} ${CARD_FROM_V26}
                 WHERE c.deleted_at IS NULL
                   AND c.suspended = 0
                   AND (c.buried_until IS NULL OR c.buried_until <= datetime('now'))
                   AND c.state NOT IN (1, 3)
                   AND date(c.due) BETWEEN ? AND ?
                 ORDER BY c.due ASC`,
				[startDate, endDate],
			);
			return rows.map(mapRowV26);
		}
		const rows = this.db.query<CardRowV25>(
			`SELECT ${CARD_SELECT_V25} FROM cards
             WHERE deleted_at IS NULL
               AND suspended = 0
               AND (buried_until IS NULL OR buried_until <= datetime('now'))
               AND state NOT IN (1, 3)
               AND date(due) BETWEEN ? AND ?
             ORDER BY due ASC`,
			[startDate, endDate],
		);
		return rows.map(mapRowV25);
	}

	browserQuery(
		where: string,
		params: (string | number)[],
		orderBy: string,
		limit: number,
		offset: number,
	): FSRSCardData[] {
		if (this.isV26) {
			const sql = `SELECT ${CARD_SELECT_V26} ${CARD_FROM_V26} WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
			const rows = this.db.query<CardRowV26>(sql, [
				...params,
				limit,
				offset,
			]);
			return rows.map(mapRowV26);
		}
		const sql = `SELECT ${CARD_SELECT_V25} FROM cards WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
		const rows = this.db.query<CardRowV25>(sql, [
			...params,
			limit,
			offset,
		]);
		return rows.map(mapRowV25);
	}

	browserCount(where: string, params: (string | number)[]): number {
		if (this.isV26) {
			const sql = `SELECT COUNT(*) as count ${CARD_FROM_V26} WHERE ${where}`;
			return this.db.get<{ count: number }>(sql, params)?.count ?? 0;
		}
		const sql = `SELECT COUNT(*) as count FROM cards WHERE ${where}`;
		return this.db.get<{ count: number }>(sql, params)?.count ?? 0;
	}

	// ── Sibling / relationship queries ────────────────────────

	getCardByReverseOf(originalCardId: string): FSRSCardData | undefined {
		if (this.isV26) {
			const original = this.db.get<{
				note_id: string;
				template_ord: number;
			}>(
				`SELECT note_id, template_ord FROM cards WHERE id = ? AND deleted_at IS NULL`,
				[originalCardId],
			);
			if (!original) return undefined;
			const row = this.db.get<CardRowV26>(
				`SELECT ${CARD_SELECT_V26} ${CARD_FROM_V26}
                 WHERE c.note_id = ? AND c.template_ord != ? AND c.deleted_at IS NULL LIMIT 1`,
				[original.note_id, original.template_ord],
			);
			if (!row) return undefined;
			return mapRowV26(row);
		}
		const row = this.db.get<CardRowV25>(
			`SELECT ${CARD_SELECT_V25} FROM cards WHERE reverse_of = ? AND deleted_at IS NULL LIMIT 1`,
			[originalCardId],
		);
		if (!row || !row.question) return undefined;
		return mapRowV25(row);
	}

	findClozeCard(
		sourceUid: string,
		clozeTemplate: string,
		clozeIndex: number,
	): string | undefined {
		if (this.isV26) {
			return this.db.get<{ id: string }>(
				`SELECT c.id FROM cards c
                 JOIN notes n ON c.note_id = n.id
                 WHERE n.source_uid = ? AND c.template_ord = ? AND c.deleted_at IS NULL
                 LIMIT 1`,
				[sourceUid, clozeIndex],
			)?.id;
		}
		return this.db.get<{ id: string }>(
			`SELECT id FROM cards WHERE source_uid = ? AND cloze_template = ? AND cloze_index = ? AND deleted_at IS NULL LIMIT 1`,
			[sourceUid, clozeTemplate, clozeIndex],
		)?.id;
	}

	getIOChildren(parentId: string): FSRSCardData[] {
		if (this.isV26) {
			const parent = this.db.get<{ note_id: string }>(
				`SELECT note_id FROM cards WHERE id = ? AND deleted_at IS NULL`,
				[parentId],
			);
			if (!parent) return [];
			const rows = this.db.query<CardRowV26>(
				`SELECT ${CARD_SELECT_V26} ${CARD_FROM_V26}
                 WHERE c.note_id = ? AND c.template_ord > 0 AND c.deleted_at IS NULL
                 ORDER BY c.template_ord`,
				[parent.note_id],
			);
			return rows.map(mapRowV26);
		}
		const rows = this.db.query<CardRowV25>(
			`SELECT ${CARD_SELECT_V25} FROM cards WHERE io_parent_id = ? AND deleted_at IS NULL ORDER BY io_group_key ASC`,
			[parentId],
		);
		return rows.map(mapRowV25);
	}

	softDeleteIOFamily(parentId: string): string[] {
		const children = this.getIOChildren(parentId);
		const allIds = [parentId, ...children.map((c) => c.id)];
		this.bulkSoftDelete(allIds);
		return allIds;
	}

	getClozeSiblings(
		sourceUid: string,
		clozeTemplate: string,
	): FSRSCardData[] {
		if (this.isV26) {
			const rows = this.db.query<CardRowV26>(
				`SELECT ${CARD_SELECT_V26} ${CARD_FROM_V26}
                 WHERE n.source_uid = ? AND c.deleted_at IS NULL
                 ORDER BY c.template_ord ASC`,
				[sourceUid],
			);
			return rows.map(mapRowV26);
		}
		const rows = this.db.query<CardRowV25>(
			`SELECT ${CARD_SELECT_V25} FROM cards WHERE source_uid = ? AND cloze_template = ? AND deleted_at IS NULL ORDER BY cloze_index ASC`,
			[sourceUid, clozeTemplate],
		);
		return rows.map(mapRowV25);
	}

	// ── Write methods ─────────────────────────────────────────

	set(cardId: string, data: FSRSCardData): void {
		const now = Date.now();
		const existing = this.db.get<{ created_at: number | null }>(
			`SELECT created_at FROM cards WHERE id = ?`,
			[cardId],
		);
		const createdAt = data.createdAt ?? existing?.created_at ?? now;

		if (this.isV26) {
			// v26: create note if needed, write to v26 cards schema
			let noteId = data.noteId;
			if (!noteId) {
				noteId = crypto.randomUUID();
				this.db.run(
					`INSERT OR IGNORE INTO notes (id, note_type_id, fields_json, tags, source_uid, created_at, updated_at)
                     VALUES (?, ?, ?, '', ?, ?, ?)`,
					[
						noteId,
						BUILTIN_BASIC_ID,
						JSON.stringify({
							Front: data.question ?? "",
							Back: data.answer ?? "",
						}),
						data.sourceUid ?? null,
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
					data.templateOrd ?? 0,
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
			return;
		}
		// v25: write to old schema
		this.db.run(
			`INSERT OR REPLACE INTO cards (
                id, due, stability, difficulty, reps, lapses, state,
                last_review, scheduled_days, learning_step, suspended,
                buried_until, created_at, updated_at,
                question, answer, source_uid,
                card_type, cloze_template, cloze_index, reverse_of,
                io_image_path, io_regions_json, io_group_key, io_parent_id,
                created_via, source_text
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				cardId,
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
				data.question ?? null,
				data.answer ?? null,
				data.sourceUid ?? null,
				data.cardType ?? "basic",
				data.clozeTemplate ?? null,
				data.clozeIndex ?? null,
				data.reverseOf ?? null,
				data.ioImagePath ?? null,
				data.ioRegionsJson ?? null,
				data.ioGroupKey ?? null,
				data.ioParentId ?? null,
				data.createdVia ?? "manual",
				data.sourceText ?? null,
			],
		);
	}

	updateCardContent(
		cardId: string,
		question: string,
		answer: string,
	): void {
		if (this.isV26) {
			const card = this.db.get<{ note_id: string }>(
				`SELECT note_id FROM cards WHERE id = ?`,
				[cardId],
			);
			if (!card) return;
			this.db.run(
				`UPDATE notes SET fields_json = ?, updated_at = ? WHERE id = ?`,
				[
					JSON.stringify({ Front: question, Back: answer }),
					Date.now(),
					card.note_id,
				],
			);
			return;
		}
		this.db.run(
			`UPDATE cards SET question = ?, answer = ?, updated_at = ? WHERE id = ?`,
			[question, answer, Date.now(), cardId],
		);
	}

	updateClozeCardContent(
		cardId: string,
		question: string,
		answer: string,
		clozeTemplate: string,
	): void {
		if (this.isV26) {
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
			fields["Text"] = clozeTemplate;
			this.db.run(
				`UPDATE notes SET fields_json = ?, updated_at = ? WHERE id = ?`,
				[JSON.stringify(fields), Date.now(), card.note_id],
			);
			return;
		}
		this.db.run(
			`UPDATE cards SET question = ?, answer = ?, cloze_template = ?, updated_at = ? WHERE id = ?`,
			[question, answer, clozeTemplate, Date.now(), cardId],
		);
	}

	upsertFromRemote(
		data: FSRSCardData & { updatedAt?: number; deletedAt?: number | null },
	): void {
		const now = Date.now();

		if (this.isV26) {
			let noteId = data.noteId;
			if (!noteId) {
				noteId = crypto.randomUUID();
				this.db.run(
					`INSERT OR IGNORE INTO notes (id, note_type_id, fields_json, tags, source_uid, created_at, updated_at)
                     VALUES (?, ?, ?, '', ?, ?, ?)`,
					[
						noteId,
						BUILTIN_BASIC_ID,
						JSON.stringify({
							Front: data.question ?? "",
							Back: data.answer ?? "",
						}),
						data.sourceUid ?? null,
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
					data.templateOrd ?? 0,
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
			return;
		}
		this.db.run(
			`INSERT OR REPLACE INTO cards (
                id, due, stability, difficulty, reps, lapses, state,
                last_review, scheduled_days, learning_step, suspended,
                buried_until, created_at, updated_at, deleted_at,
                question, answer, source_uid,
                card_type, cloze_template, cloze_index, reverse_of,
                io_image_path, io_regions_json, io_group_key, io_parent_id,
                source_text
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				data.id,
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
				data.question ?? null,
				data.answer ?? null,
				data.sourceUid ?? null,
				data.cardType ?? "basic",
				data.clozeTemplate ?? null,
				data.clozeIndex ?? null,
				data.reverseOf ?? null,
				data.ioImagePath ?? null,
				data.ioRegionsJson ?? null,
				data.ioGroupKey ?? null,
				data.ioParentId ?? null,
				data.sourceText ?? null,
			],
		);
	}

	// ── Lookup methods ────────────────────────────────────────

	getCardIdByQuestion(question: string): string | undefined {
		if (this.isV26) {
			return this.db.get<{ id: string }>(
				`SELECT c.id FROM cards c
                 JOIN notes n ON c.note_id = n.id
                 WHERE n.fields_json LIKE ? AND c.deleted_at IS NULL
                 LIMIT 1`,
				[`%${question}%`],
			)?.id;
		}
		return this.db.get<{ id: string }>(
			`SELECT id FROM cards WHERE deleted_at IS NULL AND question = ? LIMIT 1`,
			[question],
		)?.id;
	}

	getCardInfoByQuestion(
		question: string,
		excludeCardId?: string,
	): { id: string; sourceUid?: string } | undefined {
		if (this.isV26) {
			const sql = excludeCardId
				? `SELECT c.id, c.source_uid AS sourceUid FROM cards c
                   JOIN notes n ON c.note_id = n.id
                   WHERE n.fields_json LIKE ? AND c.id != ? AND c.deleted_at IS NULL LIMIT 1`
				: `SELECT c.id, c.source_uid AS sourceUid FROM cards c
                   JOIN notes n ON c.note_id = n.id
                   WHERE n.fields_json LIKE ? AND c.deleted_at IS NULL LIMIT 1`;
			const params = excludeCardId
				? [`%${question}%`, excludeCardId]
				: [`%${question}%`];
			const row = this.db.get<{
				id: string;
				sourceUid: string | null;
			}>(sql, params);
			if (!row) return undefined;
			return { id: row.id, sourceUid: row.sourceUid ?? undefined };
		}
		const row = excludeCardId
			? this.db.get<{ id: string; sourceUid: string | null }>(
					`SELECT id, source_uid as sourceUid FROM cards WHERE deleted_at IS NULL AND question = ? AND id != ? LIMIT 1`,
					[question, excludeCardId],
				)
			: this.db.get<{ id: string; sourceUid: string | null }>(
					`SELECT id, source_uid as sourceUid FROM cards WHERE deleted_at IS NULL AND question = ? LIMIT 1`,
					[question],
				);
		if (!row) return undefined;
		return { id: row.id, sourceUid: row.sourceUid ?? undefined };
	}

	getCardIdByQuestionAndClozeIndex(
		question: string,
		clozeIndex: number,
	): string | undefined {
		if (this.isV26) {
			return this.db.get<{ id: string }>(
				`SELECT c.id FROM cards c
                 JOIN notes n ON c.note_id = n.id
                 WHERE n.fields_json LIKE ? AND c.template_ord = ? AND c.deleted_at IS NULL
                 LIMIT 1`,
				[`%${question}%`, clozeIndex],
			)?.id;
		}
		return this.db.get<{ id: string }>(
			`SELECT id FROM cards WHERE deleted_at IS NULL AND question = ? AND cloze_index = ? LIMIT 1`,
			[question, clozeIndex],
		)?.id;
	}

	// ── Content checks ────────────────────────────────────────

	hasCardContent(cardId: string): boolean {
		if (this.isV26) return this.has(cardId);
		return (
			this.db.get<{ found: number }>(
				`SELECT 1 as found FROM cards
                 WHERE id = ? AND deleted_at IS NULL AND question IS NOT NULL
                 LIMIT 1`,
				[cardId],
			) !== null
		);
	}

	hasAnyCardContent(): boolean {
		if (this.isV26) return this.size() > 0;
		return (
			this.db.get<{ found: number }>(
				`SELECT 1 as found FROM cards
                 WHERE deleted_at IS NULL AND question IS NOT NULL
                 LIMIT 1`,
			) !== null
		);
	}

	getCardsWithContentCount(): number {
		if (this.isV26) return this.size();
		return (
			this.db.get<{ count: number }>(
				`SELECT COUNT(*) as count FROM cards
                 WHERE deleted_at IS NULL AND question IS NOT NULL`,
			)?.count ?? 0
		);
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
		this.db.run(
			`UPDATE cards SET due = ?, updated_at = ? WHERE id = ?`,
			[newDue, Date.now(), cardId],
		);
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
			this.db.run(
				`DELETE FROM cards WHERE id IN (${placeholders})`,
				cardIds,
			);
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
