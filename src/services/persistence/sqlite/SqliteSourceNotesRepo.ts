/**
 * SQLite Source Notes Repository
 * Operations for source notes (links to Markdown notes)
 */
import type { Database } from "sql.js";
import type { SourceNoteInfo } from "../../../types";
import { getQueryResult } from "./sqlite.types";

/**
 * Repository for source note operations
 */
export class SqliteSourceNotesRepo {
    private db: Database;
    private onDataChange: () => void;

    constructor(db: Database, onDataChange: () => void) {
        this.db = db;
        this.onDataChange = onDataChange;
    }

    /**
     * Insert or update a source note
     */
    upsert(info: SourceNoteInfo): void {
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
            info.notePath || null,
            info.createdAt || now,
            now,
        ]);

        this.onDataChange();
    }

    /**
     * Get a source note by UID
     */
    get(uid: string): SourceNoteInfo | null {
        const result = this.db.exec(`
            SELECT * FROM source_notes WHERE uid = ?
        `, [uid]);

        const data = getQueryResult(result);
        if (!data) return null;

        return this.rowToSourceNoteInfo(data.columns, data.values[0]!);
    }

    /**
     * Get source note by note path
     */
    getByPath(notePath: string): SourceNoteInfo | null {
        const result = this.db.exec(`
            SELECT * FROM source_notes WHERE note_path = ?
        `, [notePath]);

        const data = getQueryResult(result);
        if (!data) return null;

        return this.rowToSourceNoteInfo(data.columns, data.values[0]!);
    }

    /**
     * Get all source notes
     */
    getAll(): SourceNoteInfo[] {
        const result = this.db.exec(`SELECT * FROM source_notes`);
        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map((row) =>
            this.rowToSourceNoteInfo(data.columns, row)
        );
    }

    /**
     * Update source note path (when file is renamed)
     */
    updatePath(uid: string, newPath: string, newName?: string): void {
        if (newName) {
            this.db.run(`
                UPDATE source_notes SET
                    note_path = ?,
                    note_name = ?,
                    updated_at = ?
                WHERE uid = ?
            `, [newPath, newName, Date.now(), uid]);
        } else {
            this.db.run(`
                UPDATE source_notes SET
                    note_path = ?,
                    updated_at = ?
                WHERE uid = ?
            `, [newPath, Date.now(), uid]);
        }

        this.onDataChange();
    }

    /**
     * Delete source note and optionally detach cards
     */
    delete(uid: string, detachCards = true): void {
        if (detachCards) {
            this.db.run(`
                UPDATE cards SET source_uid = NULL WHERE source_uid = ?
            `, [uid]);
        }

        this.db.run(`DELETE FROM source_notes WHERE uid = ?`, [uid]);
        this.onDataChange();
    }

    // ===== Helper =====

    private rowToSourceNoteInfo(columns: string[], row: (string | number | null | Uint8Array)[]): SourceNoteInfo {
        const getCol = (name: string) => {
            const idx = columns.indexOf(name);
            return idx >= 0 ? row[idx] : null;
        };

        return {
            uid: getCol("uid") as string,
            noteName: getCol("note_name") as string,
            notePath: getCol("note_path") as string | undefined,
            createdAt: getCol("created_at") as number | undefined,
            updatedAt: getCol("updated_at") as number | undefined,
        };
    }
}
