import {
	type DatabaseLike,
	loadDatabase,
	type QueryExecResult,
} from "@features/core/persistence/sqlite/loader";
import type {
	AnkiCard,
	AnkiDeck,
	AnkiModel,
	AnkiNote,
	AnkiRevlogEntry,
	ApkgData,
} from "@shared/types";
import { decompress } from "fzstd";
import JSZip from "jszip";
import type { App } from "obsidian";

// Legacy format: models/decks stored as JSON in the `col` table
interface RawAnkiModel {
	name: string;
	flds: { name: string; ord: number }[];
	type: number;
	tmpls: { name: string; qfmt: string; afmt: string; ord: number }[];
	css?: string;
}

// ── Minimal protobuf decoder ─────────────────────────────────
// Anki v18+ stores template formats and notetype CSS in protobuf config blobs.
// Wire format: tag = (field_number << 3) | wire_type
//   wire_type 0 = varint, 2 = length-delimited (string/bytes)

export function readProtobufVarint(
	blob: Uint8Array,
	offset: number,
): { value: number; next: number } | null {
	let value = 0;
	let shift = 0;
	let pos = offset;
	while (pos < blob.length) {
		const byte = blob[pos];
		if (byte === undefined) break;
		value |= (byte & 0x7f) << shift;
		pos++;
		if ((byte & 0x80) === 0) return { value, next: pos };
		shift += 7;
		if (shift > 35) return null;
	}
	return null;
}

export function readProtobufString(
	blob: Uint8Array,
	fieldNumber: number,
): string {
	const targetTag = (fieldNumber << 3) | 2; // wire type 2 = length-delimited
	let pos = 0;

	while (pos < blob.length) {
		const tag = readProtobufVarint(blob, pos);
		if (!tag) break;
		pos = tag.next;

		const wireType = tag.value & 0x07;

		if (wireType === 2) {
			const len = readProtobufVarint(blob, pos);
			if (!len) break;
			pos = len.next;

			if (tag.value === targetTag) {
				const bytes = blob.slice(pos, pos + len.value);
				return new TextDecoder().decode(bytes);
			}
			pos += len.value;
		} else if (wireType === 0) {
			// Varint — skip
			const v = readProtobufVarint(blob, pos);
			if (!v) break;
			pos = v.next;
		} else if (wireType === 5) {
			pos += 4; // 32-bit
		} else if (wireType === 1) {
			pos += 8; // 64-bit
		} else {
			break; // Unknown wire type
		}
	}

	return "";
}

// Anki v18+ stores media entries as protobuf:
// repeated MediaEntry { string name = 1; uint32 size = 2; bytes sha1 = 3; }
// The ordinal index of each entry is the numeric ZIP key.
export function parseMediaProtobuf(data: Uint8Array): Record<string, string> {
	const result: Record<string, string> = {};
	let pos = 0;
	let entryIndex = 0;

	while (pos < data.length) {
		const tag = readProtobufVarint(data, pos);
		if (!tag) break;
		pos = tag.next;

		const wireType = tag.value & 0x07;

		if (wireType === 2) {
			const len = readProtobufVarint(data, pos);
			if (!len) break;
			pos = len.next;

			const entryEnd = pos + len.value;
			const name = readProtobufString(data.slice(pos, entryEnd), 1);
			if (name) {
				result[String(entryIndex)] = name;
			}
			entryIndex++;
			pos = entryEnd;
		} else if (wireType === 0) {
			const v = readProtobufVarint(data, pos);
			if (!v) break;
			pos = v.next;
		} else if (wireType === 5) {
			pos += 4;
		} else if (wireType === 1) {
			pos += 8;
		} else {
			break;
		}
	}

	return result;
}

interface RawAnkiDeck {
	name: string;
}

// Try anki21 (uncompressed) first, then anki21b (zstd-compressed, modern Anki).
// anki2 is last because modern exports include a dummy anki2 stub.
const DB_FILENAMES_UNCOMPRESSED = ["collection.anki21"];
const DB_FILENAME_COMPRESSED = "collection.anki21b";
const DB_FILENAME_LEGACY = "collection.anki2";

interface DbFileResult {
	file: JSZip.JSZipObject;
	compressed: boolean;
}

export class ApkgParserService {
	constructor(private app: App) {}

	async parseApkg(fileData: ArrayBuffer): Promise<ApkgData> {
		const zip = await JSZip.loadAsync(fileData);

		const dbResult = this.findDatabaseFile(zip);
		if (!dbResult) {
			throw new Error("No Anki collection database found in .apkg file");
		}

		let dbData = await dbResult.file.async("uint8array");

		if (dbResult.compressed) {
			dbData = decompress(dbData);
		}

		this.patchWalMode(dbData);
		const { db } = await loadDatabase(dbData);

		try {
			const notes = this.readNotes(db);
			const cards = this.readCards(db);
			const revlog = this.readRevlog(db);
			const { models, decks } = this.isSchemaV18(db)
				? this.readCollectionV18(db)
				: this.readCollectionLegacy(db);
			const { media, mediaMap } = await this.readMedia(zip);

			return { notes, cards, revlog, models, decks, media, mediaMap };
		} finally {
			db.close();
		}
	}

