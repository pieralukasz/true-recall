/**
 * Card Actions Module
 * CRUD operations for flashcard data
 *
 * Uses SQL column aliases to map directly to FSRSCardData interface
 * Centralized column definitions and row mapping to avoid duplication
 */
import type { FSRSCardData } from "types";
import { SqliteDatabase } from "../SqliteDatabase";

// ===== Centralized Column Definitions =====

/**
 * SQL SELECT columns with aliases for standard card queries
 * Used by get, getAll, getByIds, getCardsBySourceUid, getOrphanedCards, getAllIncludingDeleted
 */
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
    source_uid as sourceUid
`;

/**
 * SQL SELECT columns for sync queries (includes updated_at, deleted_at)
 */
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
    source_uid as sourceUid
`;

/**
 * Raw row type returned by SQL queries
 */
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
}

/**
 * Map a raw SQL row to FSRSCardData
 */
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
    };
}

/**
 * Map a raw SQL row to FSRSCardData with sync fields
 */
function mapRowToCardWithSync(row: CardRow): FSRSCardData & { updatedAt?: number; deletedAt?: number | null } {
    return {
        ...mapRowToCard(row),
        updatedAt: row.updatedAt ?? undefined,
        deletedAt: row.deletedAt,
    };
}

// ===== Card CRUD Operations =====

/**
 * Card CRUD operations
 */
export class CardActions {
    constructor(private db: SqliteDatabase) {}

    /**
     * Get a card by ID
     */
    get(cardId: string): FSRSCardData | undefined {
        const row = this.db.get<CardRow>(
            `SELECT ${CARD_SELECT_COLUMNS} FROM cards WHERE id = ? AND deleted_at IS NULL`,
            [cardId]
        );

        if (!row || !row.question) return undefined;
        return mapRowToCard(row);
    }

    /**
     * Set/update a card
     */
    set(cardId: string, data: FSRSCardData): void {
        const now = Date.now();

        // Check if card exists to preserve created_at
        const existing = this.db.get<{ created_at: number | null }>(
            `SELECT created_at FROM cards WHERE id = ?`,
            [cardId]
        );

        const createdAt = data.createdAt ?? existing?.created_at ?? now;

        this.db.run(`
            INSERT OR REPLACE INTO cards (
                id, due, stability, difficulty, reps, lapses, state,
                last_review, scheduled_days, learning_step, suspended,
                buried_until, created_at, updated_at,
                question, answer, source_uid
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
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
        ]);
    }

    /**
     * Soft delete a card
     */
    softDelete(cardId: string): void {
        const now = Date.now();
        this.db.run(
            `UPDATE cards SET deleted_at = ?, updated_at = ? WHERE id = ?`,
            [now, now, cardId]
        );
    }

    /**
     * Hard delete a card (for cleanup operations)
     * @deprecated Use softDelete() instead for sync compatibility
     */
    delete(cardId: string): void {
        this.db.run(`DELETE FROM cards WHERE id = ?`, [cardId]);
    }

    /**
     * Check if a card exists
     */
    has(cardId: string): boolean {
        return this.db.get<{ exists: number }>(
            `SELECT 1 as exists FROM cards WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
            [cardId]
        ) !== null;
    }

    /**
     * Get all card IDs
     */
    keys(): string[] {
        const rows = this.db.query<{ id: string }>(`SELECT id FROM cards WHERE deleted_at IS NULL`);
        return rows.map((r) => r.id);
    }

    /**
     * Get all cards
     */
    getAll(): FSRSCardData[] {
        const rows = this.db.query<CardRow>(
            `SELECT ${CARD_SELECT_COLUMNS} FROM cards WHERE deleted_at IS NULL`
        );
        return rows.map(mapRowToCard);
    }

    /**
     * Get total card count
     */
    size(): number {
        return this.db.get<{ count: number }>(
            `SELECT COUNT(*) as count FROM cards WHERE deleted_at IS NULL`
        )?.count ?? 0;
    }

