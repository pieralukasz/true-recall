import {
	type DatabaseLike,
	loadDatabase,
} from "@true-recall/core/persistence/sqlite/loader";
import type { ReviewLogForSync } from "@true-recall/core/persistence/sqlite/modules/StatsActions";
import type { FSRSCardData } from "@true-recall/core/types";
import JSZip from "jszip";
import { State } from "ts-fsrs";

const FIELD_SEPARATOR = "\x1f";

const ANKI_QUEUE_SUSPENDED = -1;

const DIFFICULTY_INVERSION_CONSTANT = 11;
const FACTOR_SCALE = 250;
const FACTOR_MIN = 1300;
const FACTOR_MAX = 10000;
const FACTOR_DEFAULT = 2500;

// Base91 charset used by Anki for note GUIDs
const BASE91_CHARS =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789" +
	"!#$%&()*+,-./:;<=>?@[]^_`{|}~";

interface DeckInfo {
	id: number;
	name: string;
}

interface BuildOptions {
	cards: FSRSCardData[];
	reviewLogs: ReviewLogForSync[];
	deckMap: Map<string, DeckInfo>;
	collectionCreatedAt: number;
	includeScheduling: boolean;
	media: Map<string, ArrayBuffer>;
}

export class ApkgBuilderService {
	async build(options: BuildOptions): Promise<ArrayBuffer> {
		const { db } = await loadDatabase(null);

		try {
			this.createAnkiSchema(db);
			this.insertCollection(db, options);
			this.insertNotesAndCards(db, options);
			if (options.includeScheduling) {
				this.insertRevlog(db, options);
			}

			const dbBytes = db.export();
			return this.packageAsZip(dbBytes, options.media);
		} finally {
			db.close();
		}
	}

	private createAnkiSchema(db: DatabaseLike): void {
		db.run(`
            CREATE TABLE col (
                id INTEGER PRIMARY KEY,
                crt INTEGER NOT NULL,
                mod INTEGER NOT NULL,
                scm INTEGER NOT NULL,
                ver INTEGER NOT NULL,
                dty INTEGER NOT NULL,
                usn INTEGER NOT NULL,
                ls INTEGER NOT NULL,
                conf TEXT NOT NULL,
                models TEXT NOT NULL,
                decks TEXT NOT NULL,
                dconf TEXT NOT NULL,
                tags TEXT NOT NULL
            )
        `);

		db.run(`
            CREATE TABLE notes (
                id INTEGER PRIMARY KEY,
                guid TEXT NOT NULL,
                mid INTEGER NOT NULL,
                mod INTEGER NOT NULL,
                usn INTEGER NOT NULL,
                tags TEXT NOT NULL,
                flds TEXT NOT NULL,
                sfld TEXT NOT NULL,
                csum INTEGER NOT NULL,
                flags INTEGER NOT NULL,
                data TEXT NOT NULL
            )
        `);

		db.run(`
            CREATE TABLE cards (
                id INTEGER PRIMARY KEY,
                nid INTEGER NOT NULL,
                did INTEGER NOT NULL,
                ord INTEGER NOT NULL,
                mod INTEGER NOT NULL,
                usn INTEGER NOT NULL,
                type INTEGER NOT NULL,
                queue INTEGER NOT NULL,
                due INTEGER NOT NULL,
                ivl INTEGER NOT NULL,
                factor INTEGER NOT NULL,
                reps INTEGER NOT NULL,
                lapses INTEGER NOT NULL,
                left INTEGER NOT NULL,
                odue INTEGER NOT NULL,
                odid INTEGER NOT NULL,
                flags INTEGER NOT NULL,
                data TEXT NOT NULL
            )
        `);

		db.run(`
            CREATE TABLE revlog (
                id INTEGER PRIMARY KEY,
                cid INTEGER NOT NULL,
                usn INTEGER NOT NULL,
                ease INTEGER NOT NULL,
                ivl INTEGER NOT NULL,
                lastIvl INTEGER NOT NULL,
                factor INTEGER NOT NULL,
                time INTEGER NOT NULL,
                type INTEGER NOT NULL
            )
        `);

		db.run(`
            CREATE TABLE graves (
                usn INTEGER NOT NULL,
                oid INTEGER NOT NULL,
                type INTEGER NOT NULL
            )
        `);
	}

