/**
 * Project Actions Module
 * Projects, source notes, and image references operations
 *
 * Uses SQL column aliases to map directly to TypeScript interfaces
 * No manual row mapping needed
 */
import type { SourceNoteInfo, ProjectInfo, CardImageRef } from "types";
import { SqliteDatabase } from "../SqliteDatabase";
import { generateUUID } from "../sqlite.types";

interface OrphanedNoteRow {
    uid: string;
    note_name: string;
    note_path: string;
}

/**
 * Projects, source notes, and image references operations
 */
export class ProjectActions {
    constructor(private db: SqliteDatabase) {}

    // ===== Source Notes =====

    /**
     * Insert or update a source note
     */
    upsertSourceNote(info: SourceNoteInfo): void {
        const now = Date.now();

        this.db.run(`
            INSERT INTO source_notes (uid, note_name, note_path, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(uid) DO UPDATE SET
                note_name = excluded.note_name,
                note_path = excluded.note_path,
                updated_at = excluded.updated_at
        `, [
            info.uid,
            info.noteName,
            info.notePath ?? null,
            info.createdAt ?? now,
            now,
        ]);
    }

    /**
     * Get a source note by UID
     */
    getSourceNote(uid: string): SourceNoteInfo | null {
        return this.db.get<SourceNoteInfo>(`
            SELECT
                uid,
                note_name as noteName,
                note_path as notePath,
                created_at as createdAt,
                updated_at as updatedAt
            FROM source_notes WHERE uid = ?
        `, [uid]);
    }

    /**
     * Get source note by note path
     */
    getSourceNoteByPath(notePath: string): SourceNoteInfo | null {
        return this.db.get<SourceNoteInfo>(`
            SELECT
                uid,
                note_name as noteName,
                note_path as notePath,
                created_at as createdAt,
                updated_at as updatedAt
            FROM source_notes WHERE note_path = ?
        `, [notePath]);
    }

    /**
     * Get all source notes
     */
    getAllSourceNotes(): SourceNoteInfo[] {
        return this.db.query<SourceNoteInfo>(`
            SELECT
                uid,
                note_name as noteName,
                note_path as notePath,
                created_at as createdAt,
                updated_at as updatedAt
            FROM source_notes
        `);
    }

