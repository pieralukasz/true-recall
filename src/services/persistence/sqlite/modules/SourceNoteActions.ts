/**
 * Image References Actions Module
 * Card image references operations
 *
 * v17: Removed source_notes table - source note metadata resolved from vault via flashcard_uid
 * v16: Removed projects table - projects are in frontmatter only
 */
import type { CardImageRef } from "types";
import { SqliteDatabase } from "../SqliteDatabase";
import { generateUUID } from "../sqlite.types";

/**
 * Card image ref with sync timestamps
 */
export interface CardImageRefForSync {
    id: string;
    cardId: string;
    imagePath: string;
    field: string;
    createdAt: number;
    updatedAt: number;
    deletedAt: number | null;
}

/**
 * Image references operations
 */
export class SourceNoteActions {
    constructor(private db: SqliteDatabase) {}

    // ===== Image References =====

    /**
     * Add a new image reference
     */
    addImageRef(ref: Omit<CardImageRef, "id">): void {
        const now = Date.now();
        const id = generateUUID();
        const createdAt = ref.createdAt ?? now;

        this.db.run(`
            INSERT INTO card_image_refs (id, card_id, image_path, field, created_at)
            VALUES (?, ?, ?, ?, ?)
        `, [id, ref.cardId, ref.imagePath, ref.field, createdAt]);
    }

    /**
     * Get all image references for a card
     */
    getImageRefsByCardId(cardId: string): CardImageRef[] {
        return this.db.query<CardImageRef>(`
            SELECT
                id,
                card_id as cardId,
                image_path as imagePath,
                field,
                created_at as createdAt
            FROM card_image_refs WHERE card_id = ? AND deleted_at IS NULL
        `, [cardId]);
    }

    /**
     * Get all cards that reference a specific image path
     */
    getCardsByImagePath(imagePath: string): CardImageRef[] {
        return this.db.query<CardImageRef>(`
            SELECT
                id,
                card_id as cardId,
                image_path as imagePath,
                field,
                created_at as createdAt
            FROM card_image_refs WHERE image_path = ? AND deleted_at IS NULL
        `, [imagePath]);
    }

    /**
     * Delete all image references for a card
     */
    deleteCardImageRefs(cardId: string): void {
        this.db.run(`
            UPDATE card_image_refs SET deleted_at = ?, updated_at = ? WHERE card_id = ?
        `, [Date.now(), Date.now(), cardId]);
    }

    /**
     * Update image path when image is renamed
     */
    updateImagePath(oldPath: string, newPath: string): void {
        this.db.run(`
            UPDATE card_image_refs SET image_path = ? WHERE image_path = ?
        `, [newPath, oldPath]);
    }

    /**
     * Sync image references for a card based on its current content
     */
    syncCardImageRefs(cardId: string, questionRefs: string[], answerRefs: string[]): void {
        // Soft delete existing refs for this card
        this.db.run(`
            UPDATE card_image_refs SET deleted_at = ?, updated_at = ? WHERE card_id = ?
        `, [Date.now(), Date.now(), cardId]);

        const now = Date.now();

        // Build statements for runMany
        const statements: Array<[string, string[]]> = [];

        // Add question refs
        for (const imagePath of questionRefs) {
            const id = generateUUID();
            statements.push([
                `INSERT INTO card_image_refs (id, card_id, image_path, field, created_at, updated_at) VALUES (?, ?, ?, 'question', ?, ?)`,
                [id, cardId, imagePath, String(now), String(now)]
            ]);
        }

        // Add answer refs
        for (const imagePath of answerRefs) {
            const id = generateUUID();
            statements.push([
                `INSERT INTO card_image_refs (id, card_id, image_path, field, created_at, updated_at) VALUES (?, ?, ?, 'answer', ?, ?)`,
                [id, cardId, imagePath, String(now), String(now)]
            ]);
        }

        if (statements.length > 0) {
            this.db.runMany(statements);
        }
    }

    /**
     * Get all unique image paths referenced by any card
     */
    getAllImagePaths(): string[] {
        const rows = this.db.query<{ image_path: string }>(
            `SELECT DISTINCT image_path FROM card_image_refs WHERE deleted_at IS NULL ORDER BY image_path`
        );
        return rows.map((r) => r.image_path);
    }

    /**
     * Count cards referencing a specific image
     */
    countCardsForImage(imagePath: string): number {
        const result = this.db.get<{ count: number }>(
            `SELECT COUNT(DISTINCT card_id) as count FROM card_image_refs WHERE image_path = ? AND deleted_at IS NULL`,
            [imagePath]
        );
        return result?.count ?? 0;
    }

    // ===== Sync Operations =====

    /**
     * Get card image refs modified since timestamp (for sync push)
     */
    getModifiedCardImageRefsSince(timestamp: number): CardImageRefForSync[] {
        return this.db.query<CardImageRefForSync>(`
            SELECT
                id,
                card_id as cardId,
                image_path as imagePath,
                field,
                created_at as createdAt,
                updated_at as updatedAt,
                deleted_at as deletedAt
            FROM card_image_refs
            WHERE updated_at > ?
        `, [timestamp]);
    }

    /**
     * Upsert card image ref from remote sync
     */
    upsertCardImageRefFromRemote(data: CardImageRefForSync): void {
        this.db.run(`
            INSERT OR REPLACE INTO card_image_refs (id, card_id, image_path, field, created_at, updated_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            data.id,
            data.cardId,
            data.imagePath,
            data.field,
            data.createdAt,
            data.updatedAt,
            data.deletedAt,
        ]);
    }

    /**
     * Get card image ref with sync fields (for LWW comparison)
     */
    getCardImageRefForSync(id: string): CardImageRefForSync | null {
        return this.db.get<CardImageRefForSync>(`
            SELECT
                id,
                card_id as cardId,
                image_path as imagePath,
                field,
                created_at as createdAt,
                updated_at as updatedAt,
                deleted_at as deletedAt
            FROM card_image_refs WHERE id = ?
        `, [id]);
    }

    /**
     * Delete all data (for force pull sync)
     * v17: No source_notes table (removed)
     * v16: No projects table (frontmatter only)
     */
    deleteAllForSync(): void {
        this.db.run(`DELETE FROM card_image_refs`);
    }
}
