/**
 * SQLite Card Repository
 * CRUD operations for flashcard data
 */
import type { Database } from "sql.js";
import type { State } from "ts-fsrs";
import type { FSRSCardData } from "../../../types";
import { getQueryResult, type SqlRow } from "./sqlite.types";

/**
 * Repository for card CRUD operations
 */
export class SqliteCardRepository {
    private db: Database;
    private onDataChange: () => void;

    constructor(db: Database, onDataChange: () => void) {
        this.db = db;
        this.onDataChange = onDataChange;
    }

    /**
     * Get a card by ID
     */
    get(cardId: string): FSRSCardData | undefined {
        const result = this.db.exec(
            `SELECT * FROM cards WHERE id = ?`,
            [cardId]
        );

        const data = getQueryResult(result);
        if (!data) return undefined;

        return this.rowToFSRSCardData(data.columns, data.values[0]!);
    }

    /**
     * Set/update a card
     */
    set(cardId: string, data: FSRSCardData): void {
        const now = Date.now();

        // Preserve original created_at for existing cards
        let createdAt = data.createdAt;
        if (!createdAt) {
            const existing = this.db.exec(
                `SELECT created_at FROM cards WHERE id = ?`,
                [cardId]
            );
            const firstResult = existing[0];
            const firstRow = firstResult?.values[0];
            if (firstRow && firstRow[0] != null) {
                createdAt = firstRow[0] as number;
            }
        }
        createdAt = createdAt || now;

        this.db.run(`
            INSERT OR REPLACE INTO cards (
                id, due, stability, difficulty, reps, lapses, state,
                last_review, scheduled_days, learning_step, suspended,
                buried_until, created_at, updated_at,
                question, answer, source_uid, tags
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            cardId,
            data.due,
            data.stability,
            data.difficulty,
            data.reps,
            data.lapses,
            data.state,
            data.lastReview,
            data.scheduledDays,
            data.learningStep,
            data.suspended ? 1 : 0,
            data.buriedUntil || null,
            createdAt,
            now,
            data.question || null,
            data.answer || null,
            data.sourceUid || null,
            data.tags ? JSON.stringify(data.tags) : null,
        ]);

        this.onDataChange();
    }

    /**
     * Delete a card
     */
    delete(cardId: string): void {
        this.db.run(`DELETE FROM cards WHERE id = ?`, [cardId]);
        this.onDataChange();
    }

    /**
     * Check if a card exists
     */
    has(cardId: string): boolean {
        const result = this.db.exec(
            `SELECT 1 FROM cards WHERE id = ? LIMIT 1`,
            [cardId]
        );
        return getQueryResult(result) !== null;
    }

    /**
     * Get all card IDs
     */
    keys(): string[] {
        const result = this.db.exec(`SELECT id FROM cards`);
        const data = getQueryResult(result);
        if (!data) return [];
        return data.values.map((row) => row[0] as string);
    }

    /**
     * Get all cards
     */
    getAll(): FSRSCardData[] {
        const result = this.db.exec(`SELECT * FROM cards`);
        const data = getQueryResult(result);
        if (!data) return [];
        return data.values.map((row) =>
            this.rowToFSRSCardData(data.columns, row)
        );
    }

    /**
     * Get total card count
     */
    size(): number {
        const result = this.db.exec(`SELECT COUNT(*) FROM cards`);
        const data = getQueryResult(result);
        if (!data) return 0;
        return data.values[0]![0] as number;
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

        this.onDataChange();
    }

    /**
     * Get cards by source note UID
     */
    getCardsBySourceUid(sourceUid: string): FSRSCardData[] {
        const result = this.db.exec(`
            SELECT * FROM cards WHERE source_uid = ?
            ORDER BY created_at ASC, id ASC
        `, [sourceUid]);

        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map((row) =>
            this.rowToFSRSCardData(data.columns, row)
        );
    }

    /**
     * Get all cards that have content (with source note JOIN and projects)
     */
    getCardsWithContent(): FSRSCardData[] {
        const result = this.db.exec(`
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

        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map((row) =>
            this.rowToFSRSCardData(data.columns, row)
        );
    }

    /**
     * Check if card has content
     */
    hasCardContent(cardId: string): boolean {
        const result = this.db.exec(`
            SELECT 1 FROM cards
            WHERE id = ? AND question IS NOT NULL AND answer IS NOT NULL
            LIMIT 1
        `, [cardId]);

        return getQueryResult(result) !== null;
    }

    /**
     * Check if any cards have content
     */
    hasAnyCardContent(): boolean {
        const result = this.db.exec(`
            SELECT 1 FROM cards
            WHERE question IS NOT NULL AND answer IS NOT NULL
            LIMIT 1
        `);

        return getQueryResult(result) !== null;
    }

    /**
     * Get count of cards with content
     */
    getCardsWithContentCount(): number {
        const result = this.db.exec(`
            SELECT COUNT(*) FROM cards
            WHERE question IS NOT NULL AND answer IS NOT NULL
        `);

        const data = getQueryResult(result);
        return data ? (data.values[0]![0] as number) : 0;
    }

    // ===== Orphaned Cards Operations =====

    /**
     * Get all orphaned cards (cards without source_uid)
     */
    getOrphanedCards(): FSRSCardData[] {
        const result = this.db.exec(`
            SELECT * FROM cards
            WHERE source_uid IS NULL
            AND question IS NOT NULL AND answer IS NOT NULL
        `);

        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map((row) =>
            this.rowToFSRSCardData(data.columns, row)
        );
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

        this.onDataChange();
    }

    /**
     * Get card ID by exact question match
     * Returns the card ID if found, undefined otherwise
     */
    getCardIdByQuestion(question: string): string | undefined {
        const result = this.db.exec(
            `SELECT id FROM cards WHERE question = ? LIMIT 1`,
            [question]
        );
        const firstResult = result[0];
        if (!firstResult) return undefined;
        const firstRow = firstResult.values[0];
        if (firstRow && firstRow[0] != null) {
            return firstRow[0] as string;
        }
        return undefined;
    }

    // ===== Helper =====

    /**
     * Convert database row to FSRSCardData
     */
    rowToFSRSCardData(columns: string[], values: SqlRow): FSRSCardData {
        const getCol = (name: string) => {
            const idx = columns.indexOf(name);
            return idx >= 0 ? values[idx] : null;
        };

        const tagsRaw = getCol("tags") as string | null;
        let tags: string[] | undefined;
        if (tagsRaw) {
            try {
                tags = JSON.parse(tagsRaw);
            } catch {
                tags = undefined;
            }
        }

        // Parse projects from GROUP_CONCAT result (comma-separated string)
        const projectsRaw = getCol("projects") as string | null;
        let projects: string[] | undefined;
        if (projectsRaw) {
            projects = projectsRaw.split(",").filter(p => p.trim());
        }

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
            question: getCol("question") as string | undefined,
            answer: getCol("answer") as string | undefined,
            sourceUid: getCol("source_uid") as string | undefined,
            sourceNoteName: getCol("source_note_name") as string | undefined,
            sourceNotePath: getCol("source_note_path") as string | undefined,
            projects,
            tags,
        };
    }
}
