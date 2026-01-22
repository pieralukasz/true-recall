/**
 * SQLite Browser Queries
 * Specialized queries for the Browser view
 */
import type { State } from "ts-fsrs";
import type { BrowserCardItem } from "../../../types/browser.types";
import { getQueryResult, type SqlRow, type DatabaseLike } from "./sqlite.types";

/**
 * Repository for browser-specific queries
 */
export class SqliteBrowserQueries {
    private db: DatabaseLike;
    private onDataChange: () => void;

    constructor(db: DatabaseLike, onDataChange: () => void) {
        this.db = db;
        this.onDataChange = onDataChange;
    }

    /**
     * Get all cards with source note info and projects for browser view
     */
    getAllCardsForBrowser(): BrowserCardItem[] {
        const result = this.db.exec(`
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

        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map(row => this.rowToBrowserCardItem(data.columns, row));
    }

    /**
     * Get unique projects from all cards
     */
    getUniqueProjects(): string[] {
        const result = this.db.exec(`
            SELECT DISTINCT p.name
            FROM projects p
            INNER JOIN note_projects np ON p.id = np.project_id
            ORDER BY p.name
        `);

        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map(row => row[0] as string);
    }

    /**
     * Get unique source note names
     */
    getUniqueSourceNotes(): string[] {
        const result = this.db.exec(`
            SELECT DISTINCT s.note_name
            FROM source_notes s
            INNER JOIN cards c ON c.source_uid = s.uid
            WHERE c.question IS NOT NULL
            ORDER BY s.note_name
        `);

        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map(row => row[0] as string);
    }

    /**
     * Get card counts by state
     */
    getCardCountsByState(): Record<string, number> {
        const now = new Date().toISOString();
        const result = this.db.exec(`
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

        const data = getQueryResult(result);
        if (!data || !data.values[0]) {
            return {
                suspended: 0,
                buried: 0,
                new: 0,
                learning: 0,
                review: 0,
                relearning: 0,
            };
        }

        const row = data.values[0];
        return {
            suspended: (row[0] as number) || 0,
            buried: (row[1] as number) || 0,
            new: (row[2] as number) || 0,
            learning: (row[3] as number) || 0,
            review: (row[4] as number) || 0,
            relearning: (row[5] as number) || 0,
        };
    }

    // ===== Bulk Operations =====

    /**
     * Bulk suspend cards
     */
    bulkSuspend(cardIds: string[]): number {
        if (cardIds.length === 0) return 0;

        const placeholders = cardIds.map(() => "?").join(",");
        const result = this.db.exec(`
            UPDATE cards SET suspended = 1, updated_at = ?
            WHERE id IN (${placeholders})
        `, [Date.now(), ...cardIds]);

        this.onDataChange();
        return this.db.getRowsModified();
    }

    /**
     * Bulk unsuspend cards
     */
    bulkUnsuspend(cardIds: string[]): number {
        if (cardIds.length === 0) return 0;

        const placeholders = cardIds.map(() => "?").join(",");
        this.db.exec(`
            UPDATE cards SET suspended = 0, updated_at = ?
            WHERE id IN (${placeholders})
        `, [Date.now(), ...cardIds]);

        this.onDataChange();
        return this.db.getRowsModified();
    }

    /**
     * Bulk bury cards until a specific date
     */
    bulkBury(cardIds: string[], untilDate: string): number {
        if (cardIds.length === 0) return 0;

        const placeholders = cardIds.map(() => "?").join(",");
        this.db.exec(`
            UPDATE cards SET buried_until = ?, updated_at = ?
            WHERE id IN (${placeholders})
        `, [untilDate, Date.now(), ...cardIds]);

        this.onDataChange();
        return this.db.getRowsModified();
    }

    /**
     * Bulk unbury cards
     */
    bulkUnbury(cardIds: string[]): number {
        if (cardIds.length === 0) return 0;

        const placeholders = cardIds.map(() => "?").join(",");
        this.db.exec(`
            UPDATE cards SET buried_until = NULL, updated_at = ?
            WHERE id IN (${placeholders})
        `, [Date.now(), ...cardIds]);

        this.onDataChange();
        return this.db.getRowsModified();
    }

    /**
     * Bulk delete cards
     */
    bulkDelete(cardIds: string[]): number {
        if (cardIds.length === 0) return 0;

        const placeholders = cardIds.map(() => "?").join(",");

        // First delete review logs
        this.db.exec(`DELETE FROM review_log WHERE card_id IN (${placeholders})`, cardIds);

        // Then delete image refs
        this.db.exec(`DELETE FROM card_image_refs WHERE card_id IN (${placeholders})`, cardIds);

        // Finally delete cards
        this.db.exec(`DELETE FROM cards WHERE id IN (${placeholders})`, cardIds);

        this.onDataChange();
        return this.db.getRowsModified();
    }

    /**
     * Bulk reset cards to New state
     */
    bulkReset(cardIds: string[]): number {
        if (cardIds.length === 0) return 0;

        const placeholders = cardIds.map(() => "?").join(",");
        const now = new Date().toISOString();

        this.db.exec(`
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
        `, [now, Date.now(), ...cardIds]);

        this.onDataChange();
        return this.db.getRowsModified();
    }

    /**
     * Bulk reschedule cards to a specific date
     */
    bulkReschedule(cardIds: string[], dueDate: string): number {
        if (cardIds.length === 0) return 0;

        const placeholders = cardIds.map(() => "?").join(",");
        this.db.exec(`
            UPDATE cards SET due = ?, updated_at = ?
            WHERE id IN (${placeholders})
        `, [dueDate, Date.now(), ...cardIds]);

        this.onDataChange();
        return this.db.getRowsModified();
    }

    /**
     * Get card by ID (for preview)
     */
    getCard(cardId: string): BrowserCardItem | null {
        const result = this.db.exec(`
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

        const data = getQueryResult(result);
        if (!data || !data.values[0]) return null;

        return this.rowToBrowserCardItem(data.columns, data.values[0]);
    }

    // ===== Helper Methods =====

    /**
     * Convert database row to BrowserCardItem
     */
    private rowToBrowserCardItem(columns: string[], values: SqlRow): BrowserCardItem {
        const getCol = (name: string) => {
            const idx = columns.indexOf(name);
            return idx >= 0 ? values[idx] : null;
        };

        // Parse projects
        const projectsRaw = getCol("projects") as string | null;
        const projects = projectsRaw
            ? projectsRaw.split(",").filter(p => p.trim())
            : [];

        return {
            id: getCol("id") as string,
            due: getCol("due") as string,
            stability: getCol("stability") as number,
            difficulty: getCol("difficulty") as number,
            reps: getCol("reps") as number,
            lapses: getCol("lapses") as number,
            state: getCol("state") as State,
            lastReview: getCol("last_review") as string | null,
            scheduledDays: getCol("scheduled_days") as number,
            learningStep: getCol("learning_step") as number,
            suspended: getCol("suspended") === 1,
            buriedUntil: getCol("buried_until") as string | undefined,
            createdAt: getCol("created_at") as number | undefined,
            question: getCol("question") as string,
            answer: getCol("answer") as string,
            sourceUid: getCol("source_uid") as string | undefined,
            sourceNoteName: getCol("source_note_name") as string || "",
            sourceNotePath: getCol("source_note_path") as string || "",
            projects,
        };
    }
}