    /**
     * Get multiple cards by IDs (optimized batch fetch)
     * Uses SQL WHERE IN instead of fetching all cards and filtering
     */
    getByIds(cardIds: string[]): FSRSCardData[] {
        if (cardIds.length === 0) return [];

        const placeholders = cardIds.map(() => "?").join(",");
        const rows = this.db.query<CardRow>(
            `SELECT ${CARD_SELECT_COLUMNS} FROM cards WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
            cardIds
        );
        return rows.map(mapRowToCard);
    }

    // ===== Content Operations =====

    /**
     * Update only card content (question/answer)
     */
    updateCardContent(cardId: string, question: string, answer: string): void {
        this.db.run(`
            UPDATE cards SET
                question = ?,
                answer = ?,
                updated_at = ?
            WHERE id = ?
        `, [question, answer, Date.now(), cardId]);
    }

    /**
     * Get cards by source note UID
     */
    getCardsBySourceUid(sourceUid: string): FSRSCardData[] {
        const rows = this.db.query<CardRow>(
            `SELECT ${CARD_SELECT_COLUMNS} FROM cards WHERE source_uid = ? AND deleted_at IS NULL ORDER BY created_at ASC, id ASC`,
            [sourceUid]
        );
        return rows.map(mapRowToCard);
    }

    /**
     * Get all cards with content (v15: no note_projects, source_notes has only uid)
     * Source note name/path and projects are resolved at runtime from vault
     */
    getCardsWithContent(): FSRSCardData[] {
        const rows = this.db.query<CardRow>(
            `SELECT ${CARD_SELECT_COLUMNS} FROM cards WHERE deleted_at IS NULL AND question IS NOT NULL`
        );

        // Note: sourceNoteName, sourceNotePath, projects empty - caller must enrich via SourceNoteService
        return rows.map((row) => ({
            ...mapRowToCard(row),
            sourceNoteName: "",
            sourceNotePath: "",
            projects: [],
        }));
    }

    /**
     * Check if card has content
     */
    hasCardContent(cardId: string): boolean {
        return this.db.get<{ exists: number }>(
            `SELECT 1 as exists FROM cards
             WHERE id = ? AND deleted_at IS NULL AND question IS NOT NULL
             LIMIT 1`,
            [cardId]
        ) !== null;
    }

    /**
     * Check if any cards have content
     */
    hasAnyCardContent(): boolean {
        return this.db.get<{ exists: number }>(
            `SELECT 1 as exists FROM cards
             WHERE deleted_at IS NULL AND question IS NOT NULL
             LIMIT 1`
        ) !== null;
    }

    /**
     * Get count of cards with content
     */
    getCardsWithContentCount(): number {
        return this.db.get<{ count: number }>(
            `SELECT COUNT(*) as count FROM cards
             WHERE deleted_at IS NULL AND question IS NOT NULL`
        )?.count ?? 0;
    }

    // ===== Orphaned Cards Operations =====

    /**
     * Get all orphaned cards (cards without source_uid)
     */
    getOrphanedCards(): FSRSCardData[] {
        const rows = this.db.query<CardRow>(
            `SELECT ${CARD_SELECT_COLUMNS} FROM cards WHERE deleted_at IS NULL AND source_uid IS NULL AND question IS NOT NULL`
        );
        return rows.map(mapRowToCard);
    }

    /**
     * Update source_uid for a card
     */
    updateCardSourceUid(cardId: string, sourceUid: string): void {
        this.db.run(`
            UPDATE cards SET
                source_uid = ?,
                updated_at = ?
            WHERE id = ?
        `, [sourceUid, Date.now(), cardId]);
    }

    /**
     * Get card ID by exact question match
     */
    getCardIdByQuestion(question: string): string | undefined {
        return this.db.get<{ id: string }>(
            `SELECT id FROM cards WHERE deleted_at IS NULL AND question = ? LIMIT 1`,
            [question]
        )?.id;
    }

    // ===== Soft Delete Operations =====

    /**
     * Soft delete a card with cascade to related records
     */
    softDeleteWithCascade(cardId: string): void {
        const now = Date.now();
        this.db.transaction(() => {
            this.db.run(
                `UPDATE cards SET deleted_at = ?, updated_at = ? WHERE id = ?`,
                [now, now, cardId]
            );
            this.db.run(
                `UPDATE review_log SET deleted_at = ?, updated_at = ? WHERE card_id = ?`,
                [now, now, cardId]
            );
        });
    }

    /**
     * Get all cards including soft-deleted (for sync)
     */
    getAllIncludingDeleted(): FSRSCardData[] {
        const rows = this.db.query<CardRow>(
            `SELECT ${CARD_SELECT_COLUMNS} FROM cards`
        );
        return rows.map(mapRowToCard);
    }

    // ===== Sync Operations =====

    /**
     * Get cards modified since a timestamp (including deleted, for sync push)
     */
    getModifiedSince(timestamp: number): (FSRSCardData & { updatedAt?: number; deletedAt?: number | null })[] {
        const rows = this.db.query<CardRow>(
            `SELECT ${CARD_SELECT_COLUMNS_FOR_SYNC} FROM cards WHERE updated_at > ?`,
            [timestamp]
        );
        return rows.map(mapRowToCardWithSync);
    }

    /**
     * Upsert a card from remote sync (preserves remote timestamps)
     */
    upsertFromRemote(data: FSRSCardData & { updatedAt?: number; deletedAt?: number | null }): void {
        this.db.run(`
            INSERT OR REPLACE INTO cards (
                id, due, stability, difficulty, reps, lapses, state,
                last_review, scheduled_days, learning_step, suspended,
                buried_until, created_at, updated_at, deleted_at,
                question, answer, source_uid
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
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
        ]);
    }

