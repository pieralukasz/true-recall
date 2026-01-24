/**
 * Browser Actions Module
 * Specialized queries for the Browser view
 *
 * This module keeps SqliteBrowserQueries functionality
 * but uses the new SqliteDatabase helper class
 */
import type { State } from "ts-fsrs";
import type { BrowserCardItem } from "types/browser.types";
import { SqliteDatabase } from "../SqliteDatabase";

// Database row type matching browser card queries
interface BrowserCardRow {
    id: string;
    due: string;
    stability: number;
    difficulty: number;
    reps: number;
    lapses: number;
    state: State;
    last_review: string | null;
    scheduled_days: number;
    learning_step: number;
    suspended: number;
    buried_until: string | null;
    created_at: number | null;
    question: string;
    answer: string;
    source_uid: string | null;
    source_note_name: string;
    source_note_path: string;
    projects: string | null;
}

/**
 * Browser-specific queries for the Browser view
 */
export class BrowserActions {
    constructor(private db: SqliteDatabase) {}

    /**
     * Get all cards with source note info and projects for browser view
     */
    getAllCardsForBrowser(): BrowserCardItem[] {
        const rows = this.db.query<BrowserCardRow>(`
            SELECT
                c.*,
                COALESCE(s.note_name, '') as source_note_name,
                COALESCE(s.note_path, '') as source_note_path,
                GROUP_CONCAT(DISTINCT p.name) as projects
            FROM cards c
            LEFT JOIN source_notes s ON c.source_uid = s.uid
            LEFT JOIN note_projects np ON s.uid = np.source_uid
            LEFT JOIN projects p ON np.project_id = p.id
            WHERE c.question IS NOT NULL AND c.answer IS NOT NULL
            GROUP BY c.id
            ORDER BY c.due ASC
        `);

        return rows.map((r) => this.mapRowToBrowserCard(r));
    }

    /**
     * Get unique projects from all cards
     */
    getUniqueProjects(): string[] {
        const rows = this.db.query<{ name: string }>(`
            SELECT DISTINCT p.name
            FROM projects p
            INNER JOIN note_projects np ON p.id = np.project_id
            ORDER BY p.name
        `);
        return rows.map((r) => r.name);
    }

    /**
     * Get unique source note names
     */
    getUniqueSourceNotes(): string[] {
        const rows = this.db.query<{ note_name: string }>(`
            SELECT DISTINCT s.note_name
            FROM source_notes s
            INNER JOIN cards c ON c.source_uid = s.uid
            WHERE c.question IS NOT NULL
            ORDER BY s.note_name
        `);
        return rows.map((r) => r.note_name);
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
            WHERE question IS NOT NULL AND answer IS NOT NULL
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
     * Bulk delete cards
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
     */
    getCard(cardId: string): BrowserCardItem | null {
        const row = this.db.get<BrowserCardRow>(`
            SELECT
                c.*,
                COALESCE(s.note_name, '') as source_note_name,
                COALESCE(s.note_path, '') as source_note_path,
                GROUP_CONCAT(DISTINCT p.name) as projects
            FROM cards c
            LEFT JOIN source_notes s ON c.source_uid = s.uid
            LEFT JOIN note_projects np ON s.uid = np.source_uid
            LEFT JOIN projects p ON np.project_id = p.id
            WHERE c.id = ?
            GROUP BY c.id
        `, [cardId]);

        return row ? this.mapRowToBrowserCard(row) : null;
    }

    // ===== Helper =====

    private mapRowToBrowserCard(row: BrowserCardRow): BrowserCardItem {
        // Parse projects from GROUP_CONCAT result
        const projectsRaw = row.projects;
        const projects = projectsRaw
            ? projectsRaw.split(",").filter((p) => p.trim())
            : [];

        return {
            id: row.id,
            due: row.due,
            stability: row.stability,
            difficulty: row.difficulty,
            reps: row.reps,
            lapses: row.lapses,
            state: row.state,
            lastReview: row.last_review ?? null,
            scheduledDays: row.scheduled_days,
            learningStep: row.learning_step,
            suspended: row.suspended === 1,
            buriedUntil: row.buried_until ?? undefined,
            createdAt: row.created_at ?? undefined,
            question: row.question,
            answer: row.answer,
            sourceUid: row.source_uid ?? undefined,
            sourceNoteName: row.source_note_name ?? "",
            sourceNotePath: row.source_note_path ?? "",
            projects,
        };
    }
}
