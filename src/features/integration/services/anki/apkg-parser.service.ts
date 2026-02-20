import { decompress } from "fzstd";
import JSZip from "jszip";
import type { App } from "obsidian";
import type {
	AnkiCard,
	AnkiDeck,
	AnkiModel,
	AnkiNote,
	AnkiRevlogEntry,
	ApkgData,
} from "shared/types";
import {
	type DatabaseLike,
	loadDatabase,
	type QueryExecResult,
} from "@features/core/persistence/sqlite/loader";

// Legacy format: models/decks stored as JSON in the `col` table
interface RawAnkiModel {
	name: string;
	flds: { name: string; ord: number }[];
	type: number;
	tmpls: { name: string; qfmt: string; afmt: string; ord: number }[];
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

		const { db } = await loadDatabase(this.app, dbData);

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
			const tmplResults = db.exec(
				"SELECT ord, name FROM templates WHERE ntid = ? ORDER BY ord",
				[id],
			);
			const tmpls = (tmplResults[0]?.values ?? []).map((r) => ({
				ord: r[0] as number,
				name: r[1] as string,
				qfmt: "",
				afmt: "",
			}));

			models.set(id, { id, name, flds, type, tmpls });
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

		try {
			const mediaJson = await mediaFile.async("string");
			mediaMap = JSON.parse(mediaJson) as Record<string, string>;
		} catch {
			console.error("[True Recall] Failed to parse media mapping from .apkg");
			return { media, mediaMap };
		}

		const extractionPromises: Promise<void>[] = [];
		for (const [numericKey, originalName] of Object.entries(mediaMap)) {
			const mediaEntry = zip.file(numericKey);
			if (!mediaEntry) continue;

			extractionPromises.push(
				mediaEntry.async("arraybuffer").then((data) => {
					media.set(originalName, data);
				}),
			);
		}

		await Promise.all(extractionPromises);

		return { media, mediaMap };
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
