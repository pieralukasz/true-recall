/**
 * Browser Actions Module
 * Specialized queries for the Browser view
 *
 * v15: Removed note_projects table, simplified source_notes (no name/path)
 * Source note names and projects are resolved from vault at runtime
 */
import type { BrowserCardItem } from "types/browser.types";
import { SqliteDatabase } from "../SqliteDatabase";

/**
 * Browser-specific queries for the Browser view
 * v15: No note_projects, source_notes has only uid
 */
export class BrowserActions {
    constructor(private db: SqliteDatabase) {}

    /**
     * Get all cards for browser view
     * v15: sourceNoteName, sourceNotePath, and projects are not populated from DB
     * They should be resolved from vault at runtime by the caller
     */
    getAllCardsForBrowser(): BrowserCardItem[] {
        return this.db.query<BrowserCardItem>(`
            SELECT
                c.id, c.due, c.stability, c.difficulty, c.reps, c.lapses, c.state,
                c.last_review as lastReview,
                c.scheduled_days as scheduledDays,
                c.learning_step as learningStep,
                c.suspended = 1 as suspended,
                c.buried_until as buriedUntil,
                c.created_at as createdAt,
                c.question, c.answer,
                c.source_uid as sourceUid,
                '' as sourceNoteName,
                '' as sourceNotePath
            FROM cards c
            WHERE c.deleted_at IS NULL AND c.question IS NOT NULL AND c.answer IS NOT NULL
            ORDER BY c.due ASC
        `).map(card => ({
            ...card,
            projects: [] // v15: Resolve from vault at runtime
        }));
    }

    /**
     * Get unique source note UIDs that have cards
     * v15: Returns UIDs only (names resolved from vault)
     */
    getUniqueSourceNoteUids(): string[] {
        const rows = this.db.query<{ source_uid: string }>(`
            SELECT DISTINCT c.source_uid
            FROM cards c
            WHERE c.deleted_at IS NULL
              AND c.question IS NOT NULL
              AND c.source_uid IS NOT NULL
            ORDER BY c.source_uid
        `);
        return rows.map((r) => r.source_uid);
    }

    /**
     * Get card counts by state
     */
    getCardCountsByState(): Record<string, number> {
        const now = new Date().toISOString();
        const row = this.db.get<{
            suspended: number;
            buried: number;
            new: number;
            learning: number;
            review: number;
            relearning: number;
        }>(`
            SELECT
                SUM(CASE WHEN suspended = 1 THEN 1 ELSE 0 END) as suspended,
                SUM(CASE WHEN suspended = 0 AND buried_until IS NOT NULL AND buried_until > ? THEN 1 ELSE 0 END) as buried,
                SUM(CASE WHEN suspended = 0 AND (buried_until IS NULL OR buried_until <= ?) AND state = 0 THEN 1 ELSE 0 END) as new,
                SUM(CASE WHEN suspended = 0 AND (buried_until IS NULL OR buried_until <= ?) AND state = 1 THEN 1 ELSE 0 END) as learning,
                SUM(CASE WHEN suspended = 0 AND (buried_until IS NULL OR buried_until <= ?) AND state = 2 THEN 1 ELSE 0 END) as review,
                SUM(CASE WHEN suspended = 0 AND (buried_until IS NULL OR buried_until <= ?) AND state = 3 THEN 1 ELSE 0 END) as relearning
            FROM cards
            WHERE deleted_at IS NULL AND question IS NOT NULL AND answer IS NOT NULL
        `, [now, now, now, now, now]);

        return {
            suspended: row?.suspended ?? 0,
            buried: row?.buried ?? 0,
            new: row?.new ?? 0,
            learning: row?.learning ?? 0,
            review: row?.review ?? 0,
            relearning: row?.relearning ?? 0,
        };
    }

    // ===== Bulk Operations =====

    /**
     * Bulk suspend cards
     */
    bulkSuspend(cardIds: string[]): number {
        if (cardIds.length === 0) return 0;

        const placeholders = cardIds.map(() => "?").join(",");
        const params = [Date.now(), ...cardIds] as [number, ...string[]];

        this.db.run(
            `UPDATE cards SET suspended = 1, updated_at = ? WHERE id IN (${placeholders})`,
            params
        );

        return this.db.getRowsModified();
    }

