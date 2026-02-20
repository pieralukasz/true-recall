/**
 * Card Actions Module
 * CRUD operations for flashcard data
 *
 * Uses SQL column aliases to map directly to FSRSCardData interface
 * Centralized column definitions and row mapping to avoid duplication
 */

import type { SqliteDatabase } from "@features/core/persistence/sqlite/SqliteDatabase";
import type { CardType, FSRSCardData } from "@shared/types";

const CARD_SELECT_COLUMNS = `
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
    reverse_of as reverseOf
`;

const CARD_SELECT_COLUMNS_FOR_SYNC = `
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
    reverse_of as reverseOf
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
	question: string | null;
	answer: string | null;
	sourceUid: string | null;
	cardType: string | null;
	clozeTemplate: string | null;
	clozeIndex: number | null;
	reverseOf: string | null;
}

function mapRowToCard(row: CardRow): FSRSCardData {
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
	};
}

function mapRowToCardWithSync(
	row: CardRow,
): FSRSCardData & { updatedAt?: number; deletedAt?: number | null } {
	return {
		...mapRowToCard(row),
		updatedAt: row.updatedAt ?? undefined,
		deletedAt: row.deletedAt,
	};
}

export class CardActions {
	constructor(private db: SqliteDatabase) {}

	get(cardId: string): FSRSCardData | undefined {
		const row = this.db.get<CardRow>(
			`SELECT ${CARD_SELECT_COLUMNS} FROM cards WHERE id = ? AND deleted_at IS NULL`,
			[cardId],
		);

		if (!row || !row.question) return undefined;
		return mapRowToCard(row);
	}

	set(cardId: string, data: FSRSCardData): void {
		const now = Date.now();

		// Check if card exists to preserve created_at
		const existing = this.db.get<{ created_at: number | null }>(
			`SELECT created_at FROM cards WHERE id = ?`,
			[cardId],
		);

		const createdAt = data.createdAt ?? existing?.created_at ?? now;

		this.db.run(
			`
            INSERT OR REPLACE INTO cards (
                id, due, stability, difficulty, reps, lapses, state,
                last_review, scheduled_days, learning_step, suspended,
                buried_until, created_at, updated_at,
                question, answer, source_uid,
                card_type, cloze_template, cloze_index, reverse_of
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
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
			],
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

	getAll(): FSRSCardData[] {
		const rows = this.db.query<CardRow>(
			`SELECT ${CARD_SELECT_COLUMNS} FROM cards WHERE deleted_at IS NULL`,
		);
		return rows.map(mapRowToCard);
	}

	size(): number {
		return (
			this.db.get<{ count: number }>(
				`SELECT COUNT(*) as count FROM cards WHERE deleted_at IS NULL`,
			)?.count ?? 0
		);
	}

	getByIds(cardIds: string[]): FSRSCardData[] {
		if (cardIds.length === 0) return [];

		const placeholders = cardIds.map(() => "?").join(",");
		const rows = this.db.query<CardRow>(
			`SELECT ${CARD_SELECT_COLUMNS} FROM cards WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
			cardIds,
		);
		return rows.map(mapRowToCard);
	}

	updateCardContent(cardId: string, question: string, answer: string): void {
		this.db.run(
			`
            UPDATE cards SET
                question = ?,
                answer = ?,
                updated_at = ?
            WHERE id = ?
        `,
			[question, answer, Date.now(), cardId],
		);
	}

	updateClozeCardContent(
		cardId: string,
		question: string,
		answer: string,
		clozeTemplate: string,
	): void {
		this.db.run(
			`
            UPDATE cards SET
                question = ?,
                answer = ?,
                cloze_template = ?,
                updated_at = ?
            WHERE id = ?
        `,
			[question, answer, clozeTemplate, Date.now(), cardId],
		);
	}

	getCardsBySourceUid(sourceUid: string): FSRSCardData[] {
		const rows = this.db.query<CardRow>(
			`SELECT ${CARD_SELECT_COLUMNS} FROM cards WHERE source_uid = ? AND deleted_at IS NULL ORDER BY created_at ASC, id ASC`,
			[sourceUid],
		);
		return rows.map(mapRowToCard);
	}

	// Source note name/path and projects are resolved at runtime from vault
	getCardsWithContent(): FSRSCardData[] {
		const rows = this.db.query<CardRow>(
			`SELECT ${CARD_SELECT_COLUMNS} FROM cards WHERE deleted_at IS NULL AND question IS NOT NULL`,
		);

		// Note: sourceNoteName, sourceNotePath, projects empty - caller must enrich via SourceNoteService
		return rows.map((row) => ({
			...mapRowToCard(row),
			sourceNoteName: "",
			sourceNotePath: "",
			projects: [],
		}));
	}

	hasCardContent(cardId: string): boolean {
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
		return (
			this.db.get<{ found: number }>(
				`SELECT 1 as found FROM cards
             WHERE deleted_at IS NULL AND question IS NOT NULL
             LIMIT 1`,
			) !== null
		);
	}

	getCardsWithContentCount(): number {
		return (
			this.db.get<{ count: number }>(
				`SELECT COUNT(*) as count FROM cards
             WHERE deleted_at IS NULL AND question IS NOT NULL`,
			)?.count ?? 0
		);
	}

	updateCardSourceUid(cardId: string, sourceUid: string): void {
		this.db.run(
			`
            UPDATE cards SET
                source_uid = ?,
                updated_at = ?
            WHERE id = ?
        `,
			[sourceUid, Date.now(), cardId],
		);
	}

	getCardIdByQuestion(question: string): string | undefined {
		return this.db.get<{ id: string }>(
			`SELECT id FROM cards WHERE deleted_at IS NULL AND question = ? LIMIT 1`,
			[question],
		)?.id;
	}

	getCardInfoByQuestion(
		question: string,
		excludeCardId?: string,
	): { id: string; sourceUid?: string } | undefined {
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
		return this.db.get<{ id: string }>(
			`SELECT id FROM cards WHERE deleted_at IS NULL AND question = ? AND cloze_index = ? LIMIT 1`,
			[question, clozeIndex],
		)?.id;
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

	getAllIncludingDeleted(): FSRSCardData[] {
		const rows = this.db.query<CardRow>(
			`SELECT ${CARD_SELECT_COLUMNS} FROM cards`,
		);
		return rows.map(mapRowToCard);
	}

	getModifiedSince(
		timestamp: number,
	): (FSRSCardData & { updatedAt?: number; deletedAt?: number | null })[] {
		const rows = this.db.query<CardRow>(
			`SELECT ${CARD_SELECT_COLUMNS_FOR_SYNC} FROM cards WHERE updated_at > ?`,
			[timestamp],
		);
		return rows.map(mapRowToCardWithSync);
	}

	upsertFromRemote(
		data: FSRSCardData & { updatedAt?: number; deletedAt?: number | null },
	): void {
		this.db.run(
			`
            INSERT OR REPLACE INTO cards (
                id, due, stability, difficulty, reps, lapses, state,
                last_review, scheduled_days, learning_step, suspended,
                buried_until, created_at, updated_at, deleted_at,
                question, answer, source_uid,
                card_type, cloze_template, cloze_index, reverse_of
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
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
				data.createdAt ?? Date.now(),
				data.updatedAt ?? Date.now(),
				data.deletedAt ?? null,
				data.question ?? null,
				data.answer ?? null,
				data.sourceUid ?? null,
				data.cardType ?? "basic",
				data.clozeTemplate ?? null,
				data.clozeIndex ?? null,
				data.reverseOf ?? null,
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

	// Excludes Learning (1) and Relearning (3) cards - they have short intervals
	// that should not be modified by load balancing
	getDueCardsByDateRange(startDate: string, endDate: string): FSRSCardData[] {
		const rows = this.db.query<CardRow>(
			`SELECT ${CARD_SELECT_COLUMNS} FROM cards
             WHERE deleted_at IS NULL
               AND suspended = 0
               AND (buried_until IS NULL OR buried_until <= datetime('now'))
               AND state NOT IN (1, 3)
               AND date(due) BETWEEN ? AND ?
             ORDER BY due ASC`,
			[startDate, endDate],
		);
		return rows.map(mapRowToCard);
	}

	updateCardDue(cardId: string, newDue: string): void {
		this.db.run(
			`
            UPDATE cards SET
                due = ?,
                updated_at = ?
            WHERE id = ?
        `,
			[newDue, Date.now(), cardId],
		);
	}

	updateCardScheduling(
		cardId: string,
		data: { due: string; scheduledDays: number },
	): void {
		this.db.run(
			`
            UPDATE cards SET
                due = ?,
                scheduled_days = ?,
                updated_at = ?
            WHERE id = ?
        `,
			[data.due, data.scheduledDays, Date.now(), cardId],
		);
	}

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
			`
            UPDATE cards SET
                state = 0,
                reps = 0,
                lapses = 0,
                stability = 0,
                difficulty = 0,
                scheduled_days = 0,
                learning_step = 0,
                due = ?,
                last_review = NULL,
                suspended = 0,
                buried_until = NULL,
                updated_at = ?
            WHERE id IN (${placeholders})
        `,
			params,
		);

		return this.db.getRowsModified();
	}

	getCardByReverseOf(originalCardId: string): FSRSCardData | undefined {
		const row = this.db.get<CardRow>(
			`SELECT ${CARD_SELECT_COLUMNS} FROM cards WHERE reverse_of = ? AND deleted_at IS NULL LIMIT 1`,
			[originalCardId],
		);
		if (!row || !row.question) return undefined;
		return mapRowToCard(row);
	}

	findClozeCard(
		sourceUid: string,
		clozeTemplate: string,
		clozeIndex: number,
	): string | undefined {
		return this.db.get<{ id: string }>(
			`SELECT id FROM cards WHERE source_uid = ? AND cloze_template = ? AND cloze_index = ? AND deleted_at IS NULL LIMIT 1`,
			[sourceUid, clozeTemplate, clozeIndex],
		)?.id;
	}

	getClozeSiblings(sourceUid: string, clozeTemplate: string): FSRSCardData[] {
		const rows = this.db.query<CardRow>(
			`SELECT ${CARD_SELECT_COLUMNS} FROM cards WHERE source_uid = ? AND cloze_template = ? AND deleted_at IS NULL ORDER BY cloze_index ASC`,
			[sourceUid, clozeTemplate],
		);
		return rows.map(mapRowToCard);
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