    /**
     * Update source note path (when file is renamed)
     */
    updateSourceNotePath(uid: string, newPath: string, newName?: string): void {
        const now = Date.now();

        if (newName) {
            this.db.run(`
                UPDATE source_notes SET
                    note_path = ?,
                    note_name = ?,
                    updated_at = ?
                WHERE uid = ?
            `, [newPath, newName, now, uid]);
        } else {
            this.db.run(`
                UPDATE source_notes SET
                    note_path = ?,
                    updated_at = ?
                WHERE uid = ?
            `, [newPath, now, uid]);
        }
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

        this.db.run(`DELETE FROM source_notes WHERE uid = ?`, [uid]);
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
     * Get a project by name
     */
    getProjectByName(name: string): ProjectInfo | null {
        return this.db.get<ProjectInfo>(`
            SELECT
                p.id,
                p.name,
                p.created_at as createdAt,
                p.updated_at as updatedAt,
                COUNT(DISTINCT np.source_uid) as cardCount,
                0 as dueCount,
                0 as newCount
            FROM projects p
            LEFT JOIN note_projects np ON p.id = np.project_id
            WHERE p.name = ?
            GROUP BY p.id
        `, [name]);
    }

    /**
     * Get a project by ID
     */
    getProjectById(id: string): ProjectInfo | null {
        return this.db.get<ProjectInfo>(`
            SELECT
                p.id,
                p.name,
                p.created_at as createdAt,
                p.updated_at as updatedAt,
                COUNT(DISTINCT np.source_uid) as cardCount,
                0 as dueCount,
                0 as newCount
            FROM projects p
            LEFT JOIN note_projects np ON p.id = np.project_id
            WHERE p.id = ?
            GROUP BY p.id
        `, [id]);
    }

    /**
     * Get all projects
     */
    getAllProjects(): ProjectInfo[] {
        return this.db.query<ProjectInfo>(`
            SELECT
                p.id,
                p.name,
                p.created_at as createdAt,
                p.updated_at as updatedAt,
                COUNT(DISTINCT np.source_uid) as cardCount,
                0 as dueCount,
                0 as newCount
            FROM projects p
            LEFT JOIN note_projects np ON p.id = np.project_id
            GROUP BY p.id
            ORDER BY p.name
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
        this.db.run(`DELETE FROM projects WHERE id = ?`, [id]);
    }

    /**
     * Sync projects for a source note
     */
    syncNoteProjects(sourceUid: string, projectNames: string[]): void {
        const now = Date.now();

        // Remove existing associations
        this.db.run(`DELETE FROM note_projects WHERE source_uid = ?`, [sourceUid]);

        // Add new associations
        for (const projectName of projectNames) {
            const trimmed = projectName.trim();
            if (!trimmed) continue;

            const projectId = this.createProject(trimmed);

            this.db.run(`
                INSERT OR IGNORE INTO note_projects (source_uid, project_id, created_at)
                VALUES (?, ?, ?)
            `, [sourceUid, projectId, now]);
        }
    }

    /**
     * Get all projects for a source note
     */
    getProjectsForNote(sourceUid: string): ProjectInfo[] {
        return this.db.query<ProjectInfo>(`
            SELECT
                p.id,
                p.name,
                p.created_at as createdAt,
                p.updated_at as updatedAt,
                COUNT(DISTINCT np2.source_uid) as cardCount,
                0 as dueCount,
                0 as newCount
            FROM projects p
            INNER JOIN note_projects np ON p.id = np.project_id
            LEFT JOIN note_projects np2 ON p.id = np2.project_id
            WHERE np.source_uid = ?
            GROUP BY p.id
            ORDER BY p.name
        `, [sourceUid]);
    }

    /**
     * Get project names for a source note
     */
    getProjectNamesForNote(sourceUid: string): string[] {
        const rows = this.db.query<{ name: string }>(`
            SELECT p.name
            FROM projects p
            INNER JOIN note_projects np ON p.id = np.project_id
            WHERE np.source_uid = ?
            ORDER BY p.name
        `, [sourceUid]);

        return rows.map((r) => r.name);
    }

    /**
     * Get all source note UIDs in a project
     */
    getNotesInProject(projectId: string): string[] {
        const rows = this.db.query<{ source_uid: string }>(
            `SELECT source_uid FROM note_projects WHERE project_id = ?`,
            [projectId]
        );
        return rows.map((r) => r.source_uid);
    }

    /**
     * Add a project to a note
     */
    addProjectToNote(sourceUid: string, projectName: string): void {
        const projectId = this.createProject(projectName);

        this.db.run(`
            INSERT OR IGNORE INTO note_projects (source_uid, project_id, created_at)
            VALUES (?, ?, ?)
        `, [sourceUid, projectId, Date.now()]);
    }

    /**
     * Remove a project from a note
     */
    removeProjectFromNote(sourceUid: string, projectId: string): void {
        this.db.run(`
            DELETE FROM note_projects WHERE source_uid = ? AND project_id = ?
        `, [sourceUid, projectId]);
    }

    /**
     * Get project statistics with card counts
     */
    getProjectStats(): ProjectInfo[] {
        return this.db.query<ProjectInfo>(`
            SELECT
                p.id,
                p.name,
                p.created_at as createdAt,
                p.updated_at as updatedAt,
                COUNT(DISTINCT np.source_uid) as noteCount,
                COUNT(DISTINCT c.id) as cardCount,
                SUM(CASE WHEN c.state != 0 AND c.suspended = 0
                         AND (c.buried_until IS NULL OR c.buried_until <= datetime('now'))
                         AND c.due <= datetime('now') THEN 1 ELSE 0 END) as dueCount,
                SUM(CASE WHEN c.state = 0 AND c.suspended = 0
                         AND (c.buried_until IS NULL OR c.buried_until <= datetime('now'))
                    THEN 1 ELSE 0 END) as newCount
            FROM projects p
            LEFT JOIN note_projects np ON p.id = np.project_id
            LEFT JOIN cards c ON np.source_uid = c.source_uid
            GROUP BY p.id
            ORDER BY p.name
        `);
    }

    /**
     * Delete all projects that have no notes associated
     */
    deleteEmptyProjects(): number {
        const rows = this.db.query<{ id: string }>(`
            SELECT id FROM projects
            WHERE id NOT IN (
                SELECT DISTINCT project_id FROM note_projects
            )
        `);

        if (rows.length === 0) return 0;

        this.db.run(`
            DELETE FROM projects
            WHERE id NOT IN (
                SELECT DISTINCT project_id FROM note_projects
            )
        `);

        return rows.length;
    }

    /**
     * Get source notes that have no projects assigned
     */
    getOrphanedSourceNotes(): { uid: string; noteName: string; notePath: string }[] {
        const rows = this.db.query<OrphanedNoteRow>(`
            SELECT sn.uid, sn.note_name, sn.note_path
            FROM source_notes sn
            LEFT JOIN note_projects np ON sn.uid = np.source_uid
            WHERE np.source_uid IS NULL
            ORDER BY sn.note_name
        `);

        return rows.map((r) => ({
            uid: r.uid,
            noteName: r.note_name,
            notePath: r.note_path,
        }));
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
            FROM card_image_refs WHERE card_id = ?
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
            FROM card_image_refs WHERE image_path = ?
        `, [imagePath]);
    }

    /**
     * Delete all image references for a card
     */
    deleteCardImageRefs(cardId: string): void {
        this.db.run(`DELETE FROM card_image_refs WHERE card_id = ?`, [cardId]);
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
        // Delete existing refs for this card
        this.db.run(`DELETE FROM card_image_refs WHERE card_id = ?`, [cardId]);

        const now = Date.now();

        // Build statements for runMany
        const statements: Array<[string, string[]]> = [];

        // Add question refs
        for (const imagePath of questionRefs) {
            const id = generateUUID();
            statements.push([
                `INSERT INTO card_image_refs (id, card_id, image_path, field, created_at) VALUES (?, ?, ?, 'question', ?)`,
                [id, cardId, imagePath, String(now)]
            ]);
        }

        // Add answer refs
        for (const imagePath of answerRefs) {
            const id = generateUUID();
            statements.push([
                `INSERT INTO card_image_refs (id, card_id, image_path, field, created_at) VALUES (?, ?, ?, 'answer', ?)`,
                [id, cardId, imagePath, String(now)]
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
            `SELECT DISTINCT image_path FROM card_image_refs ORDER BY image_path`
        );
        return rows.map((r) => r.image_path);
    }

    /**
     * Count cards referencing a specific image
     */
    countCardsForImage(imagePath: string): number {
        const result = this.db.get<{ count: number }>(
            `SELECT COUNT(DISTINCT card_id) as count FROM card_image_refs WHERE image_path = ?`,
            [imagePath]
        );
        return result?.count ?? 0;
    }

}
