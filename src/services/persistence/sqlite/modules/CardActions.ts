/**
 * Card Actions Module
 * CRUD operations for flashcard data
 *
 * Uses SQL column aliases to map directly to FSRSCardData interface
 * No manual row mapping needed - `query<FSRSCardData>()` returns correctly typed objects
 */
import type { State } from "ts-fsrs";
import type { FSRSCardData } from "types";
import { SqliteDatabase } from "../SqliteDatabase";

/**
 * Card CRUD operations
 */
export class CardActions {
    constructor(private db: SqliteDatabase) {}

    /**
     * Get a card by ID
     */
    get(cardId: string): FSRSCardData | undefined {
        const row = this.db.get<{
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
            updatedAt: number | null;
            question: string | null;
            answer: string | null;
            sourceUid: string | null;
        }>(`
            SELECT
                id, due, stability, difficulty, reps, lapses, state,
                last_review as lastReview,
                scheduled_days as scheduledDays,
                learning_step as learningStep,
                suspended = 1 as suspended,
                buried_until as buriedUntil,
                created_at as createdAt,
                updated_at as updatedAt,
                question,
                answer,
                source_uid as sourceUid
            FROM cards WHERE id = ? AND deleted_at IS NULL
        `, [cardId]);

        if (!row) return undefined;
        if (!row.question || !row.answer) return undefined;

        const { question: q, answer: a, suspended, buriedUntil, createdAt, updatedAt, sourceUid, ...rest } = row;
        return {
            ...rest,
            question: q,
            answer: a,
            suspended: suspended === 1,
            buriedUntil: buriedUntil ?? undefined,
            createdAt: createdAt ?? undefined,
            updatedAt: updatedAt ?? undefined,
            sourceUid: sourceUid ?? undefined,
        };
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
        const rows = this.db.query<{
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
            question: string | null;
            answer: string | null;
            sourceUid: string | null;
        }>(`
            SELECT
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
            FROM cards WHERE deleted_at IS NULL
        `);

        return rows.map((row) => {
            const { question: q, answer: a, suspended, buriedUntil, createdAt, sourceUid, ...rest } = row;
            return {
                ...rest,
                question: q ?? undefined,
                answer: a ?? undefined,
                suspended: suspended === 1,
                buriedUntil: buriedUntil ?? undefined,
                createdAt: createdAt ?? undefined,
                sourceUid: sourceUid ?? undefined,
            };
        });
    }

    /**
     * Get total card count
     */
    size(): number {
        return this.db.get<{ count: number }>(
            `SELECT COUNT(*) as count FROM cards WHERE deleted_at IS NULL`
        )?.count ?? 0;
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
        const rows = this.db.query<{
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
            question: string | null;
            answer: string | null;
            sourceUid: string | null;
        }>(`
            SELECT
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
            FROM cards
            WHERE source_uid = ? AND deleted_at IS NULL
            ORDER BY created_at ASC, id ASC
        `, [sourceUid]);

        return rows.map((row) => {
            const { question: q, answer: a, suspended, buriedUntil, createdAt, sourceUid, ...rest } = row;
            return {
                ...rest,
                question: q ?? undefined,
                answer: a ?? undefined,
                suspended: suspended === 1,
                buriedUntil: buriedUntil ?? undefined,
                createdAt: createdAt ?? undefined,
                sourceUid: sourceUid ?? undefined,
            };
        });
    }

