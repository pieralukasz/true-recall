import { describe, expect, it } from "vitest";
import { fixSourceText, fixBlockSourceTexts } from "../../src/ai/utils/source-text-fixer";
import type { ParsedBlock } from "../../src/flashcard/parsing/block-parser.service";

describe("fixSourceText", () => {
	it("returns exact match as-is", () => {
		const input = "Herbata jest drugim najczęściej spożywanym napojem na świecie.";
		const source = "Herbata jest drugim najczęściej spożywanym napojem na świecie.";
		expect(fixSourceText(source, input)).toBe(source);
	});

	it("returns undefined for empty source", () => {
		expect(fixSourceText("", "some input")).toBeUndefined();
	});

	it("returns undefined when source not found at all", () => {
		const input = "Herbata jest napojem.";
		const source = "Kawa jest napojem.";
		expect(fixSourceText(source, input)).toBeUndefined();
	});

	it("fixes source with stripped bold markers", () => {
		const input = "Pochodzi z liści rośliny **Camellia sinensis**, uprawianej od ponad 5000 lat.";
		const source = "Pochodzi z liści rośliny Camellia sinensis, uprawianej od ponad 5000 lat.";
		const result = fixSourceText(source, input);
		expect(result).toBe("Pochodzi z liści rośliny **Camellia sinensis**, uprawianej od ponad 5000 lat.");
	});

	it("fixes source with stripped italic markers", () => {
		const input = "Lu Yu napisał *Cha Jing* (Klasyka herbaty) — pierwszą monografię o herbacie.";
		const source = "Lu Yu napisał Cha Jing (Klasyka herbaty) — pierwszą monografię o herbacie.";
		const result = fixSourceText(source, input);
		expect(result).toBe("Lu Yu napisał *Cha Jing* (Klasyka herbaty) — pierwszą monografię o herbacie.");
	});

	it("fixes source with stripped bold date at list item start", () => {
		const input = "- **2737 p.n.e.** — według legendy chiński cesarz Shen Nung odkrył herbatę.";
		const source = "2737 p.n.e. — według legendy chiński cesarz Shen Nung odkrył herbatę.";
		const result = fixSourceText(source, input);
		expect(result).toBe("**2737 p.n.e.** — według legendy chiński cesarz Shen Nung odkrył herbatę.");
	});

	it("fixes source with stripped heading markers", () => {
		const input = "### Historia herbaty\n\nHerbata ma długą historię.";
		const source = "Historia herbaty";
		const result = fixSourceText(source, input);
		expect(result).toBe("Historia herbaty");
	});

	it("fixes source with stripped strikethrough", () => {
		const input = "To jest ~~nieprawda~~ prawda.";
		const source = "To jest nieprawda prawda.";
		const result = fixSourceText(source, input);
		expect(result).toBe("To jest ~~nieprawda~~ prawda.");
	});

	it("fixes source with stripped highlight markers", () => {
		const input = "To jest ==ważne== zdanie.";
		const source = "To jest ważne zdanie.";
		const result = fixSourceText(source, input);
		expect(result).toBe("To jest ==ważne== zdanie.");
	});

	it("fixes source with stripped link syntax", () => {
		const input = "Więcej na [Wikipedia](https://pl.wikipedia.org/wiki/Herbata).";
		const source = "Więcej na Wikipedia.";
		const result = fixSourceText(source, input);
		expect(result).toBe("Więcej na [Wikipedia](https://pl.wikipedia.org/wiki/Herbata).");
	});

	it("handles trimmed whitespace", () => {
		const input = "Herbata jest napojem.";
		const source = "  Herbata jest napojem.  ";
		expect(fixSourceText(source, input)).toBe("Herbata jest napojem.");
	});

	it("handles multiple bold segments", () => {
		const input = "**Dynastia Tang** (618–907) — herbata stała się **napojem narodowym** Chin.";
		const source = "Dynastia Tang (618–907) — herbata stała się napojem narodowym Chin.";
		const result = fixSourceText(source, input);
		expect(result).toBe("**Dynastia Tang** (618–907) — herbata stała się **napojem narodowym** Chin.");
	});

	it("fixes source with backtick code stripped", () => {
		const input = "Użyj `console.log` do debugowania.";
		const source = "Użyj console.log do debugowania.";
		const result = fixSourceText(source, input);
		expect(result).toBe("Użyj `console.log` do debugowania.");
	});
});

describe("fixBlockSourceTexts", () => {
	it("fixes source text in blocks in-place", () => {
		const input = "Pochodzi z liści rośliny **Camellia sinensis**.";
		const blocks: ParsedBlock[] = [
			{
				noteTypeId: "basic",
				noteTypeSlug: "basic",
				fields: { Front: "Q", Back: "A" },
				sourceText: "Pochodzi z liści rośliny Camellia sinensis.",
			},
		];
		fixBlockSourceTexts(blocks, input);
		expect(blocks[0].sourceText).toBe(
			"Pochodzi z liści rośliny **Camellia sinensis**.",
		);
	});

	it("sets undefined when source cannot be matched", () => {
		const blocks: ParsedBlock[] = [
			{
				noteTypeId: "basic",
				noteTypeSlug: "basic",
				fields: { Front: "Q", Back: "A" },
				sourceText: "Completely unrelated text.",
			},
		];
		fixBlockSourceTexts(blocks, "Some input text.");
		expect(blocks[0].sourceText).toBeUndefined();
	});

	it("leaves blocks without sourceText unchanged", () => {
		const blocks: ParsedBlock[] = [
			{
				noteTypeId: "basic",
				noteTypeSlug: "basic",
				fields: { Front: "Q", Back: "A" },
			},
		];
		fixBlockSourceTexts(blocks, "Some input text.");
		expect(blocks[0].sourceText).toBeUndefined();
	});
});