    /**
     * Get sync metadata from META table
     */
    getSyncMetadata(key: string): string | null {
        const row = this.db.get<{ value: string }>(
            `SELECT value FROM meta WHERE key = ?`,
            [key]
        );
        return row?.value ?? null;
    }

    /**
     * Set sync metadata in META table
     */
    setSyncMetadata(key: string, value: string): void {
        this.db.run(
            `INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`,
            [key, value]
        );
    }

    /**
     * Delete all cards (for force pull sync)
     */
    deleteAllForSync(): void {
        this.db.run(`DELETE FROM cards`);
    }

    // ===== FSRS Helper Operations =====

    /**
     * Get cards due within a date range
     * Used by FSRS Helper for workload balancing and forecasting
     */
    getDueCardsByDateRange(startDate: string, endDate: string): FSRSCardData[] {
        const rows = this.db.query<CardRow>(
            `SELECT ${CARD_SELECT_COLUMNS} FROM cards
             WHERE deleted_at IS NULL
               AND suspended = 0
               AND (buried_until IS NULL OR buried_until <= datetime('now'))
               AND date(due) BETWEEN ? AND ?
             ORDER BY due ASC`,
            [startDate, endDate]
        );
        return rows.map(mapRowToCard);
    }

    /**
     * Update only the due date for a card
     * Used by FSRS Helper scheduler services
     */
    updateCardDue(cardId: string, newDue: string): void {
        this.db.run(`
            UPDATE cards SET
                due = ?,
                updated_at = ?
            WHERE id = ?
        `, [newDue, Date.now(), cardId]);
    }

    /**
     * Update card scheduling data (due, scheduledDays)
     * Used by FSRS Helper reschedule service
     */
    updateCardScheduling(cardId: string, data: { due: string; scheduledDays: number }): void {
        this.db.run(`
            UPDATE cards SET
                due = ?,
                scheduled_days = ?,
                updated_at = ?
            WHERE id = ?
        `, [data.due, data.scheduledDays, Date.now(), cardId]);
    }
}
