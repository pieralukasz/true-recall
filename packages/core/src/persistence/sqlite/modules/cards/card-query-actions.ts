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

	getClozeSiblings(sourceUid: string, _clozeTemplate: string): FSRSCardData[] {
		const rows = this.db.query<CardRow>(
			`SELECT ${CARD_SELECT} ${CARD_FROM}
                 WHERE n.source_uid = ? AND c.deleted_at IS NULL
                 ORDER BY c.template_ord ASC`,
			[sourceUid],
		);
		return rows.map(mapRow);
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
}