    /**
     * Get all cards that have content (with source note JOIN and projects)
     */
    /**
     * Get all cards with content (v15: no note_projects, source_notes has only uid)
     * Source note name/path and projects are resolved at runtime from vault
     */
    getCardsWithContent(): FSRSCardData[] {
        const rows = this.db.query<{
            id: string;
            due: string;
            stability: number;
            difficulty: number;
            reps: number;
            lapses: number;
            state: State;
            lastReview: string | null;
            scheduledDays: number;
            learningStep: number;
            suspended: boolean;
            buriedUntil: string | null;
            createdAt: number | null;
            question: string;
            answer: string;
            sourceUid: string | null;
        }>(`
            SELECT
                c.id, c.due, c.stability, c.difficulty, c.reps, c.lapses, c.state,
                c.last_review as lastReview,
                c.scheduled_days as scheduledDays,
                c.learning_step as learningStep,
                c.suspended = 1 as suspended,
                c.buried_until as buriedUntil,
                c.created_at as createdAt,
                c.question, c.answer,
                c.source_uid as sourceUid
            FROM cards c
            WHERE c.deleted_at IS NULL AND c.question IS NOT NULL AND c.answer IS NOT NULL
        `);

        // v15: sourceNoteName, sourceNotePath, projects are resolved at runtime from vault
        return rows.map((row) => ({
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
            suspended: row.suspended,
            buriedUntil: row.buriedUntil ?? undefined,
            createdAt: row.createdAt ?? undefined,
            question: row.question,
            answer: row.answer,
            sourceUid: row.sourceUid ?? undefined,
            // v15: These are resolved at runtime from vault, not from DB
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
             WHERE id = ? AND deleted_at IS NULL AND question IS NOT NULL AND answer IS NOT NULL
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
             WHERE deleted_at IS NULL AND question IS NOT NULL AND answer IS NOT NULL
             LIMIT 1`
        ) !== null;
    }

    /**
     * Get count of cards with content
     */
    getCardsWithContentCount(): number {
        return this.db.get<{ count: number }>(
            `SELECT COUNT(*) as count FROM cards
             WHERE deleted_at IS NULL AND question IS NOT NULL AND answer IS NOT NULL`
        )?.count ?? 0;
    }

    // ===== Orphaned Cards Operations =====

    /**
     * Get all orphaned cards (cards without source_uid)
     */
    getOrphanedCards(): FSRSCardData[] {
        const rows = this.db.query<{
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
            question: string | null;
            answer: string | null;
            sourceUid: string | null;
        }>(`
            SELECT
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
            FROM cards
            WHERE deleted_at IS NULL AND source_uid IS NULL
            AND question IS NOT NULL AND answer IS NOT NULL
        `);

        return rows.map((row) => {
            const { question: q, answer: a, suspended, buriedUntil, createdAt, sourceUid, ...rest } = row;
            return {
                ...rest,
                question: q ?? undefined,
                answer: a ?? undefined,
                suspended: suspended === 1,
                buriedUntil: buriedUntil ?? undefined,
                createdAt: createdAt ?? undefined,
                sourceUid: sourceUid ?? undefined,
            };
        });
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
            this.db.run(
                `UPDATE card_image_refs SET deleted_at = ?, updated_at = ? WHERE card_id = ?`,
                [now, now, cardId]
            );
        });
    }

    /**
     * Get all cards including soft-deleted (for sync)
     */
    getAllIncludingDeleted(): FSRSCardData[] {
        const rows = this.db.query<{
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
            question: string | null;
            answer: string | null;
            sourceUid: string | null;
        }>(`
            SELECT
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
            FROM cards
        `);

        return rows.map((row) => {
            const { question: q, answer: a, suspended, buriedUntil, createdAt, sourceUid, ...rest } = row;
            return {
                ...rest,
                question: q ?? undefined,
                answer: a ?? undefined,
                suspended: suspended === 1,
                buriedUntil: buriedUntil ?? undefined,
                createdAt: createdAt ?? undefined,
                sourceUid: sourceUid ?? undefined,
            };
        });
    }

    // ===== Sync Operations =====

    /**
     * Get cards modified since a timestamp (including deleted, for sync push)
     */
    getModifiedSince(timestamp: number): (FSRSCardData & { updatedAt?: number; deletedAt?: number | null })[] {
        const rows = this.db.query<{
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
            updatedAt: number | null;
            deletedAt: number | null;
            question: string | null;
            answer: string | null;
            sourceUid: string | null;
        }>(`
            SELECT
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
            FROM cards
            WHERE updated_at > ?
        `, [timestamp]);

        return rows.map((row) => {
            const { question: q, answer: a, suspended, buriedUntil, createdAt, updatedAt, deletedAt, sourceUid, ...rest } = row;
            return {
                ...rest,
                question: q ?? undefined,
                answer: a ?? undefined,
                suspended: suspended === 1,
                buriedUntil: buriedUntil ?? undefined,
                createdAt: createdAt ?? undefined,
                updatedAt: updatedAt ?? undefined,
                deletedAt: deletedAt,
                sourceUid: sourceUid ?? undefined,
            };
        });
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
}
