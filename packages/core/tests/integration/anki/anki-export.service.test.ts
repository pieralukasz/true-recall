import { describe, expect, it, vi } from "vitest";

import { AnkiExportService } from "../../../src/integration/anki/anki-export.service";
import { ApkgParserService } from "../../../src/integration/anki/apkg/apkg-parser.service";
import type { FSRSCardData } from "../../../src/types";
import { createMockCard } from "../../mocks/fsrs.mocks";

// The production loader uses @sqlite.org/sqlite-wasm, which is unavailable
// under vitest; back it with sql.js (same DatabaseLike surface).
vi.mock("@true-recall/core/persistence/sqlite/loader", async () => {
	const initSqlJs = (await import("sql.js")).default;
	const SQL = await initSqlJs();
	return {
		loadDatabase: (existingData?: Uint8Array | null) =>
			Promise.resolve({
				db:
					existingData && existingData.byteLength > 0
						? new SQL.Database(existingData)
						: new SQL.Database(),
			}),
	};
});

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;

function makeService(cards: FSRSCardData[]) {
	const store = {
		getAll: () => cards,
		stats: { getModifiedReviewLogSince: () => [] },
	} as never;
	const resolver = { resolveSourceUids: () => new Map() } as never;
	const mediaReader = {
		readBinaryByName: (name: string) =>
			Promise.resolve(name === "img.png" ? PNG_BYTES : null),
	};
	return new AnkiExportService(store, {} as never, resolver, mediaReader);
}

describe("AnkiExportService.exportApkg (roundtrip via our own parser)", () => {
	it("converts wikilink embeds to Anki references and ships basename-keyed media", async () => {
		const cards = [
			createMockCard({
				id: "c1",
				question: "What is this? ![[attachments/img.png|300]]",
				answer: "A pixel",
			}),
		];

		const { data } = await makeService(cards).exportApkg({
			includeScheduling: false,
			includeMedia: true,
			exportMode: "all",
		});

		const parsed = await new ApkgParserService().parseApkg(data);

		const note = parsed.notes[0];
		expect(note?.flds).toContain('<img src="img.png">');
		expect(note?.flds).not.toContain("![[");
		expect(Object.values(parsed.mediaMap)).toContain("img.png");
		expect(parsed.media.size).toBe(1);
	});

	it("exports a reversed card even when its original is not in the export set", async () => {
		const cards = [
			createMockCard({
				id: "rev-only",
				cardType: "reversed",
				reverseOf: "missing-original",
				question: "Paris",
				answer: "Capital of France?",
			}),
		];

		const { data } = await makeService(cards).exportApkg({
			includeScheduling: false,
			includeMedia: false,
			exportMode: "all",
		});

		const parsed = await new ApkgParserService().parseApkg(data);
		expect(parsed.cards.length).toBe(1);
		expect(parsed.notes.length).toBe(1);
	});
});