	private insertCollection(db: DatabaseLike, options: BuildOptions): void {
		const { deckMap, collectionCreatedAt } = options;
		const nowSecs = Math.floor(Date.now() / 1000);

		const models = this.buildModelsJson();
		const decks = this.buildDecksJson(deckMap);
		const conf = this.buildConfJson();
		const dconf = this.buildDconfJson();

		db.run(
			`INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				1,
				collectionCreatedAt,
				nowSecs,
				nowSecs * 1000,
				11, // Anki schema version
				0,
				-1,
				0,
				conf,
				models,
				decks,
				dconf,
				"{}",
			],
		);
	}

	private insertNotesAndCards(db: DatabaseLike, options: BuildOptions): void {
		const { cards, deckMap, collectionCreatedAt, includeScheduling } = options;
		const nowSecs = Math.floor(Date.now() / 1000);

		// Group reversed cards with their originals so they share one note
		const reversePairs = new Map<string, FSRSCardData>();
		const standalone: FSRSCardData[] = [];

		for (const card of cards) {
			if (card.cardType === "note-review") continue;
			if (card.cardType === "reversed" && card.reverseOf) {
				reversePairs.set(card.reverseOf, card);
			} else {
				standalone.push(card);
			}
		}

		let newCardPosition = 0;

		for (const card of standalone) {
			const noteId = deterministicId(card.id, "note");
			const cardId = deterministicId(card.id, "card");
			const question = card.question ?? "";
			const answer = card.answer ?? "";

			const isCloze = card.cardType === "cloze";
			const modelId = isCloze ? 2 : 1;

			const flds = isCloze
				? (card.clozeTemplate ?? question) + FIELD_SEPARATOR + answer
				: question + FIELD_SEPARATOR + answer;

			const sfld = isCloze ? (card.clozeTemplate ?? question) : question;
			const guid = generateGuid(card.id);
			const csum = checksumFirst8(sfld);

			const deckId = this.resolveDeckId(card, deckMap);

			db.run(
				`INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[noteId, guid, modelId, nowSecs, -1, "", flds, sfld, csum, 0, ""],
			);

			const ord = isCloze ? (card.clozeIndex ?? 1) - 1 : 0;

			if (includeScheduling) {
				const { type, queue, due, ivl, factor } = this.mapFsrsToAnki(
					card,
					collectionCreatedAt,
					newCardPosition,
				);

				db.run(
					`INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						cardId,
						noteId,
						deckId,
						ord,
						nowSecs,
						-1,
						type,
						queue,
						due,
						ivl,
						factor,
						card.reps,
						card.lapses,
						0,
						0,
						0,
						0,
						"",
					],
				);
			} else {
				db.run(
					`INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						cardId,
						noteId,
						deckId,
						ord,
						nowSecs,
						-1,
						0,
						0,
						newCardPosition,
						0,
						0,
						0,
						0,
						0,
						0,
						0,
						0,
						"",
					],
				);
			}

			if (card.state === State.New) newCardPosition++;

