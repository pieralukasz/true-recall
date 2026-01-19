/**
 * SQLite Image Refs Repository
 * Operations for tracking image references in flashcards
 */
import type { Database } from "sql.js";
import type { CardImageRef } from "../../../types";
import { getQueryResult } from "./sqlite.types";

/**
 * Repository for card image reference operations
 */
export class SqliteImageRefsRepo {
    private db: Database;
    private onDataChange: () => void;

    constructor(db: Database, onDataChange: () => void) {
        this.db = db;
        this.onDataChange = onDataChange;
    }

    /**
     * Add a new image reference
     */
    add(ref: Omit<CardImageRef, "id">): void {
        const now = Date.now();

        this.db.run(`
            INSERT INTO card_image_refs (card_id, image_path, field, created_at)
            VALUES (?, ?, ?, ?)
        `, [ref.cardId, ref.imagePath, ref.field, ref.createdAt ?? now]);

        this.onDataChange();
    }

    /**
     * Get all image references for a card
     */
    getByCardId(cardId: string): CardImageRef[] {
        const result = this.db.exec(`
            SELECT * FROM card_image_refs WHERE card_id = ?
        `, [cardId]);

        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map((row) => this.rowToCardImageRef(data.columns, row));
    }

    /**
     * Get all cards that reference a specific image path
     */
    getByImagePath(imagePath: string): CardImageRef[] {
        const result = this.db.exec(`
            SELECT * FROM card_image_refs WHERE image_path = ?
        `, [imagePath]);

        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map((row) => this.rowToCardImageRef(data.columns, row));
    }

    /**
     * Delete all image references for a card
     */
    deleteByCardId(cardId: string): void {
        this.db.run(`DELETE FROM card_image_refs WHERE card_id = ?`, [cardId]);
        this.onDataChange();
    }

    /**
     * Update image path when image is renamed
     */
    updateImagePath(oldPath: string, newPath: string): void {
        this.db.run(`
            UPDATE card_image_refs SET image_path = ? WHERE image_path = ?
        `, [newPath, oldPath]);
        this.onDataChange();
    }

    /**
     * Sync image references for a card based on its current content
     * Removes old refs and adds new ones
     */
    syncCardRefs(cardId: string, questionRefs: string[], answerRefs: string[]): void {
        // Delete existing refs for this card
        this.db.run(`DELETE FROM card_image_refs WHERE card_id = ?`, [cardId]);

        const now = Date.now();

        // Add question refs
        for (const imagePath of questionRefs) {
            this.db.run(`
                INSERT INTO card_image_refs (card_id, image_path, field, created_at)
                VALUES (?, ?, 'question', ?)
            `, [cardId, imagePath, now]);
        }

        // Add answer refs
        for (const imagePath of answerRefs) {
            this.db.run(`
                INSERT INTO card_image_refs (card_id, image_path, field, created_at)
                VALUES (?, ?, 'answer', ?)
            `, [cardId, imagePath, now]);
        }

        this.onDataChange();
    }

    /**
     * Get all unique image paths referenced by any card
     */
    getAllImagePaths(): string[] {
        const result = this.db.exec(`
            SELECT DISTINCT image_path FROM card_image_refs ORDER BY image_path
        `);

        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map((row) => row[0] as string);
    }

    /**
     * Count cards referencing a specific image
     */
    countCardsForImage(imagePath: string): number {
        const result = this.db.exec(`
            SELECT COUNT(DISTINCT card_id) as count FROM card_image_refs WHERE image_path = ?
        `, [imagePath]);

        const data = getQueryResult(result);
        if (!data || data.values.length === 0) return 0;

        return data.values[0]![0] as number;
    }

    // ===== Helper =====

    private rowToCardImageRef(columns: string[], row: (string | number | null | Uint8Array)[]): CardImageRef {
        const getCol = (name: string) => {
            const idx = columns.indexOf(name);
            return idx >= 0 ? row[idx] : null;
        };

        return {
            id: getCol("id") as number,
            cardId: getCol("card_id") as string,
            imagePath: getCol("image_path") as string,
            field: getCol("field") as "question" | "answer",
            createdAt: getCol("created_at") as number | undefined,
        };
    }
}
