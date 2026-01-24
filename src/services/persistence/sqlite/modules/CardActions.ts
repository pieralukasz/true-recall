/**
 * Card Actions Module
 * CRUD operations for flashcard data
 *
 * Consolidates functionality from SqliteCardRepository
 */
import type { State } from "ts-fsrs";
import type { FSRSCardData } from "types";
import { SqliteDatabase } from "../SqliteDatabase";

// Database row type matching the cards table structure
interface CardRow {
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
    updated_at: number | null;
    question: string | null;
    answer: string | null;
    source_uid: string | null;
    // Optional JOIN columns
    source_note_name?: string;
    source_note_path?: string;
    projects?: string;
}

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
            `SELECT * FROM cards WHERE id = ?`,
            [cardId]
        );
        return row ? this.mapRowToCard(row) : undefined;
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
     * Delete a card
     */
    delete(cardId: string): void {
        this.db.run(`DELETE FROM cards WHERE id = ?`, [cardId]);
    }

    /**
     * Check if a card exists
     */
    has(cardId: string): boolean {
        const result = this.db.get<{ exists: number }>(
            `SELECT 1 as exists FROM cards WHERE id = ? LIMIT 1`,
            [cardId]
        );
        return result !== null;
    }

    /**
     * Get all card IDs
     */
    keys(): string[] {
        const rows = this.db.query<{ id: string }>(`SELECT id FROM cards`);
        return rows.map((r) => r.id);
    }

    /**
     * Get all cards
     */
    getAll(): FSRSCardData[] {
        const rows = this.db.query<CardRow>(`SELECT * FROM cards`);
        return rows.map((r) => this.mapRowToCard(r));
    }

    /**
     * Get total card count
     */
    size(): number {
        const result = this.db.get<{ count: number }>(
            `SELECT COUNT(*) as count FROM cards`
        );
        return result?.count ?? 0;
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
            `SELECT * FROM cards WHERE source_uid = ? ORDER BY created_at ASC, id ASC`,
            [sourceUid]
        );
        return rows.map((r) => this.mapRowToCard(r));
    }

    /**
     * Get all cards that have content (with source note JOIN and projects)
     */
    getCardsWithContent(): FSRSCardData[] {
        const rows = this.db.query<CardRow>(`
            SELECT c.*,
                   s.note_name as source_note_name,
                   s.note_path as source_note_path,
                   GROUP_CONCAT(p.name) as projects
            FROM cards c
            LEFT JOIN source_notes s ON c.source_uid = s.uid
            LEFT JOIN note_projects np ON s.uid = np.source_uid
            LEFT JOIN projects p ON np.project_id = p.id
            WHERE c.question IS NOT NULL AND c.answer IS NOT NULL
            GROUP BY c.id
        `);
        return rows.map((r) => this.mapRowToCard(r));
    }

    /**
     * Check if card has content
     */
    hasCardContent(cardId: string): boolean {
        const result = this.db.get<{ exists: number }>(
            `SELECT 1 as exists FROM cards
             WHERE id = ? AND question IS NOT NULL AND answer IS NOT NULL
             LIMIT 1`,
            [cardId]
        );
        return result !== null;
    }

    /**
     * Check if any cards have content
     */
    hasAnyCardContent(): boolean {
        const result = this.db.get<{ exists: number }>(
            `SELECT 1 as exists FROM cards
             WHERE question IS NOT NULL AND answer IS NOT NULL
             LIMIT 1`
        );
        return result !== null;
    }

    /**
     * Get count of cards with content
     */
    getCardsWithContentCount(): number {
        const result = this.db.get<{ count: number }>(
            `SELECT COUNT(*) as count FROM cards
             WHERE question IS NOT NULL AND answer IS NOT NULL`
        );
        return result?.count ?? 0;
    }

    // ===== Orphaned Cards Operations =====

    /**
     * Get all orphaned cards (cards without source_uid)
     */
    getOrphanedCards(): FSRSCardData[] {
        const rows = this.db.query<CardRow>(`
            SELECT * FROM cards
            WHERE source_uid IS NULL
            AND question IS NOT NULL AND answer IS NOT NULL
        `);
        return rows.map((r) => this.mapRowToCard(r));
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
        const result = this.db.get<{ id: string }>(
            `SELECT id FROM cards WHERE question = ? LIMIT 1`,
            [question]
        );
        return result?.id;
    }

    // ===== Helper =====

    /**
     * Convert database row to FSRSCardData
     */
    private mapRowToCard(row: CardRow): FSRSCardData {
        // Parse projects from GROUP_CONCAT result (comma-separated string)
        const projectsRaw = row.projects;
        let projects: string[] | undefined;
        if (projectsRaw) {
            projects = projectsRaw.split(",").filter((p) => p.trim());
        }

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
            question: row.question ?? undefined,
            answer: row.answer ?? undefined,
            sourceUid: row.source_uid ?? undefined,
            sourceNoteName: row.source_note_name ?? undefined,
            sourceNotePath: row.source_note_path ?? undefined,
            projects,
        };
    }
}
