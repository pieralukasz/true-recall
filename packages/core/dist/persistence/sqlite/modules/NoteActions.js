/**
 * Note Actions Module
 * CRUD operations for notes table
 */
function mapRowToNote(row) {
    var _a, _b, _c, _d, _e;
    return {
        id: row.id,
        noteTypeId: row.note_type_id,
        fields: JSON.parse(row.fields_json),
        tags: row.tags ? row.tags.split(" ").filter(Boolean) : [],
        sourceUid: (_a = row.source_uid) !== null && _a !== void 0 ? _a : undefined,
        sourceText: (_b = row.source_text) !== null && _b !== void 0 ? _b : undefined,
        createdVia: (_c = row.created_via) !== null && _c !== void 0 ? _c : undefined,
        createdAt: (_d = row.created_at) !== null && _d !== void 0 ? _d : undefined,
        updatedAt: (_e = row.updated_at) !== null && _e !== void 0 ? _e : undefined,
    };
}
/** Escape user input for FTS5 MATCH — wraps in double quotes to treat as phrase */
export function escapeFts5Query(input) {
    return `"${input.replace(/"/g, '""')}"`;
}
export class NoteActions {
    constructor(db) {
        this.db = db;
        this.fts5Available = null;
    }
    isFts5Available() {
        if (this.fts5Available === null) {
            const row = this.db.get(`SELECT value FROM meta WHERE key = 'fts5_available'`);
            this.fts5Available = (row === null || row === void 0 ? void 0 : row.value) === "1";
        }
        return this.fts5Available;
    }
    getById(id) {
        const row = this.db.get(`SELECT * FROM notes WHERE id = ? AND deleted_at IS NULL`, [id]);
        return row ? mapRowToNote(row) : null;
    }
    getBySourceUid(sourceUid) {
        const rows = this.db.query(`SELECT * FROM notes WHERE source_uid = ? AND deleted_at IS NULL`, [sourceUid]);
        return rows.map(mapRowToNote);
    }
    getByNoteTypeId(noteTypeId) {
        const rows = this.db.query(`SELECT * FROM notes WHERE note_type_id = ? AND deleted_at IS NULL`, [noteTypeId]);
        return rows.map(mapRowToNote);
    }
    create(note) {
        var _a, _b, _c, _d, _e;
        const now = Date.now();
        this.db.run(`INSERT INTO notes (id, note_type_id, fields_json, tags, source_uid, source_text, created_via, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            note.id,
            note.noteTypeId,
            JSON.stringify(note.fields),
            note.tags.join(" "),
            (_a = note.sourceUid) !== null && _a !== void 0 ? _a : null,
            (_b = note.sourceText) !== null && _b !== void 0 ? _b : null,
            (_c = note.createdVia) !== null && _c !== void 0 ? _c : "manual",
            (_d = note.createdAt) !== null && _d !== void 0 ? _d : now,
            (_e = note.updatedAt) !== null && _e !== void 0 ? _e : now,
        ]);
    }
    update(id, updates) {
        const now = Date.now();
        const sets = [];
        const params = [];
        if (updates.noteTypeId !== undefined) {
            sets.push("note_type_id = ?");
            params.push(updates.noteTypeId);
        }
        if (updates.fields !== undefined) {
            sets.push("fields_json = ?");
            params.push(JSON.stringify(updates.fields));
        }
        if (updates.tags !== undefined) {
            sets.push("tags = ?");
            params.push(updates.tags.join(" "));
        }
        if (updates.sourceUid !== undefined) {
            sets.push("source_uid = ?");
            params.push(updates.sourceUid);
        }
        if (updates.sourceText !== undefined) {
            sets.push("source_text = ?");
            params.push(updates.sourceText);
        }
        if (updates.createdVia !== undefined) {
            sets.push("created_via = ?");
            params.push(updates.createdVia);
        }
        sets.push("updated_at = ?");
        params.push(now);
        params.push(id);
        this.db.run(`UPDATE notes SET ${sets.join(", ")} WHERE id = ?`, params);
    }
    delete(id) {
        this.db.run(`UPDATE notes SET deleted_at = ? WHERE id = ?`, [
            Date.now(),
            id,
        ]);
    }
    count() {
        var _a;
        const row = this.db.get(`SELECT COUNT(*) as cnt FROM notes WHERE deleted_at IS NULL`);
        return (_a = row === null || row === void 0 ? void 0 : row.cnt) !== null && _a !== void 0 ? _a : 0;
    }
    countByNoteType(noteTypeId) {
        var _a;
        const row = this.db.get(`SELECT COUNT(*) as cnt FROM notes WHERE note_type_id = ? AND deleted_at IS NULL`, [noteTypeId]);
        return (_a = row === null || row === void 0 ? void 0 : row.cnt) !== null && _a !== void 0 ? _a : 0;
    }
    search(query) {
        const rows = this.isFts5Available()
            ? this.db.query(`SELECT * FROM notes WHERE rowid IN (
						SELECT rowid FROM notes_fts WHERE notes_fts MATCH ?
					) AND deleted_at IS NULL`, [escapeFts5Query(query)])
            : this.db.query(`SELECT * FROM notes WHERE fields_json LIKE ? AND deleted_at IS NULL`, [`%${query}%`]);
        return rows.map(mapRowToNote);
    }
}
