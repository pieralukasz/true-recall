/**
 * SQLite Projects Repository
 * CRUD operations for projects and note-project relationships (many-to-many)
 */
import type { ProjectInfo } from "../../../types";
import { getQueryResult, type DatabaseLike } from "./sqlite.types";

/**
 * Repository for project operations and note-project relationships
 */
export class SqliteProjectsRepo {
    private db: DatabaseLike;
    private onDataChange: () => void;

    constructor(db: DatabaseLike, onDataChange: () => void) {
        this.db = db;
        this.onDataChange = onDataChange;
    }

    // ===== Project CRUD =====

    /**
     * Create a new project
     * @returns The new project ID (UUID string), or existing ID if project already exists
     */
    createProject(name: string): string {
        const now = Date.now();

        // Try to get existing project first
        const existing = this.getProjectByName(name);
        if (existing) {
            return existing.id;
        }

        // Generate UUID for new project
        const projectId = this.generateUUID();

        this.db.run(`
            INSERT INTO projects (id, name, created_at, updated_at)
            VALUES (?, ?, ?, ?)
        `, [projectId, name, now, now]);

        this.onDataChange();
        return projectId;
    }

    /**
     * Generate a UUID v4 string
     */
    private generateUUID(): string {
        if (typeof crypto !== "undefined" && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // Fallback for environments without crypto.randomUUID
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    /**
     * Get a project by name
     */
    getProjectByName(name: string): ProjectInfo | null {
        const result = this.db.exec(`
            SELECT p.*,
                   COUNT(DISTINCT np.source_uid) as card_count,
                   0 as due_count,
                   0 as new_count
            FROM projects p
            LEFT JOIN note_projects np ON p.id = np.project_id
            WHERE p.name = ?
            GROUP BY p.id
        `, [name]);

        const data = getQueryResult(result);
        if (!data) return null;

        return this.rowToProjectInfo(data.columns, data.values[0]!);
    }

    /**
     * Get a project by ID (UUID string)
     */
    getProjectById(id: string): ProjectInfo | null {
        const result = this.db.exec(`
            SELECT p.*,
                   COUNT(DISTINCT np.source_uid) as card_count,
                   0 as due_count,
                   0 as new_count
            FROM projects p
            LEFT JOIN note_projects np ON p.id = np.project_id
            WHERE p.id = ?
            GROUP BY p.id
        `, [id]);

        const data = getQueryResult(result);
        if (!data) return null;

        return this.rowToProjectInfo(data.columns, data.values[0]!);
    }

    /**
     * Get all projects
     */
    getAllProjects(): ProjectInfo[] {
        const result = this.db.exec(`
            SELECT p.*,
                   COUNT(DISTINCT np.source_uid) as card_count,
                   0 as due_count,
                   0 as new_count
            FROM projects p
            LEFT JOIN note_projects np ON p.id = np.project_id
            GROUP BY p.id
            ORDER BY p.name
        `);

        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map(row => this.rowToProjectInfo(data.columns, row));
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

        this.onDataChange();
    }

    /**
     * Delete a project (also removes all note-project associations)
     */
    deleteProject(id: string): void {
        // Foreign key cascade will handle note_projects cleanup
        this.db.run(`DELETE FROM projects WHERE id = ?`, [id]);
        this.onDataChange();
    }

    // ===== Note-Project Relationships =====

    /**
     * Sync projects for a source note
     * Replaces all existing project associations with the new list
     */
    syncNoteProjects(sourceUid: string, projectNames: string[]): void {
        const now = Date.now();

        // Remove existing associations
        this.db.run(`DELETE FROM note_projects WHERE source_uid = ?`, [sourceUid]);

        // Add new associations
        for (const projectName of projectNames) {
            if (!projectName.trim()) continue;

            // Get or create project
            const projectId = this.createProject(projectName.trim());

            // Create association
            this.db.run(`
                INSERT OR IGNORE INTO note_projects (source_uid, project_id, created_at)
                VALUES (?, ?, ?)
            `, [sourceUid, projectId, now]);
        }

        this.onDataChange();
    }

    /**
     * Get all projects for a source note
     */
    getProjectsForNote(sourceUid: string): ProjectInfo[] {
        const result = this.db.exec(`
            SELECT p.*,
                   COUNT(DISTINCT np2.source_uid) as card_count,
                   0 as due_count,
                   0 as new_count
            FROM projects p
            INNER JOIN note_projects np ON p.id = np.project_id
            LEFT JOIN note_projects np2 ON p.id = np2.project_id
            WHERE np.source_uid = ?
            GROUP BY p.id
            ORDER BY p.name
        `, [sourceUid]);

        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map(row => this.rowToProjectInfo(data.columns, row));
    }

    /**
     * Get project names for a source note (convenience method)
     */
    getProjectNamesForNote(sourceUid: string): string[] {
        const result = this.db.exec(`
            SELECT p.name
            FROM projects p
            INNER JOIN note_projects np ON p.id = np.project_id
            WHERE np.source_uid = ?
            ORDER BY p.name
        `, [sourceUid]);

        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map(row => row[0] as string);
    }

    /**
     * Get all source note UIDs in a project
     */
    getNotesInProject(projectId: string): string[] {
        const result = this.db.exec(`
            SELECT source_uid FROM note_projects WHERE project_id = ?
        `, [projectId]);

        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map(row => row[0] as string);
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

        this.onDataChange();
    }

    /**
     * Remove a project from a note
     */
    removeProjectFromNote(sourceUid: string, projectId: string): void {
        this.db.run(`
            DELETE FROM note_projects WHERE source_uid = ? AND project_id = ?
        `, [sourceUid, projectId]);

        this.onDataChange();
    }

    // ===== Statistics =====

    /**
     * Get project statistics with card counts
     * Uses JOIN with cards table through source_notes
     */
    getProjectStats(): ProjectInfo[] {
        const result = this.db.exec(`
            SELECT
                p.id,
                p.name,
                p.created_at,
                p.updated_at,
                COUNT(DISTINCT np.source_uid) as note_count,
                COUNT(DISTINCT c.id) as card_count,
                SUM(CASE WHEN c.state != 0 AND c.suspended = 0
                         AND (c.buried_until IS NULL OR c.buried_until <= datetime('now'))
                         AND c.due <= datetime('now') THEN 1 ELSE 0 END) as due_count,
                SUM(CASE WHEN c.state = 0 AND c.suspended = 0
                         AND (c.buried_until IS NULL OR c.buried_until <= datetime('now'))
                    THEN 1 ELSE 0 END) as new_count
            FROM projects p
            LEFT JOIN note_projects np ON p.id = np.project_id
            LEFT JOIN cards c ON np.source_uid = c.source_uid
            GROUP BY p.id
            ORDER BY p.name
        `);

        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map(row => this.rowToProjectInfo(data.columns, row));
    }

    // ===== Cleanup =====

    /**
     * Delete all projects that have no notes associated
     * @returns Number of deleted projects
     */
    deleteEmptyProjects(): number {
        const result = this.db.exec(`
            SELECT id FROM projects
            WHERE id NOT IN (
                SELECT DISTINCT project_id FROM note_projects
            )
        `);

        const data = getQueryResult(result);
        if (!data || data.values.length === 0) {
            return 0;
        }

        // Get IDs to delete
        const idsToDelete = data.values.map(row => row[0] as number);

        // Delete them
        this.db.run(`
            DELETE FROM projects
            WHERE id NOT IN (
                SELECT DISTINCT project_id FROM note_projects
            )
        `);

        if (idsToDelete.length > 0) {
            this.onDataChange();
        }

        return idsToDelete.length;
    }

    // ===== Orphaned Notes =====

    /**
     * Get source notes that have no projects assigned
     */
    getOrphanedSourceNotes(): { uid: string; noteName: string; notePath: string }[] {
        const result = this.db.exec(`
            SELECT sn.uid, sn.note_name, sn.note_path
            FROM source_notes sn
            LEFT JOIN note_projects np ON sn.uid = np.source_uid
            WHERE np.source_uid IS NULL
            ORDER BY sn.note_name
        `);

        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map(row => ({
            uid: row[data.columns.indexOf("uid")] as string,
            noteName: row[data.columns.indexOf("note_name")] as string,
            notePath: row[data.columns.indexOf("note_path")] as string,
        }));
    }

    // ===== Helpers =====

    private rowToProjectInfo(columns: string[], row: (string | number | null | Uint8Array)[]): ProjectInfo {
        const getCol = (name: string) => {
            const idx = columns.indexOf(name);
            return idx >= 0 ? row[idx] : null;
        };

        return {
            id: getCol("id") as string,
            name: getCol("name") as string,
            noteCount: (getCol("note_count") as number) || 0,
            cardCount: (getCol("card_count") as number) || 0,
            dueCount: (getCol("due_count") as number) || 0,
            newCount: (getCol("new_count") as number) || 0,
            createdAt: getCol("created_at") as number | undefined,
            updatedAt: getCol("updated_at") as number | undefined,
        };
    }
}
