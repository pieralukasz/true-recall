/**
 * SQLite Source Notes Repository
 * Operations for source notes (links to Markdown notes)
 */
import type { SourceNoteInfo } from "../../../types";
import { getQueryResult, type DatabaseLike } from "./sqlite.types";

/**
 * Repository for source note operations
 */
export class SqliteSourceNotesRepo {
    private db: DatabaseLike;
    private onDataChange: () => void;

    constructor(db: DatabaseLike, onDataChange: () => void) {
        this.db = db;
        this.onDataChange = onDataChange;
    }

    /**
     * Log a change to sync_log for Server-Side Merge sync
     */
    private logChange(
        op: "INSERT" | "UPDATE" | "DELETE",
        rowId: string,
        data?: unknown
    ): void {
        this.db.run(
            `INSERT INTO sync_log (id, operation, table_name, row_id, data, timestamp, synced)
             VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [
                crypto.randomUUID(),
                op,
                "source_notes",
                rowId,
                data ? JSON.stringify(data) : null,
                Date.now(),
            ]
        );
    }

    /**
     * Insert or update a source note
     */
    upsert(info: SourceNoteInfo): void {
        const now = Date.now();

        // Check if exists to determine INSERT vs UPDATE
        const existing = this.get(info.uid);
        const isUpdate = existing !== null;

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

        // Log change for sync
        const syncData = {
            uid: info.uid,
            note_name: info.noteName,
            note_path: info.notePath || null,
            created_at: info.createdAt || now,
            updated_at: now,
        };
        this.logChange(isUpdate ? "UPDATE" : "INSERT", info.uid, syncData);

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

        // Log full row for sync
        const note = this.get(uid);
        if (note) {
            const syncData = {
                uid: note.uid,
                note_name: note.noteName,
                note_path: note.notePath || null,
                created_at: note.createdAt,
                updated_at: now,
            };
            this.logChange("UPDATE", uid, syncData);
        }

        this.onDataChange();
    }

    /**
     * Delete source note and optionally detach cards
     */
    delete(uid: string, detachCards = true): void {
        if (detachCards) {
            this.db.run(`
                UPDATE cards SET source_uid = NULL, updated_at = ? WHERE source_uid = ?
            `, [Date.now(), uid]);
        }

        this.db.run(`DELETE FROM source_notes WHERE uid = ?`, [uid]);
        this.logChange("DELETE", uid);
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
