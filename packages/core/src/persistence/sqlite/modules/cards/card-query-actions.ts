import type { CardSchedulingMeta, FSRSCardData } from "../../../../types";
import type { SqliteDatabase } from "../../SqliteDatabase";
import { sqlPlaceholders } from "../../sql-utils";
import { escapeFts5Query } from "../NoteActions";
import {
	CARD_FROM,
	CARD_SELECT,
	CARD_SELECT_SYNC,
	type CardRow,
	META_SELECT,
	type MetaRow,
	mapMetaRow,
	mapRow,
	mapRowWithSync,
} from "./card-sql";

export class CardQueryActions {
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

	// ── Scheduling-only reads (no template rendering) ────────

	getAllSchedulingMeta(): CardSchedulingMeta[] {
		const rows = this.db.query<MetaRow>(
			`SELECT ${META_SELECT} ${CARD_FROM} WHERE c.deleted_at IS NULL`,
		);
		return rows.map(mapMetaRow);
	}

	getSchedulingMetaById(cardId: string): CardSchedulingMeta | null {
		const row = this.db.get<MetaRow>(
			`SELECT ${META_SELECT} ${CARD_FROM} WHERE c.id = ? AND c.deleted_at IS NULL`,
			[cardId],
		);
		if (!row) return null;
		return mapMetaRow(row);
	}

	// ── Full card reads (with template rendering) ─────────────

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
		const placeholders = sqlPlaceholders(cardIds.length);
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