	private findDatabaseFile(zip: JSZip): DbFileResult | null {
		// 1. Uncompressed anki21 (legacy export or "Support older versions" enabled)
		for (const name of DB_FILENAMES_UNCOMPRESSED) {
			const file = zip.file(name);
			if (file) return { file, compressed: false };
		}

		// 2. Zstd-compressed anki21b (modern Anki 2.1.50+ default)
		const compressed = zip.file(DB_FILENAME_COMPRESSED);
		if (compressed) return { file: compressed, compressed: true };

		// 3. Legacy anki2 (oldest format; also present as dummy in modern exports, hence last)
		const legacy = zip.file(DB_FILENAME_LEGACY);
		if (legacy) return { file: legacy, compressed: false };

		return null;
	}

	// Schema v18 (Anki 2.1.50+) uses separate tables instead of JSON in `col`
	private isSchemaV18(db: DatabaseLike): boolean {
		try {
			db.exec("SELECT id FROM notetypes LIMIT 1");
			return true;
		} catch {
			return false;
		}
	}

	private readNotes(db: DatabaseLike): AnkiNote[] {
		const results = db.exec("SELECT id, mid, flds, tags, sfld FROM notes");
		return this.mapRows(results, (row) => ({
			id: row[0] as number,
			mid: row[1] as number,
			flds: row[2] as string,
			tags: row[3] as string,
			sfld: row[4] as string,
		}));
	}

	private readCards(db: DatabaseLike): AnkiCard[] {
		const results = db.exec(
			"SELECT id, nid, did, ord, type, queue, due, ivl, factor, reps, lapses FROM cards",
		);
		return this.mapRows(results, (row) => ({
			id: row[0] as number,
			nid: row[1] as number,
			did: row[2] as number,
			ord: row[3] as number,
			type: row[4] as number,
			queue: row[5] as number,
			due: row[6] as number,
			ivl: row[7] as number,
			factor: row[8] as number,
			reps: row[9] as number,
			lapses: row[10] as number,
		}));
	}

	private readRevlog(db: DatabaseLike): AnkiRevlogEntry[] {
		const results = db.exec(
			"SELECT id, cid, ease, ivl, lastIvl, factor, time, type FROM revlog",
		);
		return this.mapRows(results, (row) => ({
			id: row[0] as number,
			cid: row[1] as number,
			ease: row[2] as number,
			ivl: row[3] as number,
			lastIvl: row[4] as number,
			factor: row[5] as number,
			time: row[6] as number,
			type: row[7] as number,
		}));
	}

	// Legacy schema: models/decks stored as JSON columns in the `col` table
	private readCollectionLegacy(db: DatabaseLike): {
		models: Map<number, AnkiModel>;
		decks: Map<number, AnkiDeck>;
	} {
		const results = db.exec("SELECT models, decks FROM col");
		const row = results[0]?.values[0];
		if (!row) {
			return { models: new Map(), decks: new Map() };
		}

		const modelsJson = row[0] as string;
		const decksJson = row[1] as string;

		return {
			models: this.parseModelsJson(modelsJson),
			decks: this.parseDecksJson(decksJson),
		};
	}

	// Schema v18: notetypes, fields, templates, decks as separate tables
	private readCollectionV18(db: DatabaseLike): {
		models: Map<number, AnkiModel>;
		decks: Map<number, AnkiDeck>;
	} {
		const models = new Map<number, AnkiModel>();
		const decks = new Map<number, AnkiDeck>();

		// Read notetypes (equivalent to legacy models)
		const ntResults = db.exec("SELECT id, name, config FROM notetypes");
		for (const row of ntResults[0]?.values ?? []) {
			const id = row[0] as number;
			const name = row[1] as string;
			const configBlob = row[2] as Uint8Array | null;

			const type = this.detectNotetypeKind(configBlob);
			// Notetype.Config field 3 = css (string)
			const css = configBlob ? readProtobufString(configBlob, 3) : "";

			// Read fields for this notetype
			const fieldResults = db.exec(
				"SELECT ord, name FROM fields WHERE ntid = ? ORDER BY ord",
				[id],
			);
			const flds = (fieldResults[0]?.values ?? []).map((r) => ({
				ord: r[0] as number,
				name: r[1] as string,
			}));

			// Read templates for this notetype
			// Template.Config: field 1 = q_format, field 2 = a_format
			const tmplResults = db.exec(
				"SELECT ord, name, config FROM templates WHERE ntid = ? ORDER BY ord",
				[id],
			);
			const tmpls = (tmplResults[0]?.values ?? []).map((r) => {
				const tmplConfig = r[2] as Uint8Array | null;
				return {
					ord: r[0] as number,
					name: r[1] as string,
					qfmt: tmplConfig ? readProtobufString(tmplConfig, 1) : "",
					afmt: tmplConfig ? readProtobufString(tmplConfig, 2) : "",
				};
			});

			models.set(id, { id, name, flds, type, tmpls, css });
		}

		// Read decks
		const deckResults = db.exec("SELECT id, name FROM decks");
		for (const row of deckResults[0]?.values ?? []) {
			decks.set(row[0] as number, {
				id: row[0] as number,
				name: row[1] as string,
			});
		}

		return { models, decks };
	}

