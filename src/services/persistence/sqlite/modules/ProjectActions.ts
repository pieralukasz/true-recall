/**
 * Project Actions Module
 * Projects, source notes, and image references operations
 *
 * v15: Removed note_projects table, simplified source_notes (no name/path)
 * Projects are now read from frontmatter (source of truth)
 */
import type { ProjectInfo, CardImageRef } from "types";
import { SqliteDatabase } from "../SqliteDatabase";
import { generateUUID } from "../sqlite.types";

/**
 * Source note with sync timestamps (v15: simplified, no name/path)
 */
export interface SourceNoteForSync {
    uid: string;
    createdAt: number;
    updatedAt: number;
    deletedAt: number | null;
}

/**
 * Project with sync timestamps
 */
export interface ProjectForSync {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    deletedAt: number | null;
}

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
 * Simplified source note info (v15: only UID + timestamps)
 */
export interface SourceNoteInfo {
    uid: string;
    createdAt?: number;
    updatedAt?: number;
}

/**
 * Projects, source notes, and image references operations
 */
export class ProjectActions {
    constructor(private db: SqliteDatabase) {}

    // ===== Source Notes =====

    /**
     * Insert or update a source note (v15: only uid + timestamps)
     */
    upsertSourceNote(uid: string): void {
        const now = Date.now();

        this.db.run(`
            INSERT INTO source_notes (uid, created_at, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(uid) DO UPDATE SET
                updated_at = excluded.updated_at
        `, [uid, now, now]);
    }

    /**
     * Get a source note by UID
     */
    getSourceNote(uid: string): SourceNoteInfo | null {
        return this.db.get<SourceNoteInfo>(`
            SELECT
                uid,
                created_at as createdAt,
                updated_at as updatedAt
            FROM source_notes WHERE uid = ? AND deleted_at IS NULL
        `, [uid]);
    }

    /**
     * Get all source notes
     */
    getAllSourceNotes(): SourceNoteInfo[] {
        return this.db.query<SourceNoteInfo>(`
            SELECT
                uid,
                created_at as createdAt,
                updated_at as updatedAt
            FROM source_notes WHERE deleted_at IS NULL
        `);
    }

    /**
     * Delete source note and optionally detach cards
     */
    deleteSourceNote(uid: string, detachCards = true): void {
        if (detachCards) {
            this.db.run(`
                UPDATE cards SET source_uid = NULL, updated_at = ? WHERE source_uid = ?
            `, [Date.now(), uid]);
        }

        this.db.run(`
            UPDATE source_notes SET deleted_at = ?, updated_at = ? WHERE uid = ?
        `, [Date.now(), Date.now(), uid]);
    }

    // ===== Projects =====

    /**
     * Create a new project
     */
    createProject(name: string): string {
        const existing = this.getProjectByName(name);
        if (existing) {
            return existing.id;
        }

        const projectId = generateUUID();
        const now = Date.now();

        this.db.run(`
            INSERT INTO projects (id, name, created_at, updated_at)
            VALUES (?, ?, ?, ?)
        `, [projectId, name, now, now]);

        return projectId;
    }

    /**
     * Get a project by name (v15: no note_projects JOIN)
     */
    getProjectByName(name: string): ProjectInfo | null {
        return this.db.get<ProjectInfo>(`
            SELECT
                id,
                name,
                created_at as createdAt,
                updated_at as updatedAt,
                0 as cardCount,
                0 as dueCount,
                0 as newCount
            FROM projects
            WHERE name = ? AND deleted_at IS NULL
        `, [name]);
    }

    /**
     * Get a project by ID (v15: no note_projects JOIN)
     */
    getProjectById(id: string): ProjectInfo | null {
        return this.db.get<ProjectInfo>(`
            SELECT
                id,
                name,
                created_at as createdAt,
                updated_at as updatedAt,
                0 as cardCount,
                0 as dueCount,
                0 as newCount
            FROM projects
            WHERE id = ? AND deleted_at IS NULL
        `, [id]);
    }