    /**
     * Bulk unsuspend cards
     */
    bulkUnsuspend(cardIds: string[]): number {
        if (cardIds.length === 0) return 0;

        const placeholders = cardIds.map(() => "?").join(",");
        const params = [Date.now(), ...cardIds] as [number, ...string[]];

        this.db.run(
            `UPDATE cards SET suspended = 0, updated_at = ? WHERE id IN (${placeholders})`,
            params
        );

        return this.db.getRowsModified();
    }

    /**
     * Bulk bury cards until a specific date
     */
    bulkBury(cardIds: string[], untilDate: string): number {
        if (cardIds.length === 0) return 0;

        const placeholders = cardIds.map(() => "?").join(",");
        const params = [untilDate, Date.now(), ...cardIds] as [string, number, ...string[]];

        this.db.run(
            `UPDATE cards SET buried_until = ?, updated_at = ? WHERE id IN (${placeholders})`,
            params
        );

        return this.db.getRowsModified();
    }

    /**
     * Bulk unbury cards
     */
    bulkUnbury(cardIds: string[]): number {
        if (cardIds.length === 0) return 0;

        const placeholders = cardIds.map(() => "?").join(",");
        const params = [Date.now(), ...cardIds] as [number, ...string[]];

        this.db.run(
            `UPDATE cards SET buried_until = NULL, updated_at = ? WHERE id IN (${placeholders})`,
            params
        );

        return this.db.getRowsModified();
    }

    /**
     * Bulk soft delete cards
     */
    bulkSoftDelete(cardIds: string[]): number {
        if (cardIds.length === 0) return 0;

        const now = Date.now();
        const placeholders = cardIds.map(() => "?").join(",");

        this.db.runMany([
            [`UPDATE review_log SET deleted_at = ?, updated_at = ? WHERE card_id IN (${placeholders})`, [now, now, ...cardIds]],
            [`UPDATE card_image_refs SET deleted_at = ?, updated_at = ? WHERE card_id IN (${placeholders})`, [now, now, ...cardIds]],
            [`UPDATE cards SET deleted_at = ?, updated_at = ? WHERE id IN (${placeholders})`, [now, now, ...cardIds]],
        ]);

        return cardIds.length;
    }

    /**
     * Bulk hard delete cards (for cleanup operations)
     * @deprecated Use bulkSoftDelete() instead for sync compatibility
     */
    bulkDelete(cardIds: string[]): number {
        if (cardIds.length === 0) return 0;

        const placeholders = cardIds.map(() => "?").join(",");

        // Use runMany for multiple operations
        this.db.runMany([
            [`DELETE FROM review_log WHERE card_id IN (${placeholders})`, cardIds],
            [`DELETE FROM card_image_refs WHERE card_id IN (${placeholders})`, cardIds],
            [`DELETE FROM cards WHERE id IN (${placeholders})`, cardIds],
        ]);

        return cardIds.length;
    }

    /**
     * Bulk reset cards to New state
     */
    bulkReset(cardIds: string[]): number {
        if (cardIds.length === 0) return 0;

        const placeholders = cardIds.map(() => "?").join(",");
        const now = new Date().toISOString();
        const params = [now, Date.now(), ...cardIds] as [string, number, ...string[]];

        this.db.run(`
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
        `, params);

        return this.db.getRowsModified();
    }

    /**
     * Bulk reschedule cards to a specific date
     */
    bulkReschedule(cardIds: string[], dueDate: string): number {
        if (cardIds.length === 0) return 0;

        const placeholders = cardIds.map(() => "?").join(",");
        const params = [dueDate, Date.now(), ...cardIds] as [string, number, ...string[]];

        this.db.run(
            `UPDATE cards SET due = ?, updated_at = ? WHERE id IN (${placeholders})`,
            params
        );

        return this.db.getRowsModified();
    }

    /**
     * Get card by ID (for preview)
     * v15: sourceNoteName, sourceNotePath, projects not populated from DB
     */
    getCard(cardId: string): BrowserCardItem | null {
        const row = this.db.get<Omit<BrowserCardItem, 'projects'>>(`
            SELECT
                c.id, c.due, c.stability, c.difficulty, c.reps, c.lapses, c.state,
                c.last_review as lastReview,
                c.scheduled_days as scheduledDays,
                c.learning_step as learningStep,
                c.suspended = 1 as suspended,
                c.buried_until as buriedUntil,
                c.created_at as createdAt,
                c.question, c.answer,
                c.source_uid as sourceUid,
                '' as sourceNoteName,
                '' as sourceNotePath
            FROM cards c
            WHERE c.deleted_at IS NULL AND c.id = ?
        `, [cardId]);

        return row ? { ...row, projects: [] } : null;
    }
}