	// Protobuf Notetype.Config: field 1 (kind) is a varint
	// tag byte 0x08 = field 1, wire type 0 (varint)
	// KIND_NORMAL = 0 (default, often omitted), KIND_CLOZE = 1
	private detectNotetypeKind(config: Uint8Array | null): number {
		if (!config || config.length < 2) return 0;
		if (config[0] === 0x08) {
			return config[1] ?? 0;
		}
		return 0;
	}

	private parseModelsJson(json: string): Map<number, AnkiModel> {
		const models = new Map<number, AnkiModel>();
		let raw: Record<string, RawAnkiModel>;

		try {
			raw = JSON.parse(json) as Record<string, RawAnkiModel>;
		} catch {
			console.error("[True Recall] Failed to parse Anki models JSON");
			return models;
		}

		for (const [idStr, model] of Object.entries(raw)) {
			const id = Number(idStr);
			if (Number.isNaN(id)) continue;

			models.set(id, {
				id,
				name: model.name,
				flds: (model.flds ?? []).map((f) => ({ name: f.name, ord: f.ord })),
				type: model.type ?? 0,
				tmpls: (model.tmpls ?? []).map((t) => ({
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

	private parseDecksJson(json: string): Map<number, AnkiDeck> {
		const decks = new Map<number, AnkiDeck>();
		let raw: Record<string, RawAnkiDeck>;

		try {
			raw = JSON.parse(json) as Record<string, RawAnkiDeck>;
		} catch {
			console.error("[True Recall] Failed to parse Anki decks JSON");
			return decks;
		}

		for (const [idStr, deck] of Object.entries(raw)) {
			const id = Number(idStr);
			if (Number.isNaN(id)) continue;

			decks.set(id, { id, name: deck.name });
		}

		return decks;
	}

	private async readMedia(zip: JSZip): Promise<{
		media: Map<string, ArrayBuffer>;
		mediaMap: Record<string, string>;
	}> {
		const media = new Map<string, ArrayBuffer>();
		let mediaMap: Record<string, string> = {};

		const mediaFile = zip.file("media");
		if (!mediaFile) {
			return { media, mediaMap };
		}

		let rawBytes = await mediaFile.async("uint8array");

		// Modern Anki (2.1.50+) may zstd-compress the media file
		if (this.isZstdCompressed(rawBytes)) {
			rawBytes = decompress(rawBytes);
		}

		// Try JSON first (legacy format: {"0": "filename.jpg", ...})
		try {
			const text = new TextDecoder().decode(rawBytes);
			mediaMap = JSON.parse(text) as Record<string, string>;
		} catch {
			// Modern Anki uses protobuf: repeated { string name = 1; ... }
			mediaMap = this.parseMediaProtobuf(rawBytes);
		}

		const extractionPromises: Promise<void>[] = [];
		for (const [numericKey, originalName] of Object.entries(mediaMap)) {
			const mediaEntry = zip.file(numericKey);
			if (!mediaEntry) continue;

			extractionPromises.push(
				mediaEntry.async("arraybuffer").then((data) => {
					const raw = new Uint8Array(data);
					if (this.isZstdCompressed(raw)) {
						const out = decompress(raw);
						media.set(
							originalName,
							out.buffer.slice(
								out.byteOffset,
								out.byteOffset + out.byteLength,
							) as ArrayBuffer,
						);
					} else {
						media.set(originalName, data);
					}
				}),
			);
		}

		await Promise.all(extractionPromises);

		return { media, mediaMap };
	}

	private isZstdCompressed(data: Uint8Array): boolean {
		return (
			data.length >= 4 &&
			data[0] === 0x28 &&
			data[1] === 0xb5 &&
			data[2] === 0x2f &&
			data[3] === 0xfd
		);
	}

	private parseMediaProtobuf(data: Uint8Array): Record<string, string> {
		return parseMediaProtobuf(data);
	}

	// SQLite header bytes 18-19: file format read/write version
	// 1 = rollback journal, 2 = WAL
	// sqlite3_deserialize cannot handle WAL-mode databases (throws SQLITE_CANTOPEN)
	// Safe to patch: Anki checkpoints WAL before export, all data is in the main file
	private patchWalMode(data: Uint8Array): void {
		if (data.byteLength > 19 && data[18] === 2) {
			data[18] = 1;
			data[19] = 1;
		}
	}

	private mapRows<T>(
		results: QueryExecResult[],
		mapper: (row: (string | number | null | Uint8Array)[]) => T,
	): T[] {
		const result = results[0];
		if (!result) return [];
		return result.values.map(mapper);
	}
}
