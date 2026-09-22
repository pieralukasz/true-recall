import { describe, expect, it } from "vitest";

import {
	planContent,
	writeContent,
} from "../../src/flashcard/markdown/content-sync";
import {
	type CardMarker,
	parseMarkdownCards,
	serializeMarker,
} from "../../src/flashcard/markdown/parser";
import { DEFAULT_MARKDOWN_FLASHCARDS as config } from "../../src/flashcard/markdown/settings";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_BASIC_REVERSED_ID,
	type Note,
} from "../../src/types/note.types";

const id = "b2ae1100-aaf1-4d7b-9e31-93345ca52922";
const makeNote = (
	front = "Question",
	back = "Answer",
	reversed = false,
): Note => ({
	id,
	noteTypeId: reversed ? BUILTIN_BASIC_REVERSED_ID : BUILTIN_BASIC_ID,
	fields: { Front: front, Back: back },
	tags: [],
	sourceUid: "source",
	createdVia: "markdown",
});
const makeCard = (
	front = "Question",
	back = "Answer",
	marker: CardMarker = { v: 1, id },
	reversed = false,
) => {
	const card = parseMarkdownCards(
		`${front}\n${reversed ? "???" : "??"}\n${back}\n${serializeMarker(marker)}`,
		config,
	)[0];
	if (!card) throw new Error("Missing parsed card");
	return card;
};

describe("Markdown content merge", () => {
	it("keeps device baselines separate so a remote edit cannot be overwritten by an older local database", async () => {
		const initial = makeCard();
		const baseline = (await planContent(initial, makeNote(), "desktop")).base;
		const shared: CardMarker = {
			v: 1,
			id,
			bases: { desktop: baseline, phone: baseline },
		};
		const desktop = await planContent(
			makeCard("Question", "Answer", shared),
			makeNote("Edited on desktop"),
			"desktop",
		);
		const fromDesktop = makeCard("Edited on desktop", "Answer", {
			...shared,
			bases: { ...shared.bases, desktop: desktop.base },
		});
		const phone = await planContent(fromDesktop, makeNote(), "phone");
		expect(phone.merged.front).toBe("Edited on desktop");
		// A new device with an existing divergent DB cannot guess which version is newer.
		await expect(
			planContent(fromDesktop, makeNote(), "new-device"),
		).rejects.toThrow("Sync conflict");
		expect(
			(await planContent(fromDesktop, undefined, "fresh-device")).merged.front,
		).toBe("Edited on desktop");
	});
	it("merges simultaneous edits to different fields and rejects divergent edits to the same field", async () => {
		const baseline = (await planContent(makeCard(), makeNote(), "device")).base;
		const marker = { v: 1 as const, id, bases: { device: baseline } };
		const merged = await planContent(
			makeCard("Question", "File answer", marker),
			makeNote("Panel question"),
			"device",
		);
		expect(merged.merged).toEqual({
			front: "Panel question",
			back: "File answer",
			reversed: false,
		});
		await expect(
			planContent(
				makeCard("File question", "Answer", marker),
				makeNote("Panel question"),
				"device",
			),
		).rejects.toThrow("question");
	});
	it("preserves CRLF, custom separator spacing, paragraphs outside cards and schedule metadata", async () => {
		const options = { ...config, basicSeparator: "::" };
		const baseline = (await planContent(makeCard(), makeNote(), "device")).base;
		const marker = { v: 1 as const, id, bases: { device: baseline } };
		const input = `# Notes\r\n\r\nQuestion\r\n  ::  \r\nAnswer\r\n${serializeMarker(marker)}\r\n\r\nAfter card\r\n`;
		const cards = parseMarkdownCards(input, options);
		const card = cards[0];
		if (!card) throw new Error("Missing card");
		const plan = await planContent(
			card,
			makeNote("New question", "New answer\nsecond line"),
			"device",
		);
		const output = writeContent(input, [plan], options);
		expect(output).toBe(
			input
				.replace("Question\r\n", "New question\r\n")
				.replace("Answer\r\n", "New answer\r\nsecond line\r\n"),
		);
	});
	it("writes a direction change using the configured separator", async () => {
		const baseline = (await planContent(makeCard(), makeNote(), "device")).base;
		const card = makeCard("Question", "Answer", {
			v: 1,
			id,
			bases: { device: baseline },
		});
		const text = `Question\n??\nAnswer\n${serializeMarker(card.marker ?? { v: 1, id })}`;
		const plan = await planContent(
			card,
			makeNote("Question", "Answer", true),
			"device",
		);
		expect(writeContent(text, [plan], config)).toContain(
			"Question\n???\nAnswer",
		);
	});
});