    /**
     * Get all projects (v15: no note_projects JOIN, counts populated elsewhere)
     */
    getAllProjects(): ProjectInfo[] {
        return this.db.query<ProjectInfo>(`
            SELECT
                id,
                name,
                created_at as createdAt,
                updated_at as updatedAt,
                0 as cardCount,
                0 as dueCount,
                0 as newCount
            FROM projects
            WHERE deleted_at IS NULL
            ORDER BY name
        `);
    }

    /**
     * Rename a project
     */
    renameProject(id: string, newName: string): void {
        this.db.run(`
            UPDATE projects SET
                name = ?,
                updated_at = ?
            WHERE id = ?
        `, [newName, Date.now(), id]);
    }

    /**
     * Delete a project
     */
    deleteProject(id: string): void {
        this.db.run(`
            UPDATE projects SET deleted_at = ?, updated_at = ? WHERE id = ?
        `, [Date.now(), Date.now(), id]);
    }

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
     * Get source notes modified since timestamp (for sync push)
     * v15: No name/path fields
     */
    getModifiedSourceNotesSince(timestamp: number): SourceNoteForSync[] {
        return this.db.query<SourceNoteForSync>(`
            SELECT
                uid,
                created_at as createdAt,
                updated_at as updatedAt,
                deleted_at as deletedAt
            FROM source_notes
            WHERE updated_at > ?
        `, [timestamp]);
    }

    /**
     * Upsert source note from remote sync (v15: no name/path)
     */
    upsertSourceNoteFromRemote(data: SourceNoteForSync): void {
        this.db.run(`
            INSERT OR REPLACE INTO source_notes (uid, created_at, updated_at, deleted_at)
            VALUES (?, ?, ?, ?)
        `, [
            data.uid,
            data.createdAt,
            data.updatedAt,
            data.deletedAt,
        ]);
    }

    /**
     * Get source note with sync fields (for LWW comparison)
     */
    getSourceNoteForSync(uid: string): SourceNoteForSync | null {
        return this.db.get<SourceNoteForSync>(`
            SELECT
                uid,
                created_at as createdAt,
                updated_at as updatedAt,
                deleted_at as deletedAt
            FROM source_notes WHERE uid = ?
        `, [uid]);
    }

    /**
     * Get projects modified since timestamp (for sync push)
     */
    getModifiedProjectsSince(timestamp: number): ProjectForSync[] {
        return this.db.query<ProjectForSync>(`
            SELECT
                id,
                name,
                created_at as createdAt,
                updated_at as updatedAt,
                deleted_at as deletedAt
            FROM projects
            WHERE updated_at > ?
        `, [timestamp]);
    }

    /**
     * Upsert project from remote sync
     */
    upsertProjectFromRemote(data: ProjectForSync): void {
        this.db.run(`
            INSERT OR REPLACE INTO projects (id, name, created_at, updated_at, deleted_at)
            VALUES (?, ?, ?, ?, ?)
        `, [
            data.id,
            data.name,
            data.createdAt,
            data.updatedAt,
            data.deletedAt,
        ]);
    }

    /**
     * Get project with sync fields (for LWW comparison)
     */
    getProjectForSync(id: string): ProjectForSync | null {
        return this.db.get<ProjectForSync>(`
            SELECT
                id,
                name,
                created_at as createdAt,
                updated_at as updatedAt,
                deleted_at as deletedAt
            FROM projects WHERE id = ?
        `, [id]);
    }

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
     * Delete all project-related data (for force pull sync)
     * v15: No note_projects table
     */
    deleteAllForSync(): void {
        this.db.run(`DELETE FROM card_image_refs`);
        this.db.run(`DELETE FROM projects`);
        this.db.run(`DELETE FROM source_notes`);
    }
}