			// Handle reversed pair: second card (ord=1) on the same note
			const reversed = reversePairs.get(card.id);
			if (reversed) {
				const reversedCardId = deterministicId(reversed.id, "card");
				const reversedDeckId = this.resolveDeckId(reversed, deckMap);

				if (includeScheduling) {
					const { type, queue, due, ivl, factor } = this.mapFsrsToAnki(
						reversed,
						collectionCreatedAt,
						newCardPosition,
					);

					db.run(
						`INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
						[
							reversedCardId,
							noteId,
							reversedDeckId,
							1,
							nowSecs,
							-1,
							type,
							queue,
							due,
							ivl,
							factor,
							reversed.reps,
							reversed.lapses,
							0,
							0,
							0,
							0,
							"",
						],
					);
				} else {
					db.run(
						`INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
						[
							reversedCardId,
							noteId,
							reversedDeckId,
							1,
							nowSecs,
							-1,
							0,
							0,
							newCardPosition,
							0,
							0,
							0,
							0,
							0,
							0,
							0,
							0,
							"",
						],
					);
				}

				if (reversed.state === State.New) newCardPosition++;
			}
		}
	}

	private insertRevlog(db: DatabaseLike, options: BuildOptions): void {
		const { reviewLogs, cards } = options;

		// Build a lookup from True Recall card ID -> Anki card ID
		const cardIdMap = new Map<string, number>();
		for (const card of cards) {
			cardIdMap.set(card.id, deterministicId(card.id, "card"));
		}

		// Track previous interval per card for lastIvl
		const prevIntervalMap = new Map<number, number>();

		// Sort by reviewedAt to process in chronological order
		const sorted = [...reviewLogs].sort(
			(a, b) =>
				new Date(a.reviewedAt).getTime() - new Date(b.reviewedAt).getTime(),
		);

		for (const log of sorted) {
			if (log.deletedAt !== null) continue;

			const ankiCardId = cardIdMap.get(log.cardId);
			if (ankiCardId === undefined) continue;

			const reviewTimeMs = new Date(log.reviewedAt).getTime();
			const ease = Math.max(1, Math.min(4, log.rating));
			const ivl = log.scheduledDays;
			const lastIvl = prevIntervalMap.get(ankiCardId) ?? 0;
			const factor = FACTOR_DEFAULT;
			const time = log.timeSpentMs;
			// Anki revlog type matches FSRS state for the review context
			const type = Math.max(0, Math.min(3, log.state));

			db.run(
				`INSERT INTO revlog (id, cid, usn, ease, ivl, lastIvl, factor, time, type)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[reviewTimeMs, ankiCardId, -1, ease, ivl, lastIvl, factor, time, type],
			);

			prevIntervalMap.set(ankiCardId, ivl);
		}
	}

	private mapFsrsToAnki(
		card: FSRSCardData,
		collectionCreatedAt: number,
		newCardPosition: number,
	): { type: number; queue: number; due: number; ivl: number; factor: number } {
		const state = card.state;

		const type = Math.max(0, Math.min(3, state));
		let queue = type;
		if (card.suspended) {
			queue = ANKI_QUEUE_SUSPENDED;
		}

		const ivl = Math.max(0, card.scheduledDays);

		// Anki factor = (11 - FSRS_difficulty) * 250, clamped to [1300, 10000]
		const rawFactor = Math.round(
			(DIFFICULTY_INVERSION_CONSTANT - card.difficulty) * FACTOR_SCALE,
		);
		const factor = Math.max(FACTOR_MIN, Math.min(FACTOR_MAX, rawFactor));

		let due: number;
		if (state === State.New) {
			due = newCardPosition;
		} else if (state === State.Review) {
			// Anki stores due as days since collection creation for review cards
			const dueDateMs = new Date(card.due).getTime();
			const collectionMs = collectionCreatedAt * 1000;
			due = Math.max(
				0,
				Math.floor((dueDateMs - collectionMs) / (86400 * 1000)),
			);
		} else {
			// Learning/relearning: due is a Unix timestamp in seconds
			due = Math.floor(new Date(card.due).getTime() / 1000);
		}

		return { type, queue, due, ivl, factor };
	}

	private resolveDeckId(
		card: FSRSCardData,
		deckMap: Map<string, DeckInfo>,
	): number {
		if (card.sourceNoteName) {
			const deck = deckMap.get(card.sourceNoteName);
			if (deck) return deck.id;
		}

		return deckMap.get("Default")?.id ?? 1;
	}

	private buildModelsJson(): string {
		const basicModel = {
			id: 1,
			name: "Basic (and reversed card)",
			type: 0,
			mod: 0,
			usn: -1,
			sortf: 0,
			did: 1,
			tmpls: [
				{
					name: "Card 1",
					ord: 0,
					qfmt: "{{Front}}",
					afmt: "{{FrontSide}}<hr id=answer>{{Back}}",
					bqfmt: "",
					bafmt: "",
				},
				{
					name: "Card 2",
					ord: 1,
					qfmt: "{{Back}}",
					afmt: "{{FrontSide}}<hr id=answer>{{Front}}",
					bqfmt: "",
					bafmt: "",
				},
			],
			flds: [
				{
					name: "Front",
					ord: 0,
					sticky: false,
					rtl: false,
					font: "Arial",
					size: 20,
					media: [],
				},
				{
					name: "Back",
					ord: 1,
					sticky: false,
					rtl: false,
					font: "Arial",
					size: 20,
					media: [],
				},
			],
			css: ".card {\n font-family: arial;\n font-size: 20px;\n text-align: center;\n color: black;\n background-color: white;\n}\n",
			latexPre: "",
			latexPost: "",
			latexsvg: false,
			req: [
				[0, "any", [0]],
				[1, "any", [1]],
			],
		};

		const clozeModel = {
			id: 2,
			name: "Cloze",
			type: 1,
			mod: 0,
			usn: -1,
			sortf: 0,
			did: 1,
			tmpls: [
				{
					name: "Cloze",
					ord: 0,
					qfmt: "{{cloze:Text}}",
					afmt: "{{cloze:Text}}<br>{{Extra}}",
					bqfmt: "",
					bafmt: "",
				},
			],
			flds: [
				{
					name: "Text",
					ord: 0,
					sticky: false,
					rtl: false,
					font: "Arial",
					size: 20,
					media: [],
				},
				{
					name: "Extra",
					ord: 1,
					sticky: false,
					rtl: false,
					font: "Arial",
					size: 20,
					media: [],
				},
			],
			css: ".card {\n font-family: arial;\n font-size: 20px;\n text-align: center;\n color: black;\n background-color: white;\n}\n.cloze {\n font-weight: bold;\n color: blue;\n}\n",
			latexPre: "",
			latexPost: "",
			latexsvg: false,
			req: [[0, "any", [0]]],
		};

		const models: Record<string, unknown> = {
			"1": basicModel,
			"2": clozeModel,
		};

		return JSON.stringify(models);
	}

	private buildDecksJson(deckMap: Map<string, DeckInfo>): string {
		const decks: Record<string, unknown> = {};

		for (const [, deck] of deckMap) {
			decks[String(deck.id)] = {
				id: deck.id,
				name: deck.name,
				mod: 0,
				usn: -1,
				lrnToday: [0, 0],
				revToday: [0, 0],
				newToday: [0, 0],
				timeToday: [0, 0],
				collapsed: false,
				desc: "",
				dyn: 0,
				conf: 1,
				extendNew: 10,
				extendRev: 50,
			};
		}

		return JSON.stringify(decks);
	}

	private buildConfJson(): string {
		return JSON.stringify({
			activeDecks: [1],
			curDeck: 1,
			newSpread: 0,
			collapseTime: 1200,
			timeLim: 0,
			estTimes: true,
			dueCounts: true,
			curModel: 1,
			nextPos: 1,
			sortType: "noteFld",
			sortBackwards: false,
			addToCur: true,
		});
	}

	private buildDconfJson(): string {
		return JSON.stringify({
			"1": {
				id: 1,
				name: "Default",
				mod: 0,
				usn: -1,
				maxTaken: 60,
				autoplay: true,
				timer: 0,
				replayq: true,
				new: {
					bury: true,
					delays: [1, 10],
					initialFactor: 2500,
					ints: [1, 4, 7],
					order: 1,
					perDay: 20,
					separate: true,
				},
				rev: {
					bury: true,
					ease4: 1.3,
					fuzz: 0.05,
					ivlFct: 1,
					maxIvl: 36500,
					perDay: 200,
					minSpace: 1,
				},
				lapse: {
					delays: [10],
					leechAction: 0,
					leechFails: 8,
					minInt: 1,
					mult: 0,
				},
				dyn: false,
			},
		});
	}

	private async packageAsZip(
		dbBytes: Uint8Array,
		media: Map<string, ArrayBuffer>,
	): Promise<ArrayBuffer> {
		const zip = new JSZip();

		zip.file("collection.anki21", dbBytes);

		// Build media mapping: numeric index -> original filename
		const mediaMapping: Record<string, string> = {};
		let mediaIndex = 0;
		for (const [filename, data] of media) {
			const key = String(mediaIndex);
			mediaMapping[key] = filename;
			zip.file(key, data);
			mediaIndex++;
		}

		zip.file("media", JSON.stringify(mediaMapping));

		return zip.generateAsync({ type: "arraybuffer" });
	}
}

function deterministicId(cardId: string, salt: string): number {
	const input = cardId + salt;
	let hash = 0;
	for (let i = 0; i < input.length; i++) {
		const char = input.charCodeAt(i);
		hash = ((hash << 5) - hash + char) | 0;
	}
	// Anki IDs are positive integers, typically in the millisecond-timestamp range.
	// Use absolute value and ensure it's large enough to avoid collisions with small IDs.
	return Math.abs(hash) + 1000000000;
}

function generateGuid(cardId: string): string {
	let hash = 0;
	for (let i = 0; i < cardId.length; i++) {
		const char = cardId.charCodeAt(i);
		hash = ((hash << 5) - hash + char) | 0;
	}

	// Generate 10-char base91 string from the hash
	let result = "";
	let value = Math.abs(hash);
	for (let i = 0; i < 10; i++) {
		result += BASE91_CHARS[value % 91];
		value = Math.floor(value / 91);
		if (value === 0) {
			// Extend with a secondary hash to fill 10 chars
			value = Math.abs(hash * 31 + i * 7);
		}
	}
	return result;
}

function checksumFirst8(text: string): number {
	// Simple FNV-1a hash, take first 8 decimal digits
	let hash = 2166136261;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	// Ensure positive and take first 8 digits
	const positive = Math.abs(hash) >>> 0;
	return positive % 100000000;
}
