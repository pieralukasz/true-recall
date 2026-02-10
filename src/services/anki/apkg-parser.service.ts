import type { App } from "obsidian";
import JSZip from "jszip";
import type {
	ApkgData,
	AnkiNote,
	AnkiCard,
	AnkiRevlogEntry,
	AnkiModel,
	AnkiDeck,
} from "types";
import { loadDatabase, type DatabaseLike, type QueryExecResult } from "../persistence/sqlite/loader";

// Anki stores models/decks JSON with numeric string keys
interface RawAnkiModel {
	name: string;
	flds: { name: string; ord: number }[];
	type: number;
	tmpls: { name: string; qfmt: string; afmt: string; ord: number }[];
}

interface RawAnkiDeck {
	name: string;
}

// Preference order: newer format first, then legacy
const DB_FILENAMES = ["collection.anki21b", "collection.anki21", "collection.anki2"];

export class ApkgParserService {
	constructor(private app: App) {}

	async parseApkg(fileData: ArrayBuffer): Promise<ApkgData> {
		const zip = await JSZip.loadAsync(fileData);

		const dbFile = this.findDatabaseFile(zip);
		if (!dbFile) {
			throw new Error("No Anki collection database found in .apkg file");
		}

		const dbData = await dbFile.async("uint8array");
		const { db } = await loadDatabase(this.app, dbData);

		try {
			const notes = this.readNotes(db);
			const cards = this.readCards(db);
			const revlog = this.readRevlog(db);
			const { models, decks } = this.readCollection(db);
			const { media, mediaMap } = await this.readMedia(zip);

			return { notes, cards, revlog, models, decks, media, mediaMap };
		} finally {
			db.close();
		}
	}

	private findDatabaseFile(zip: JSZip): JSZip.JSZipObject | null {
		for (const name of DB_FILENAMES) {
			const file = zip.file(name);
			if (file) return file;
		}
		return null;
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
			"SELECT id, nid, did, ord, type, queue, due, ivl, factor, reps, lapses FROM cards"
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
			"SELECT id, cid, ease, ivl, lastIvl, factor, time, type FROM revlog"
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

	private readCollection(db: DatabaseLike): {
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
			models: this.parseModels(modelsJson),
			decks: this.parseDecks(decksJson),
		};
	}

	private parseModels(json: string): Map<number, AnkiModel> {
		const models = new Map<number, AnkiModel>();
		let raw: Record<string, RawAnkiModel>;

		try {
			raw = JSON.parse(json) as Record<string, RawAnkiModel>;
		} catch {
			console.warn("[True Recall] Failed to parse Anki models JSON");
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

	private parseDecks(json: string): Map<number, AnkiDeck> {
		const decks = new Map<number, AnkiDeck>();
		let raw: Record<string, RawAnkiDeck>;

		try {
			raw = JSON.parse(json) as Record<string, RawAnkiDeck>;
		} catch {
			console.warn("[True Recall] Failed to parse Anki decks JSON");
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

		// The "media" file is a JSON mapping from numeric keys to original filenames
		const mediaFile = zip.file("media");
		if (!mediaFile) {
			return { media, mediaMap };
		}

		try {
			const mediaJson = await mediaFile.async("string");
			mediaMap = JSON.parse(mediaJson) as Record<string, string>;
		} catch {
			console.warn("[True Recall] Failed to parse media mapping from .apkg");
			return { media, mediaMap };
		}

		// Extract each numbered media file and map it to its original filename
		const extractionPromises: Promise<void>[] = [];
		for (const [numericKey, originalName] of Object.entries(mediaMap)) {
			const mediaEntry = zip.file(numericKey);
			if (!mediaEntry) continue;

			extractionPromises.push(
				mediaEntry.async("arraybuffer").then((data) => {
					media.set(originalName, data);
				})
			);
		}

		await Promise.all(extractionPromises);

		return { media, mediaMap };
	}

	private mapRows<T>(
		results: QueryExecResult[],
		mapper: (row: (string | number | null | Uint8Array)[]) => T
	): T[] {
		const result = results[0];
		if (!result) return [];
		return result.values.map(mapper);
	}
}
