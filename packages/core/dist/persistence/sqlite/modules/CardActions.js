import { FLASHCARD_CONFIG } from "../../../constants";
import { deriveCardType, renderTemplate, } from "../../../services/cards/template-engine";
import { BUILTIN_BASIC_ID, BUILTIN_BASIC_REVERSED_ID, BUILTIN_CLOZE_ID, BUILTIN_IMAGE_OCCLUSION_ID, } from "../../../types/note.types";
import { normalizeIOImagePath, parseIODefinition } from "../../io-definition";
import { sqlPlaceholders } from "../sql-utils";
import { escapeFts5Query } from "./NoteActions";
// ── Column definitions (JOIN-based, computed q/a) ──────────────
const CARD_SELECT = `
    c.id, c.due, c.stability, c.difficulty, c.reps, c.lapses, c.state,
    c.last_review AS lastReview,
    c.scheduled_days AS scheduledDays,
    c.learning_step AS learningStep,
    c.suspended = 1 AS suspended,
    c.buried_until AS buriedUntil,
    c.created_at AS createdAt,
    c.source_uid AS sourceUid,
    c.note_id AS noteId,
    c.template_ord AS templateOrd,
    n.fields_json AS fieldsJson,
    n.tags AS noteTags,
    n.source_text AS sourceText,
    n.created_via AS createdVia,
    n.note_type_id AS noteTypeId,
    nt.type AS noteTypeType,
    nt.name AS noteTypeName,
    nt.templates_json AS templatesJson
`;
const CARD_SELECT_SYNC = `
    c.id, c.due, c.stability, c.difficulty, c.reps, c.lapses, c.state,
    c.last_review AS lastReview,
    c.scheduled_days AS scheduledDays,
    c.learning_step AS learningStep,
    c.suspended = 1 AS suspended,
    c.buried_until AS buriedUntil,
    c.created_at AS createdAt,
    c.updated_at AS updatedAt,
    c.deleted_at AS deletedAt,
    c.source_uid AS sourceUid,
    c.note_id AS noteId,
    c.template_ord AS templateOrd,
    n.fields_json AS fieldsJson,
    n.tags AS noteTags,
    n.source_text AS sourceText,
    n.created_via AS createdVia,
    n.note_type_id AS noteTypeId,
    nt.type AS noteTypeType,
    nt.name AS noteTypeName,
    nt.templates_json AS templatesJson
`;
const CARD_FROM = `
    FROM cards c
    JOIN notes n ON c.note_id = n.id
    JOIN note_types nt ON n.note_type_id = nt.id
`;
// ── Lightweight scheduling-only query (no fieldsJson/templatesJson) ──
const META_SELECT = `
    c.id, c.due, c.stability, c.difficulty, c.reps, c.lapses, c.state,
    c.last_review AS lastReview,
    c.scheduled_days AS scheduledDays,
    c.learning_step AS learningStep,
    c.suspended = 1 AS suspended,
    c.buried_until AS buriedUntil,
    c.created_at AS createdAt,
    c.source_uid AS sourceUid,
    c.note_id AS noteId,
    c.template_ord AS templateOrd,
    n.tags AS noteTags,
    n.note_type_id AS noteTypeId,
    nt.type AS noteTypeType,
    nt.name AS noteTypeName
`;
function mapMetaRow(row) {
    var _a, _b, _c, _d, _e, _f;
    const noteTags = (_b = (_a = row.noteTags) === null || _a === void 0 ? void 0 : _a.split(" ").map((t) => t.trim()).filter(Boolean)) !== null && _b !== void 0 ? _b : [];
    const noteTypeInfo = { id: row.noteTypeId, type: row.noteTypeType };
    const cardType = deriveCardType(noteTypeInfo, row.templateOrd);
    return {
        id: row.id,
        fsrs: {
            id: row.id,
            due: row.due,
            stability: row.stability,
            difficulty: row.difficulty,
            reps: row.reps,
            lapses: row.lapses,
            state: row.state,
            lastReview: row.lastReview,
            scheduledDays: row.scheduledDays,
            learningStep: row.learningStep,
            suspended: row.suspended === 1,
            buriedUntil: (_c = row.buriedUntil) !== null && _c !== void 0 ? _c : undefined,
            createdAt: (_d = row.createdAt) !== null && _d !== void 0 ? _d : undefined,
            sourceUid: (_e = row.sourceUid) !== null && _e !== void 0 ? _e : undefined,
            noteId: row.noteId,
            templateOrd: row.templateOrd,
            noteTypeId: row.noteTypeId,
            noteTypeName: row.noteTypeName,
        },
        sourceUid: (_f = row.sourceUid) !== null && _f !== void 0 ? _f : undefined,
        cardType,
        noteId: row.noteId,
        templateOrd: row.templateOrd,
        noteTypeName: row.noteTypeName,
        alwaysTypeIn: noteTags.includes(FLASHCARD_CONFIG.alwaysTypeInTag),
    };
}
function mapRow(row) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const fields = JSON.parse(row.fieldsJson);
    const noteTags = (_b = (_a = row.noteTags) === null || _a === void 0 ? void 0 : _a.split(" ").map((t) => t.trim()).filter(Boolean)) !== null && _b !== void 0 ? _b : [];
    const templates = JSON.parse(row.templatesJson);
    // Cloze types: always use first template (templateOrd = cloze index, not template ordinal)
    let template;
    if (row.noteTypeType === 1) {
        template = templates[0];
    }
    else {
        template = templates.find((t) => t.ordinal === row.templateOrd);
    }
    const noteTypeInfo = {
        id: row.noteTypeId,
        type: row.noteTypeType,
    };
    const cardType = deriveCardType(noteTypeInfo, row.templateOrd);
    const ioImagePath = cardType === "image-occlusion"
        ? normalizeIOImagePath((_c = fields.Image) !== null && _c !== void 0 ? _c : "")
        : undefined;
    const ioRegionsJson = cardType === "image-occlusion" ? ((_d = fields.Regions) !== null && _d !== void 0 ? _d : "") : undefined;
    const ioDefinition = cardType === "image-occlusion" && ioRegionsJson
        ? parseIODefinition(ioRegionsJson)
        : null;
    let question = "";
    let answer = "";
    if (cardType === "image-occlusion") {
        question =
            ioImagePath && ioDefinition
                ? `Image occlusion ${row.templateOrd + 1}`
                : "Image occlusion";
        answer = "Reveal image occlusion";
    }
    else if (template) {
        const context = { fields, clozeIndex: row.templateOrd };
        question = renderTemplate(template.qfmt, context);
        answer = renderTemplate(template.afmt, Object.assign(Object.assign({}, context), { frontSide: "" }));
    }
    const isCloze = noteTypeInfo.type === 1;
    // Derive cloze field name from template's {{cloze:FieldName}} instead of hardcoding "Text"
    let clozeFieldName = "Text";
    if (isCloze && template) {
        const m = template.qfmt.match(/\{\{\s*cloze:(\w+)\s*\}\}/);
        if (m === null || m === void 0 ? void 0 : m[1])
            clozeFieldName = m[1];
    }
    return {
        id: row.id,
        due: row.due,
        stability: row.stability,
        difficulty: row.difficulty,
        reps: row.reps,
        lapses: row.lapses,
        state: row.state,
        lastReview: row.lastReview,
        scheduledDays: row.scheduledDays,
        learningStep: row.learningStep,
        suspended: row.suspended === 1,
        buriedUntil: (_e = row.buriedUntil) !== null && _e !== void 0 ? _e : undefined,
        createdAt: (_f = row.createdAt) !== null && _f !== void 0 ? _f : undefined,
        question,
        answer,
        sourceUid: (_g = row.sourceUid) !== null && _g !== void 0 ? _g : undefined,
        cardType,
        clozeTemplate: isCloze ? ((_h = fields[clozeFieldName]) !== null && _h !== void 0 ? _h : undefined) : undefined,
        clozeIndex: isCloze ? row.templateOrd : undefined,
        createdVia: (_j = row.createdVia) !== null && _j !== void 0 ? _j : undefined,
        sourceText: (_k = row.sourceText) !== null && _k !== void 0 ? _k : undefined,
        noteId: row.noteId,
        templateOrd: row.templateOrd,
        noteTypeId: row.noteTypeId,
        noteTypeName: row.noteTypeName,
        ioImagePath,
        ioRegionsJson,
        ioGroupKey: cardType === "image-occlusion" ? String(row.templateOrd) : undefined,
        alwaysTypeIn: noteTags.includes(FLASHCARD_CONFIG.alwaysTypeInTag),
    };
}
function mapRowWithSync(row) {
    var _a;
    return Object.assign(Object.assign({}, mapRow(row)), { updatedAt: (_a = row.updatedAt) !== null && _a !== void 0 ? _a : undefined, deletedAt: row.deletedAt });
}
// ── Note mapping helper ───────────────────────────────────────
function resolveNoteMapping(data) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
    if (data.noteTypeId) {
        if (data.noteTypeId === BUILTIN_IMAGE_OCCLUSION_ID) {
            return {
                noteTypeId: BUILTIN_IMAGE_OCCLUSION_ID,
                fieldsJson: JSON.stringify({
                    Image: (_a = data.ioImagePath) !== null && _a !== void 0 ? _a : "",
                    Regions: (_b = data.ioRegionsJson) !== null && _b !== void 0 ? _b : "[]",
                }),
                templateOrd: (_c = data.templateOrd) !== null && _c !== void 0 ? _c : 0,
            };
        }
        // Caller provides explicit field values (e.g. Anki import with custom note types)
        if (data.fields) {
            return {
                noteTypeId: data.noteTypeId,
                fieldsJson: JSON.stringify(data.fields),
                // Cloze cards: templateOrd stores the 1-based cloze index, not the template ordinal
                templateOrd: data.cardType === "cloze" && data.clozeIndex != null
                    ? data.clozeIndex
                    : ((_d = data.templateOrd) !== null && _d !== void 0 ? _d : 0),
            };
        }
        // Fallback: derive fields from question/answer for legacy callers
        return {
            noteTypeId: data.noteTypeId,
            fieldsJson: JSON.stringify(data.cardType === "cloze"
                ? { Text: (_e = data.clozeTemplate) !== null && _e !== void 0 ? _e : "", Extra: "" }
                : { Front: (_f = data.question) !== null && _f !== void 0 ? _f : "", Back: (_g = data.answer) !== null && _g !== void 0 ? _g : "" }),
            templateOrd: data.cardType === "cloze" && data.clozeIndex != null
                ? data.clozeIndex
                : ((_h = data.templateOrd) !== null && _h !== void 0 ? _h : 0),
        };
    }
    if (data.cardType === "cloze") {
        return {
            noteTypeId: BUILTIN_CLOZE_ID,
            fieldsJson: JSON.stringify({
                Text: (_j = data.clozeTemplate) !== null && _j !== void 0 ? _j : "",
                Extra: "",
            }),
            templateOrd: (_k = data.clozeIndex) !== null && _k !== void 0 ? _k : 0,
        };
    }
    if (data.cardType === "reversed") {
        return {
            noteTypeId: BUILTIN_BASIC_REVERSED_ID,
            fieldsJson: JSON.stringify({
                Front: (_l = data.question) !== null && _l !== void 0 ? _l : "",
                Back: (_m = data.answer) !== null && _m !== void 0 ? _m : "",
            }),
            templateOrd: (_o = data.templateOrd) !== null && _o !== void 0 ? _o : 1,
        };
    }
    return {
        noteTypeId: BUILTIN_BASIC_ID,
        fieldsJson: JSON.stringify({
            Front: (_p = data.question) !== null && _p !== void 0 ? _p : "",
            Back: (_q = data.answer) !== null && _q !== void 0 ? _q : "",
        }),
        templateOrd: (_r = data.templateOrd) !== null && _r !== void 0 ? _r : 0,
    };
}
// ── CardActions class ─────────────────────────────────────────
export class CardActions {
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
    noteMatchCondition(param) {
        if (this.isFts5Available()) {
            return {
                sql: "n.rowid IN (SELECT rowid FROM notes_fts WHERE notes_fts MATCH ?)",
                param: escapeFts5Query(param),
            };
        }
        return { sql: "n.fields_json LIKE ?", param: `%${param}%` };
    }
    // ── Scheduling-only reads (no template rendering) ────────
    getAllSchedulingMeta() {
        const rows = this.db.query(`SELECT ${META_SELECT} ${CARD_FROM} WHERE c.deleted_at IS NULL`);
        return rows.map(mapMetaRow);
    }
    getSchedulingMetaById(cardId) {
        const row = this.db.get(`SELECT ${META_SELECT} ${CARD_FROM} WHERE c.id = ? AND c.deleted_at IS NULL`, [cardId]);
        if (!row)
            return null;
        return mapMetaRow(row);
    }
    // ── Full card reads (with template rendering) ─────────────
    get(cardId) {
        const row = this.db.get(`SELECT ${CARD_SELECT} ${CARD_FROM} WHERE c.id = ? AND c.deleted_at IS NULL`, [cardId]);
        if (!row)
            return undefined;
        return mapRow(row);
    }
    getAll() {
        const rows = this.db.query(`SELECT ${CARD_SELECT} ${CARD_FROM} WHERE c.deleted_at IS NULL`);
        return rows.map(mapRow);
    }
    getByIds(cardIds) {
        if (cardIds.length === 0)
            return [];
        const placeholders = sqlPlaceholders(cardIds.length);
        const rows = this.db.query(`SELECT ${CARD_SELECT} ${CARD_FROM} WHERE c.id IN (${placeholders}) AND c.deleted_at IS NULL`, cardIds);
        return rows.map(mapRow);
    }
    getCardsBySourceUid(sourceUid) {
        const rows = this.db.query(`SELECT ${CARD_SELECT} ${CARD_FROM} WHERE c.source_uid = ? AND c.deleted_at IS NULL ORDER BY c.created_at ASC, c.id ASC`, [sourceUid]);
        return rows.map(mapRow);
    }
    getBySourceUid(sourceUid) {
        return this.getCardsBySourceUid(sourceUid);
    }
    getCardsWithContent() {
        return this.getAll().map((card) => (Object.assign(Object.assign({}, card), { sourceNoteName: "", sourceNotePath: "" })));
    }
    getAllIncludingDeleted() {
        const rows = this.db.query(`SELECT ${CARD_SELECT} ${CARD_FROM}`);
        return rows.map(mapRow);
    }
    getModifiedSince(timestamp) {
        const rows = this.db.query(`SELECT ${CARD_SELECT_SYNC} ${CARD_FROM} WHERE c.updated_at > ?`, [timestamp]);
        return rows.map(mapRowWithSync);
    }
    getDueCardsByDateRange(startDate, endDate) {
        const rows = this.db.query(`SELECT ${CARD_SELECT} ${CARD_FROM}
                 WHERE c.deleted_at IS NULL
                   AND c.suspended = 0
                   AND (c.buried_until IS NULL OR c.buried_until <= datetime('now'))
                   AND c.state NOT IN (1, 3)
                   AND date(c.due) BETWEEN ? AND ?
                 ORDER BY c.due ASC`, [startDate, endDate]);
        return rows.map(mapRow);
    }
    browserQuery(where, params, orderBy, limit, offset) {
        const sql = `SELECT ${CARD_SELECT} ${CARD_FROM} WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
        const rows = this.db.query(sql, [...params, limit, offset]);
        return rows.map(mapRow);
    }
    browserCount(where, params) {
        var _a, _b;
        const sql = `SELECT COUNT(*) as count ${CARD_FROM} WHERE ${where}`;
        return (_b = (_a = this.db.get(sql, params)) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : 0;
    }
    // ── Sibling / relationship queries ────────────────────────
    getCardByReverseOf(originalCardId) {
        const original = this.db.get(`SELECT note_id, template_ord FROM cards WHERE id = ? AND deleted_at IS NULL`, [originalCardId]);
        if (!original)
            return undefined;
        const row = this.db.get(`SELECT ${CARD_SELECT} ${CARD_FROM}
                 WHERE c.note_id = ? AND c.template_ord != ? AND c.deleted_at IS NULL LIMIT 1`, [original.note_id, original.template_ord]);
        if (!row)
            return undefined;
        return mapRow(row);
    }
    getCardsByNoteId(noteId) {
        const rows = this.db.query(`SELECT ${CARD_SELECT} ${CARD_FROM}
				 WHERE c.note_id = ? AND c.deleted_at IS NULL
				 ORDER BY c.template_ord`, [noteId]);
        return rows.map(mapRow);
    }
    getNoteInfoForCardIds(cardIds) {
        if (cardIds.length === 0)
            return [];
        const placeholders = sqlPlaceholders(cardIds.length);
        return this.db.query(`SELECT DISTINCT c.note_id AS noteId, n.note_type_id AS noteTypeId
			 FROM cards c JOIN notes n ON c.note_id = n.id
			 WHERE c.id IN (${placeholders}) AND c.deleted_at IS NULL`, cardIds);
    }
    findClozeCard(sourceUid, _clozeTemplate, clozeIndex) {
        var _a;
        return (_a = this.db.get(`SELECT c.id FROM cards c
                 JOIN notes n ON c.note_id = n.id
                 WHERE n.source_uid = ? AND c.template_ord = ? AND c.deleted_at IS NULL
                 LIMIT 1`, [sourceUid, clozeIndex])) === null || _a === void 0 ? void 0 : _a.id;
    }
    getIOChildren(parentId) {
        const parent = this.db.get(`SELECT note_id FROM cards WHERE id = ? AND deleted_at IS NULL`, [parentId]);
        if (!parent)
            return [];
        const rows = this.db.query(`SELECT ${CARD_SELECT} ${CARD_FROM}
                 WHERE c.note_id = ? AND c.template_ord > 0 AND c.deleted_at IS NULL
                 ORDER BY c.template_ord`, [parent.note_id]);
        return rows.map(mapRow);
    }
    softDeleteIOFamily(parentId) {
        const children = this.getIOChildren(parentId);
        const allIds = [parentId, ...children.map((c) => c.id)];
        this.bulkSoftDelete(allIds);
        return allIds;
    }
    getClozeSiblings(sourceUid, _clozeTemplate) {
        const rows = this.db.query(`SELECT ${CARD_SELECT} ${CARD_FROM}
                 WHERE n.source_uid = ? AND c.deleted_at IS NULL
                 ORDER BY c.template_ord ASC`, [sourceUid]);
        return rows.map(mapRow);
    }
    // ── Write methods ─────────────────────────────────────────
    set(cardId, data) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const now = Date.now();
        const existing = this.db.get(`SELECT created_at FROM cards WHERE id = ?`, [cardId]);
        const createdAt = (_b = (_a = data.createdAt) !== null && _a !== void 0 ? _a : existing === null || existing === void 0 ? void 0 : existing.created_at) !== null && _b !== void 0 ? _b : now;
        const { noteTypeId, fieldsJson, templateOrd } = resolveNoteMapping(data);
        let noteId = data.noteId;
        // Reversed cards share the original card's note (different template_ord)
        if (!noteId && data.cardType === "reversed" && data.reverseOf) {
            const orig = this.db.get(`SELECT note_id FROM cards WHERE id = ? AND deleted_at IS NULL`, [data.reverseOf]);
            if (orig) {
                noteId = orig.note_id;
                // Upgrade note type to basic-reversed so both templates are available
                this.db.run(`UPDATE notes SET note_type_id = ?, updated_at = ? WHERE id = ?`, [BUILTIN_BASIC_REVERSED_ID, now, noteId]);
            }
        }
        if (!noteId) {
            noteId = crypto.randomUUID();
            const noteTags = data.alwaysTypeIn
                ? FLASHCARD_CONFIG.alwaysTypeInTag
                : "";
            this.db.run(`INSERT OR IGNORE INTO notes (id, note_type_id, fields_json, tags, source_uid, source_text, created_via, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                noteId,
                noteTypeId,
                fieldsJson,
                noteTags,
                (_c = data.sourceUid) !== null && _c !== void 0 ? _c : null,
                (_d = data.sourceText) !== null && _d !== void 0 ? _d : null,
                (_e = data.createdVia) !== null && _e !== void 0 ? _e : null,
                now,
                now,
            ]);
        }
        this.db.run(`INSERT OR REPLACE INTO cards (
                    id, note_id, template_ord, due, stability, difficulty,
                    reps, lapses, state, last_review, scheduled_days,
                    learning_step, suspended, buried_until,
                    created_at, updated_at, source_uid
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            cardId,
            noteId,
            templateOrd,
            data.due,
            data.stability,
            data.difficulty,
            data.reps,
            data.lapses,
            data.state,
            (_f = data.lastReview) !== null && _f !== void 0 ? _f : null,
            data.scheduledDays,
            data.learningStep,
            data.suspended ? 1 : 0,
            (_g = data.buriedUntil) !== null && _g !== void 0 ? _g : null,
            createdAt,
            now,
            (_h = data.sourceUid) !== null && _h !== void 0 ? _h : null,
        ]);
    }
    updateCardContent(cardId, question, answer) {
        const card = this.db.get(`SELECT c.note_id, n.note_type_id
			 FROM cards c
			 JOIN notes n ON c.note_id = n.id
			 WHERE c.id = ?`, [cardId]);
        if (!card)
            return;
        if (card.note_type_id === BUILTIN_IMAGE_OCCLUSION_ID) {
            throw new Error("Image occlusion cards must be edited in the image occlusion editor.");
        }
        this.db.run(`UPDATE notes SET fields_json = ?, updated_at = ? WHERE id = ?`, [
            JSON.stringify({ Front: question, Back: answer }),
            Date.now(),
            card.note_id,
        ]);
    }
    updateClozeCardContent(cardId, _question, _answer, clozeTemplate) {
        const card = this.db.get(`SELECT note_id FROM cards WHERE id = ?`, [cardId]);
        if (!card)
            return;
        const note = this.db.get(`SELECT fields_json FROM notes WHERE id = ?`, [card.note_id]);
        const fields = note
            ? JSON.parse(note.fields_json)
            : {};
        fields.Text = clozeTemplate;
        this.db.run(`UPDATE notes SET fields_json = ?, updated_at = ? WHERE id = ?`, [JSON.stringify(fields), Date.now(), card.note_id]);
    }
    upsertFromRemote(data) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const now = Date.now();
        const { noteTypeId, fieldsJson, templateOrd } = resolveNoteMapping(data);
        let noteId = data.noteId;
        if (!noteId) {
            noteId = crypto.randomUUID();
            const noteTags = data.alwaysTypeIn
                ? FLASHCARD_CONFIG.alwaysTypeInTag
                : "";
            this.db.run(`INSERT OR IGNORE INTO notes (id, note_type_id, fields_json, tags, source_uid, source_text, created_via, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                noteId,
                noteTypeId,
                fieldsJson,
                noteTags,
                (_a = data.sourceUid) !== null && _a !== void 0 ? _a : null,
                (_b = data.sourceText) !== null && _b !== void 0 ? _b : null,
                (_c = data.createdVia) !== null && _c !== void 0 ? _c : null,
                now,
                now,
            ]);
        }
        this.db.run(`INSERT OR REPLACE INTO cards (
                    id, note_id, template_ord, due, stability, difficulty,
                    reps, lapses, state, last_review, scheduled_days,
                    learning_step, suspended, buried_until,
                    created_at, updated_at, deleted_at, source_uid
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            data.id,
            noteId,
            templateOrd,
            data.due,
            data.stability,
            data.difficulty,
            data.reps,
            data.lapses,
            data.state,
            (_d = data.lastReview) !== null && _d !== void 0 ? _d : null,
            data.scheduledDays,
            data.learningStep,
            data.suspended ? 1 : 0,
            (_e = data.buriedUntil) !== null && _e !== void 0 ? _e : null,
            (_f = data.createdAt) !== null && _f !== void 0 ? _f : now,
            (_g = data.updatedAt) !== null && _g !== void 0 ? _g : now,
            (_h = data.deletedAt) !== null && _h !== void 0 ? _h : null,
            (_j = data.sourceUid) !== null && _j !== void 0 ? _j : null,
        ]);
    }
    // ── Lookup methods ────────────────────────────────────────
    getCardIdByQuestion(question) {
        var _a;
        const match = this.noteMatchCondition(question);
        return (_a = this.db.get(`SELECT c.id FROM cards c
                 JOIN notes n ON c.note_id = n.id
                 WHERE ${match.sql} AND c.deleted_at IS NULL
                 LIMIT 1`, [match.param])) === null || _a === void 0 ? void 0 : _a.id;
    }
    getCardInfoByQuestion(question, excludeCardId) {
        var _a;
        const match = this.noteMatchCondition(question);
        const sql = excludeCardId
            ? `SELECT c.id, c.source_uid AS sourceUid FROM cards c
                   JOIN notes n ON c.note_id = n.id
                   WHERE ${match.sql} AND c.id != ? AND c.deleted_at IS NULL LIMIT 1`
            : `SELECT c.id, c.source_uid AS sourceUid FROM cards c
                   JOIN notes n ON c.note_id = n.id
                   WHERE ${match.sql} AND c.deleted_at IS NULL LIMIT 1`;
        const params = excludeCardId ? [match.param, excludeCardId] : [match.param];
        const row = this.db.get(sql, params);
        if (!row)
            return undefined;
        return { id: row.id, sourceUid: (_a = row.sourceUid) !== null && _a !== void 0 ? _a : undefined };
    }
    getCardIdByQuestionAndClozeIndex(question, clozeIndex) {
        var _a;
        const match = this.noteMatchCondition(question);
        return (_a = this.db.get(`SELECT c.id FROM cards c
                 JOIN notes n ON c.note_id = n.id
                 WHERE ${match.sql} AND c.template_ord = ? AND c.deleted_at IS NULL
                 LIMIT 1`, [match.param, clozeIndex])) === null || _a === void 0 ? void 0 : _a.id;
    }
    // ── Content checks ────────────────────────────────────────
    hasCardContent(cardId) {
        return this.has(cardId);
    }
    hasAnyCardContent() {
        return this.size() > 0;
    }
    getCardsWithContentCount() {
        return this.size();
    }
    // ── FSRS-only methods (no schema branching needed) ────────
    has(cardId) {
        return (this.db.get(`SELECT 1 as found FROM cards WHERE id = ? AND deleted_at IS NULL LIMIT 1`, [cardId]) !== null);
    }
    keys() {
        const rows = this.db.query(`SELECT id FROM cards WHERE deleted_at IS NULL`);
        return rows.map((r) => r.id);
    }
    size() {
        var _a, _b;
        return ((_b = (_a = this.db.get(`SELECT COUNT(*) as count FROM cards WHERE deleted_at IS NULL`)) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : 0);
    }
    softDelete(cardId) {
        const now = Date.now();
        this.db.run(`UPDATE cards SET deleted_at = ?, updated_at = ? WHERE id = ?`, [now, now, cardId]);
    }
    /** @deprecated Use softDelete() instead for sync compatibility */
    delete(cardId) {
        this.db.run(`DELETE FROM cards WHERE id = ?`, [cardId]);
    }
    updateCardSourceUid(cardId, sourceUid) {
        this.db.run(`UPDATE cards SET source_uid = ?, updated_at = ? WHERE id = ?`, [sourceUid, Date.now(), cardId]);
    }
    softDeleteWithCascade(cardId) {
        const now = Date.now();
        this.db.transaction(() => {
            this.db.run(`UPDATE cards SET deleted_at = ?, updated_at = ? WHERE id = ?`, [now, now, cardId]);
            this.db.run(`UPDATE review_log SET deleted_at = ?, updated_at = ? WHERE card_id = ?`, [now, now, cardId]);
        });
    }
    updateCardDue(cardId, newDue) {
        this.db.run(`UPDATE cards SET due = ?, updated_at = ? WHERE id = ?`, [
            newDue,
            Date.now(),
            cardId,
        ]);
    }
    updateCardScheduling(cardId, data) {
        this.db.run(`UPDATE cards SET due = ?, scheduled_days = ?, updated_at = ? WHERE id = ?`, [data.due, data.scheduledDays, Date.now(), cardId]);
    }
    // ── Sync ──────────────────────────────────────────────────
    getSyncMetadata(key) {
        var _a;
        const row = this.db.get(`SELECT value FROM meta WHERE key = ?`, [key]);
        return (_a = row === null || row === void 0 ? void 0 : row.value) !== null && _a !== void 0 ? _a : null;
    }
    setSyncMetadata(key, value) {
        this.db.run(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`, [
            key,
            value,
        ]);
    }
    deleteAllForSync() {
        this.db.run(`DELETE FROM cards`);
    }
    // ── Bulk operations ───────────────────────────────────────
    bulkSuspend(cardIds) {
        if (cardIds.length === 0)
            return 0;
        const placeholders = sqlPlaceholders(cardIds.length);
        const params = [Date.now(), ...cardIds];
        this.db.run(`UPDATE cards SET suspended = 1, updated_at = ? WHERE id IN (${placeholders})`, params);
        return this.db.getRowsModified();
    }
    bulkUnsuspend(cardIds) {
        if (cardIds.length === 0)
            return 0;
        const placeholders = sqlPlaceholders(cardIds.length);
        const params = [Date.now(), ...cardIds];
        this.db.run(`UPDATE cards SET suspended = 0, updated_at = ? WHERE id IN (${placeholders})`, params);
        return this.db.getRowsModified();
    }
    bulkBury(cardIds, untilDate) {
        if (cardIds.length === 0)
            return 0;
        const placeholders = sqlPlaceholders(cardIds.length);
        const params = [untilDate, Date.now(), ...cardIds];
        this.db.run(`UPDATE cards SET buried_until = ?, updated_at = ? WHERE id IN (${placeholders})`, params);
        return this.db.getRowsModified();
    }
    bulkUnbury(cardIds) {
        if (cardIds.length === 0)
            return 0;
        const placeholders = sqlPlaceholders(cardIds.length);
        const params = [Date.now(), ...cardIds];
        this.db.run(`UPDATE cards SET buried_until = NULL, updated_at = ? WHERE id IN (${placeholders})`, params);
        return this.db.getRowsModified();
    }
    bulkSoftDelete(cardIds) {
        if (cardIds.length === 0)
            return 0;
        const now = Date.now();
        const placeholders = sqlPlaceholders(cardIds.length);
        this.db.transaction(() => {
            this.db.run(`UPDATE review_log SET deleted_at = ?, updated_at = ? WHERE card_id IN (${placeholders})`, [now, now, ...cardIds]);
            this.db.run(`UPDATE cards SET deleted_at = ?, updated_at = ? WHERE id IN (${placeholders})`, [now, now, ...cardIds]);
        });
        return cardIds.length;
    }
    /** @deprecated Use bulkSoftDelete() instead for sync compatibility */
    bulkDelete(cardIds) {
        if (cardIds.length === 0)
            return 0;
        const placeholders = sqlPlaceholders(cardIds.length);
        this.db.transaction(() => {
            this.db.run(`DELETE FROM review_log WHERE card_id IN (${placeholders})`, cardIds);
            this.db.run(`DELETE FROM cards WHERE id IN (${placeholders})`, cardIds);
        });
        return cardIds.length;
    }
    /** @deprecated Use bulkForget() instead — it also clears review history */
    bulkReset(cardIds) {
        if (cardIds.length === 0)
            return 0;
        const placeholders = sqlPlaceholders(cardIds.length);
        const now = new Date().toISOString();
        const params = [now, Date.now(), ...cardIds];
        this.db.run(`UPDATE cards SET
                state = 0, reps = 0, lapses = 0,
                stability = 0, difficulty = 0, scheduled_days = 0,
                learning_step = 0, due = ?, last_review = NULL,
                suspended = 0, buried_until = NULL, updated_at = ?
            WHERE id IN (${placeholders})`, params);
        return this.db.getRowsModified();
    }
    bulkForget(cardIds) {
        if (cardIds.length === 0)
            return 0;
        const placeholders = sqlPlaceholders(cardIds.length);
        const forgettableRows = this.db.query(`SELECT id FROM cards WHERE id IN (${placeholders}) AND state != 0`, cardIds);
        const forgettableIds = forgettableRows.map((row) => row.id);
        if (forgettableIds.length === 0)
            return 0;
        const forgettablePlaceholders = sqlPlaceholders(forgettableIds.length);
        const now = new Date().toISOString();
        const nowMs = Date.now();
        let modified = 0;
        this.db.transaction(() => {
            this.db.run(`UPDATE cards SET
						state = 0, reps = 0, lapses = 0,
						stability = 0, difficulty = 0, scheduled_days = 0,
						learning_step = 0, due = ?, last_review = NULL,
						suspended = 0, buried_until = NULL, updated_at = ?
					WHERE id IN (${forgettablePlaceholders})`, [now, nowMs, ...forgettableIds]);
            modified = this.db.getRowsModified();
            this.db.run(`UPDATE review_log SET deleted_at = ?, updated_at = ? WHERE card_id IN (${forgettablePlaceholders})`, [nowMs, nowMs, ...forgettableIds]);
        });
        return modified;
    }
    bulkReschedule(cardIds, dueDate) {
        if (cardIds.length === 0)
            return 0;
        const placeholders = sqlPlaceholders(cardIds.length);
        const params = [dueDate, Date.now(), ...cardIds];
        this.db.run(`UPDATE cards SET due = ?, updated_at = ? WHERE id IN (${placeholders})`, params);
        return this.db.getRowsModified();
    }
}