	/**
	 * Count of active Review-state cards per UTC due day within
	 * [startDate, endDate]. New cards are excluded: they enter the schedule
	 * via the daily new-card limit, not due-date scheduling. Aggregates in
	 * SQL (no notes JOIN, no row materialization) so it is cheap enough for
	 * per-review load-balancing paths.
	 */
	getDueCountsByDateRange(
		startDate: string,
		endDate: string,
		excludeCardId?: string,
	): { day: string; count: number }[] {
		const excludeClause = excludeCardId ? "AND c.id != ?" : "";
		const params = excludeCardId
			? [startDate, endDate, excludeCardId]
			: [startDate, endDate];
		return this.db.query<{ day: string; count: number }>(
			`SELECT date(c.due) AS day, COUNT(*) AS count
                 FROM cards c
                 WHERE c.deleted_at IS NULL
                   AND c.suspended = 0
                   AND (c.buried_until IS NULL OR c.buried_until <= datetime('now'))
                   AND c.state = 2
                   AND date(c.due) BETWEEN ? AND ?
                   ${excludeClause}
                 GROUP BY day
                 ORDER BY day ASC`,
			params,
		);
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

	browserQueryIds(where: string, params: (string | number)[]): string[] {
		const sql = `SELECT c.id AS id ${CARD_FROM} WHERE ${where}`;
		return this.db.query<{ id: string }>(sql, params).map((row) => row.id);
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
		const placeholders = sqlPlaceholders(cardIds.length);
		return this.db.query<{ noteId: string; noteTypeId: string }>(
			`SELECT DISTINCT c.note_id AS noteId, n.note_type_id AS noteTypeId
			 FROM cards c JOIN notes n ON c.note_id = n.id
			 WHERE c.id IN (${placeholders}) AND c.deleted_at IS NULL`,
			cardIds,
		);
	}

	findClozeCard(
		sourceUid: string,
		clozeTemplate: string,
		clozeIndex: number,
	): string | undefined {
		// template_ord (the cloze index) is only unique within a single cloze
		// block. Two blocks in the same note can both have a c1, so we must also
		// match the cloze template text to avoid false duplicates.
		const rows = this.db.query<CardRow>(
			`SELECT ${CARD_SELECT} ${CARD_FROM}
                 WHERE n.source_uid = ? AND c.template_ord = ? AND c.deleted_at IS NULL`,
			[sourceUid, clozeIndex],
		);
		return rows.map(mapRow).find((card) => card.clozeTemplate === clozeTemplate)
			?.id;
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

	getClozeSiblings(sourceUid: string, clozeTemplate: string): FSRSCardData[] {
		const rows = this.db.query<CardRow>(
			`SELECT ${CARD_SELECT} ${CARD_FROM}
                 WHERE n.source_uid = ? AND c.deleted_at IS NULL
                 ORDER BY c.template_ord ASC`,
			[sourceUid],
		);
		// A source note can hold several independent cloze blocks (and even
		// non-cloze cards). Siblings are only the cards that share the same cloze
		// template text — scoping by source_uid alone would treat every cloze
		// block in the note as one group.
		return rows
			.map(mapRow)
			.filter((card) => card.clozeTemplate === clozeTemplate);
	}

	// ── Lookup methods ────────────────────────────────────────
	//
	// FTS/LIKE only pre-filters candidates: a phrase/substring match against
	// the whole fields_json also hits questions embedded in OTHER cards'
	// answers, which used to produce false duplicates (blocking creation and
	// silently dropping imports). The final verdict is exact equality of the
	// rendered question.

	private findExactQuestionMatch(
		question: string,
		opts: { excludeCardId?: string; clozeIndex?: number } = {},
	): FSRSCardData | undefined {
		const conditions = ["c.deleted_at IS NULL"];
		const baseParams: (string | number)[] = [];
		if (opts.excludeCardId) {
			conditions.push("c.id != ?");
			baseParams.push(opts.excludeCardId);
		}
		if (opts.clozeIndex !== undefined) {
			conditions.push("c.template_ord = ?");
			baseParams.push(opts.clozeIndex);
		}

		// fields_json stores JSON-escaped text, so a raw LIKE misses questions
		// containing quotes/backslashes/newlines — try the escaped form too.
		const jsonEscaped = JSON.stringify(question).slice(1, -1);
		const candidateParams =
			jsonEscaped === question ? [question] : [question, jsonEscaped];

		// Case-insensitive whole-question equality (established behavior —
		// LIKE/FTS candidates are case-insensitive too).
		const wanted = question.toLowerCase();

		for (const candidate of candidateParams) {
			const match = this.noteMatchCondition(candidate);
			const rows = this.db.query<CardRow>(
				`SELECT ${CARD_SELECT} ${CARD_FROM}
                     WHERE ${match.sql} AND ${conditions.join(" AND ")}
                     LIMIT 50`,
				[match.param, ...baseParams],
			);
			const exact = rows
				.map(mapRow)
				.find((c) => (c.question ?? "").toLowerCase() === wanted);
			if (exact) return exact;
		}
		return undefined;
	}

	getCardIdByQuestion(question: string): string | undefined {
		return this.findExactQuestionMatch(question)?.id;
	}

	getCardInfoByQuestion(
		question: string,
		excludeCardId?: string,
	): { id: string; sourceUid?: string } | undefined {
		const exact = this.findExactQuestionMatch(question, { excludeCardId });
		if (!exact) return undefined;
		return { id: exact.id, sourceUid: exact.sourceUid ?? undefined };
	}

	getCardIdByQuestionAndClozeIndex(
		question: string,
		clozeIndex: number,
	): string | undefined {
		return this.findExactQuestionMatch(question, { clozeIndex })?.id;
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

	/**
	 * Active source-linked cards keyed for concurrent-create dedup.
	 * (source_uid, template_ord, fields_json) identifies one logical card:
	 * cloze siblings differ by template_ord (cloze index) or by their Text
	 * field, IO children and reversed pairs differ by template_ord.
	 */
	getActiveDedupRows(): {
		id: string;
		createdAt: number | null;
		templateOrd: number;
		sourceUid: string;
		fieldsJson: string;
	}[] {
		return this.db.query<{
			id: string;
			createdAt: number | null;
			templateOrd: number;
			sourceUid: string;
			fieldsJson: string;
		}>(
			`SELECT
                c.id,
                c.created_at AS createdAt,
                c.template_ord AS templateOrd,
                c.source_uid AS sourceUid,
                n.fields_json AS fieldsJson
             FROM cards c
             JOIN notes n ON c.note_id = n.id
             WHERE c.deleted_at IS NULL AND c.source_uid IS NOT NULL`,
		);
	}

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
}
