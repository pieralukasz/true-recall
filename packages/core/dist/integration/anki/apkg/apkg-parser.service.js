import { __awaiter } from "tslib";
import { decompress } from "fzstd";
import JSZip from "jszip";
import { loadDatabase, } from "@true-recall/core/persistence/sqlite/loader";
// ── Minimal protobuf decoder ─────────────────────────────────
// Anki v18+ stores template formats and notetype CSS in protobuf config blobs.
// Wire format: tag = (field_number << 3) | wire_type
//   wire_type 0 = varint, 2 = length-delimited (string/bytes)
export function readProtobufVarint(blob, offset) {
    let value = 0;
    let shift = 0;
    let pos = offset;
    while (pos < blob.length) {
        const byte = blob[pos];
        if (byte === undefined)
            break;
        value |= (byte & 0x7f) << shift;
        pos++;
        if ((byte & 0x80) === 0)
            return { value, next: pos };
        shift += 7;
        if (shift > 35)
            return null;
    }
    return null;
}
export function readProtobufString(blob, fieldNumber) {
    const targetTag = (fieldNumber << 3) | 2; // wire type 2 = length-delimited
    let pos = 0;
    while (pos < blob.length) {
        const tag = readProtobufVarint(blob, pos);
        if (!tag)
            break;
        pos = tag.next;
        const wireType = tag.value & 0x07;
        if (wireType === 2) {
            const len = readProtobufVarint(blob, pos);
            if (!len)
                break;
            pos = len.next;
            if (tag.value === targetTag) {
                const bytes = blob.slice(pos, pos + len.value);
                return new TextDecoder().decode(bytes);
            }
            pos += len.value;
        }
        else if (wireType === 0) {
            // Varint — skip
            const v = readProtobufVarint(blob, pos);
            if (!v)
                break;
            pos = v.next;
        }
        else if (wireType === 5) {
            pos += 4; // 32-bit
        }
        else if (wireType === 1) {
            pos += 8; // 64-bit
        }
        else {
            break; // Unknown wire type
        }
    }
    return "";
}
// Anki v18+ stores media entries as protobuf:
// repeated MediaEntry { string name = 1; uint32 size = 2; bytes sha1 = 3; }
// The ordinal index of each entry is the numeric ZIP key.
export function parseMediaProtobuf(data) {
    const result = {};
    let pos = 0;
    let entryIndex = 0;
    while (pos < data.length) {
        const tag = readProtobufVarint(data, pos);
        if (!tag)
            break;
        pos = tag.next;
        const wireType = tag.value & 0x07;
        if (wireType === 2) {
            const len = readProtobufVarint(data, pos);
            if (!len)
                break;
            pos = len.next;
            const entryEnd = pos + len.value;
            const name = readProtobufString(data.slice(pos, entryEnd), 1);
            if (name) {
                result[String(entryIndex)] = name;
            }
            entryIndex++;
            pos = entryEnd;
        }
        else if (wireType === 0) {
            const v = readProtobufVarint(data, pos);
            if (!v)
                break;
            pos = v.next;
        }
        else if (wireType === 5) {
            pos += 4;
        }
        else if (wireType === 1) {
            pos += 8;
        }
        else {
            break;
        }
    }
    return result;
}
// Try anki21 (uncompressed) first, then anki21b (zstd-compressed, modern Anki).
// anki2 is last because modern exports include a dummy anki2 stub.
const DB_FILENAMES_UNCOMPRESSED = ["collection.anki21"];
const DB_FILENAME_COMPRESSED = "collection.anki21b";
const DB_FILENAME_LEGACY = "collection.anki2";
export class ApkgParserService {
    parseApkg(fileData) {
        return __awaiter(this, void 0, void 0, function* () {
            const zip = yield JSZip.loadAsync(fileData);
            const dbResult = this.findDatabaseFile(zip);
            if (!dbResult) {
                throw new Error("No Anki collection database found in .apkg file");
            }
            let dbData = yield dbResult.file.async("uint8array");
            if (dbResult.compressed) {
                dbData = decompress(dbData);
            }
            this.patchWalMode(dbData);
            const { db } = yield loadDatabase(dbData);
            try {
                const notes = this.readNotes(db);
                const cards = this.readCards(db);
                const revlog = this.readRevlog(db);
                const { models, decks } = this.isSchemaV18(db)
                    ? this.readCollectionV18(db)
                    : this.readCollectionLegacy(db);
                const { media, mediaMap } = yield this.readMedia(zip);
                return { notes, cards, revlog, models, decks, media, mediaMap };
            }
            finally {
                db.close();
            }
        });
    }
    findDatabaseFile(zip) {
        // 1. Uncompressed anki21 (legacy export or "Support older versions" enabled)
        for (const name of DB_FILENAMES_UNCOMPRESSED) {
            const file = zip.file(name);
            if (file)
                return { file, compressed: false };
        }
        // 2. Zstd-compressed anki21b (modern Anki 2.1.50+ default)
        const compressed = zip.file(DB_FILENAME_COMPRESSED);
        if (compressed)
            return { file: compressed, compressed: true };
        // 3. Legacy anki2 (oldest format; also present as dummy in modern exports, hence last)
        const legacy = zip.file(DB_FILENAME_LEGACY);
        if (legacy)
            return { file: legacy, compressed: false };
        return null;
    }
    // Schema v18 (Anki 2.1.50+) uses separate tables instead of JSON in `col`
    isSchemaV18(db) {
        try {
            db.exec("SELECT id FROM notetypes LIMIT 1");
            return true;
        }
        catch (_a) {
            return false;
        }
    }
    readNotes(db) {
        const results = db.exec("SELECT id, mid, flds, tags, sfld FROM notes");
        return this.mapRows(results, (row) => ({
            id: row[0],
            mid: row[1],
            flds: row[2],
            tags: row[3],
            sfld: row[4],
        }));
    }
    readCards(db) {
        const results = db.exec("SELECT id, nid, did, ord, type, queue, due, ivl, factor, reps, lapses FROM cards");
        return this.mapRows(results, (row) => ({
            id: row[0],
            nid: row[1],
            did: row[2],
            ord: row[3],
            type: row[4],
            queue: row[5],
            due: row[6],
            ivl: row[7],
            factor: row[8],
            reps: row[9],
            lapses: row[10],
        }));
    }
    readRevlog(db) {
        const results = db.exec("SELECT id, cid, ease, ivl, lastIvl, factor, time, type FROM revlog");
        return this.mapRows(results, (row) => ({
            id: row[0],
            cid: row[1],
            ease: row[2],
            ivl: row[3],
            lastIvl: row[4],
            factor: row[5],
            time: row[6],
            type: row[7],
        }));
    }
    // Legacy schema: models/decks stored as JSON columns in the `col` table
    readCollectionLegacy(db) {
        var _a;
        const results = db.exec("SELECT models, decks FROM col");
        const row = (_a = results[0]) === null || _a === void 0 ? void 0 : _a.values[0];
        if (!row) {
            return { models: new Map(), decks: new Map() };
        }
        const modelsJson = row[0];
        const decksJson = row[1];
        return {
            models: this.parseModelsJson(modelsJson),
            decks: this.parseDecksJson(decksJson),
        };
    }
    // Schema v18: notetypes, fields, templates, decks as separate tables
    readCollectionV18(db) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const models = new Map();
        const decks = new Map();
        // Read notetypes (equivalent to legacy models)
        const ntResults = db.exec("SELECT id, name, config FROM notetypes");
        for (const row of (_b = (_a = ntResults[0]) === null || _a === void 0 ? void 0 : _a.values) !== null && _b !== void 0 ? _b : []) {
            const id = row[0];
            const name = row[1];
            const configBlob = row[2];
            const type = this.detectNotetypeKind(configBlob);
            // Notetype.Config field 3 = css (string)
            const css = configBlob ? readProtobufString(configBlob, 3) : "";
            // Read fields for this notetype
            const fieldResults = db.exec("SELECT ord, name FROM fields WHERE ntid = ? ORDER BY ord", [id]);
            const flds = ((_d = (_c = fieldResults[0]) === null || _c === void 0 ? void 0 : _c.values) !== null && _d !== void 0 ? _d : []).map((r) => ({
                ord: r[0],
                name: r[1],
            }));
            // Read templates for this notetype
            // Template.Config: field 1 = q_format, field 2 = a_format
            const tmplResults = db.exec("SELECT ord, name, config FROM templates WHERE ntid = ? ORDER BY ord", [id]);
            const tmpls = ((_f = (_e = tmplResults[0]) === null || _e === void 0 ? void 0 : _e.values) !== null && _f !== void 0 ? _f : []).map((r) => {
                const tmplConfig = r[2];
                return {
                    ord: r[0],
                    name: r[1],
                    qfmt: tmplConfig ? readProtobufString(tmplConfig, 1) : "",
                    afmt: tmplConfig ? readProtobufString(tmplConfig, 2) : "",
                };
            });
            models.set(id, { id, name, flds, type, tmpls, css });
        }
        // Read decks
        const deckResults = db.exec("SELECT id, name FROM decks");
        for (const row of (_h = (_g = deckResults[0]) === null || _g === void 0 ? void 0 : _g.values) !== null && _h !== void 0 ? _h : []) {
            decks.set(row[0], {
                id: row[0],
                name: row[1],
            });
        }
        return { models, decks };
    }
    // Protobuf Notetype.Config: field 1 (kind) is a varint
    // tag byte 0x08 = field 1, wire type 0 (varint)
    // KIND_NORMAL = 0 (default, often omitted), KIND_CLOZE = 1
    detectNotetypeKind(config) {
        var _a;
        if (!config || config.length < 2)
            return 0;
        if (config[0] === 0x08) {
            return (_a = config[1]) !== null && _a !== void 0 ? _a : 0;
        }
        return 0;
    }
    parseModelsJson(json) {
        var _a, _b, _c;
        const models = new Map();
        let raw;
        try {
            raw = JSON.parse(json);
        }
        catch (_d) {
            console.error("[True Recall] Failed to parse Anki models JSON");
            return models;
        }
        for (const [idStr, model] of Object.entries(raw)) {
            const id = Number(idStr);
            if (Number.isNaN(id))
                continue;
            models.set(id, {
                id,
                name: model.name,
                flds: ((_a = model.flds) !== null && _a !== void 0 ? _a : []).map((f) => ({ name: f.name, ord: f.ord })),
                type: (_b = model.type) !== null && _b !== void 0 ? _b : 0,
                tmpls: ((_c = model.tmpls) !== null && _c !== void 0 ? _c : []).map((t) => ({
                    name: t.name,
                    qfmt: t.qfmt,
                    afmt: t.afmt,
                    ord: t.ord,
                })),
                css: model.css,
            });
        }
        return models;
    }
    parseDecksJson(json) {
        const decks = new Map();
        let raw;
        try {
            raw = JSON.parse(json);
        }
        catch (_a) {
            console.error("[True Recall] Failed to parse Anki decks JSON");
            return decks;
        }
        for (const [idStr, deck] of Object.entries(raw)) {
            const id = Number(idStr);
            if (Number.isNaN(id))
                continue;
            decks.set(id, { id, name: deck.name });
        }
        return decks;
    }
    readMedia(zip) {
        return __awaiter(this, void 0, void 0, function* () {
            const media = new Map();
            let mediaMap = {};
            const mediaFile = zip.file("media");
            if (!mediaFile) {
                return { media, mediaMap };
            }
            let rawBytes = yield mediaFile.async("uint8array");
            // Modern Anki (2.1.50+) may zstd-compress the media file
            if (this.isZstdCompressed(rawBytes)) {
                rawBytes = decompress(rawBytes);
            }
            // Try JSON first (legacy format: {"0": "filename.jpg", ...})
            try {
                const text = new TextDecoder().decode(rawBytes);
                mediaMap = JSON.parse(text);
            }
            catch (_a) {
                // Modern Anki uses protobuf: repeated { string name = 1; ... }
                mediaMap = this.parseMediaProtobuf(rawBytes);
            }
            const extractionPromises = [];
            for (const [numericKey, originalName] of Object.entries(mediaMap)) {
                const mediaEntry = zip.file(numericKey);
                if (!mediaEntry)
                    continue;
                extractionPromises.push(mediaEntry.async("arraybuffer").then((data) => {
                    const raw = new Uint8Array(data);
                    if (this.isZstdCompressed(raw)) {
                        const out = decompress(raw);
                        media.set(originalName, out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength));
                    }
                    else {
                        media.set(originalName, data);
                    }
                }));
            }
            yield Promise.all(extractionPromises);
            return { media, mediaMap };
        });
    }
    isZstdCompressed(data) {
        return (data.length >= 4 &&
            data[0] === 0x28 &&
            data[1] === 0xb5 &&
            data[2] === 0x2f &&
            data[3] === 0xfd);
    }
    parseMediaProtobuf(data) {
        return parseMediaProtobuf(data);
    }
    // SQLite header bytes 18-19: file format read/write version
    // 1 = rollback journal, 2 = WAL
    // sqlite3_deserialize cannot handle WAL-mode databases (throws SQLITE_CANTOPEN)
    // Safe to patch: Anki checkpoints WAL before export, all data is in the main file
    patchWalMode(data) {
        if (data.byteLength > 19 && data[18] === 2) {
            data[18] = 1;
            data[19] = 1;
        }
    }
    mapRows(results, mapper) {
        const result = results[0];
        if (!result)
            return [];
        return result.values.map(mapper);
    }
}
