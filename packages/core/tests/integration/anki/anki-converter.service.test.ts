import { AnkiConverterService } from "../../../src/integration/anki/anki-converter.service";
import {
	createAnkiCard,
	createAnkiDeck,
	createAnkiModel,
	createAnkiNote,
	createApkgData,
	createClozeModel,
	createReversedModel,
} from "./mocks/anki.mocks";

describe("AnkiConverterService", () => {
	let converter: AnkiConverterService;

	beforeEach(() => {
		converter = new AnkiConverterService();
	});

	describe("convert - basic cards", () => {
		it("converts single basic note to ConvertedCard", () => {
			const model = createAnkiModel();
			const note = createAnkiNote({ mid: model.id });
			const card = createAnkiCard({ nid: note.id, did: 1 });
			const deck = createAnkiDeck({ id: 1, name: "TestDeck" });

			const data = createApkgData({
				notes: [note],
				cards: [card],
				models: [model],
				decks: [deck],
			});

			const result = converter.convert(data);

			expect(result).toHaveLength(1);
			expect(result[0]?.cardType).toBe("basic");
			expect(result[0]?.ankiCardId).toBe(card.id);
			expect(result[0]?.ankiNoteId).toBe(note.id);
		});

		it("maps flds field 0 to question and field 1 to answer", () => {
			const model = createAnkiModel();
			const note = createAnkiNote({
				mid: model.id,
				flds: "Capital of France?\x1fParis",
			});
			const card = createAnkiCard({ nid: note.id, did: 1 });
			const deck = createAnkiDeck({ id: 1 });

			const data = createApkgData({
				notes: [note],
				cards: [card],
				models: [model],
				decks: [deck],
			});

			const result = converter.convert(data);

			expect(result[0]?.question).toBe("Capital of France?");
			expect(result[0]?.answer).toBe("Paris");
		});

		it("sets deckName from deck map with :: replaced by /", () => {
			const model = createAnkiModel();
			const note = createAnkiNote({ mid: model.id });
			const card = createAnkiCard({ nid: note.id, did: 5 });
			const deck = createAnkiDeck({ id: 5, name: "Languages::French::Vocab" });

			const data = createApkgData({
				notes: [note],
				cards: [card],
				models: [model],
				decks: [deck],
			});

			const result = converter.convert(data);

			expect(result[0]?.deckName).toBe("Languages/French/Vocab");
		});

		it("falls back to Default when deck not found", () => {
			const model = createAnkiModel();
			const note = createAnkiNote({ mid: model.id });
			const card = createAnkiCard({ nid: note.id, did: 999 });

			const data = createApkgData({
				notes: [note],
				cards: [card],
				models: [model],
			});

			const result = converter.convert(data);

			expect(result[0]?.deckName).toBe("Default");
		});

		it("extracts tags from note.tags", () => {
			const model = createAnkiModel();
			const note = createAnkiNote({
				mid: model.id,
				tags: "geography europe capitals",
			});
			const card = createAnkiCard({ nid: note.id, did: 1 });
			const deck = createAnkiDeck({ id: 1 });

			const data = createApkgData({
				notes: [note],
				cards: [card],
				models: [model],
				decks: [deck],
			});

			const result = converter.convert(data);

			expect(result[0].tags).toEqual(["geography", "europe", "capitals"]);
		});

		it("skips card when note not found", () => {
			const model = createAnkiModel();
			const card = createAnkiCard({ nid: 9999, did: 1 });
			const deck = createAnkiDeck({ id: 1 });

			const data = createApkgData({
				cards: [card],
				models: [model],
				decks: [deck],
			});

			const result = converter.convert(data);

			expect(result).toHaveLength(0);
		});

		it("skips card when model not found", () => {
			const note = createAnkiNote({ mid: 9999 });
			const card = createAnkiCard({ nid: note.id, did: 1 });
			const deck = createAnkiDeck({ id: 1 });

			const data = createApkgData({
				notes: [note],
				cards: [card],
				decks: [deck],
			});

			const result = converter.convert(data);

			expect(result).toHaveLength(0);
		});
	});

	describe("convert - cloze cards", () => {
		it("recognizes cloze model and sets cardType cloze", () => {
			const model = createClozeModel();
			const note = createAnkiNote({
				mid: model.id,
				flds: "{{c1::Paris}} is the capital of France\x1f",
			});
			const card = createAnkiCard({ nid: note.id, did: 1, ord: 0 });
			const deck = createAnkiDeck({ id: 1 });

			const data = createApkgData({
				notes: [note],
				cards: [card],
				models: [model],
				decks: [deck],
			});

			const result = converter.convert(data);

			expect(result).toHaveLength(1);
			expect(result[0].cardType).toBe("cloze");
		});

		it("sets clozeIndex to card.ord + 1", () => {
			const model = createClozeModel();
			const note = createAnkiNote({
				mid: model.id,
				flds: "{{c1::A}} and {{c2::B}} are letters\x1f",
			});
			const card0 = createAnkiCard({ id: 100, nid: note.id, did: 1, ord: 0 });
			const card1 = createAnkiCard({ id: 101, nid: note.id, did: 1, ord: 1 });
			const deck = createAnkiDeck({ id: 1 });

			const data = createApkgData({
				notes: [note],
				cards: [card0, card1],
				models: [model],
				decks: [deck],
			});

			const result = converter.convert(data);

			expect(result[0].clozeIndex).toBe(1);
			expect(result[1].clozeIndex).toBe(2);
		});

		it("sets clozeTemplate from template field", () => {
			const model = createClozeModel();
			const template = "{{c1::Paris}} is the capital of France";
			const note = createAnkiNote({
				mid: model.id,
				flds: `${template}\x1f`,
			});
			const card = createAnkiCard({ nid: note.id, did: 1, ord: 0 });
			const deck = createAnkiDeck({ id: 1 });

			const data = createApkgData({
				notes: [note],
				cards: [card],
				models: [model],
				decks: [deck],
			});

			const result = converter.convert(data);

			expect(result[0].clozeTemplate).toBe(template);
		});

		it("renders answer through template with extra field", () => {
			const model = createClozeModel();
			const template = "{{c1::Paris}} is the capital of France";
			const extra = "Source: Wikipedia";
			const note = createAnkiNote({
				mid: model.id,
				flds: `${template}\x1f${extra}`,
			});
			const card = createAnkiCard({ nid: note.id, did: 1, ord: 0 });
			const deck = createAnkiDeck({ id: 1 });

			const data = createApkgData({
				notes: [note],
				cards: [card],
				models: [model],
				decks: [deck],
			});

			const result = converter.convert(data);

			// afmt: "{{cloze:Text}}<br>{{Extra}}" renders cloze answer (bold) + extra
			expect(result[0].answer).toBe(
				"**Paris** is the capital of France\nSource: Wikipedia",
			);
		});

		it("handles custom cloze note type with non-standard field names", () => {
			const model = createClozeModel({
				id: 4000,
				name: "Cloze Anking v.2",
				flds: [
					{ name: "Text", ord: 0 },
					{ name: "Back Extra", ord: 1 },
				],
				tmpls: [
					{
						name: "Cloze",
						qfmt: "{{cloze:Text}}",
						afmt: "{{cloze:Text}}<br>{{#Back Extra}}<br>Rationale<br>{{Back Extra}}<br>{{/Back Extra}}",
						ord: 0,
					},
				],
			});
			const note = createAnkiNote({
				mid: model.id,
				flds: "Disease is caused by {{c1::Cadmium}}\x1fReference info",
			});
			const card = createAnkiCard({ nid: note.id, did: 1, ord: 0 });
			const deck = createAnkiDeck({ id: 1 });

			const data = createApkgData({
				notes: [note],
				cards: [card],
				models: [model],
				decks: [deck],
			});

			const result = converter.convert(data);

			expect(result).toHaveLength(1);
			expect(result[0].cardType).toBe("cloze");
			expect(result[0].clozeIndex).toBe(1);
			expect(result[0].question).toBe("Disease is caused by [...]");
			expect(result[0].answer).toContain("**Cadmium**");
			expect(result[0].answer).toContain("Rationale");
			expect(result[0].answer).toContain("Reference info");
			expect(result[0].clozeTemplate).toBe(
				"Disease is caused by {{c1::Cadmium}}",
			);
		});
	});

	describe("convert - reversed cards", () => {
		it("detects reversed card and swaps Q/A", () => {
			const model = createReversedModel();
			const note = createAnkiNote({
				mid: model.id,
				flds: "Front text\x1fBack text",
			});
			// ord=1 is the reversed card
			const card = createAnkiCard({ id: 200, nid: note.id, did: 1, ord: 1 });
			const deck = createAnkiDeck({ id: 1 });

			const data = createApkgData({
				notes: [note],
				cards: [card],
				models: [model],
				decks: [deck],
			});

			const result = converter.convert(data);

			expect(result).toHaveLength(1);
			expect(result[0].cardType).toBe("reversed");
			expect(result[0].question).toBe("Back text");
			expect(result[0].answer).toBe("Front text");
		});

		it("links reversed card to basic card from same note", () => {
			const model = createReversedModel();
			const note = createAnkiNote({
				mid: model.id,
				flds: "Front\x1fBack",
			});
			const basicCard = createAnkiCard({
				id: 300,
				nid: note.id,
				did: 1,
				ord: 0,
			});
			const reversedCard = createAnkiCard({
				id: 301,
				nid: note.id,
				did: 1,
				ord: 1,
			});
			const deck = createAnkiDeck({ id: 1 });

			const data = createApkgData({
				notes: [note],
				cards: [basicCard, reversedCard],
				models: [model],
				decks: [deck],
			});

			const result = converter.convert(data);

			const basic = result.find((c) => c.cardType === "basic");
			const reversed = result.find((c) => c.cardType === "reversed");

			expect(basic).toBeDefined();
			expect(reversed).toBeDefined();
			expect(reversed?.reverseOfAnkiCardId).toBe(basicCard.id);
		});
	});

	describe("htmlToMarkdown", () => {
		function convertWithHtml(html: string): string {
			const model = createAnkiModel();
			const note = createAnkiNote({
				mid: model.id,
				flds: `${html}\x1fanswer`,
			});
			const card = createAnkiCard({ nid: note.id, did: 1 });
			const deck = createAnkiDeck({ id: 1 });

			const data = createApkgData({
				notes: [note],
				cards: [card],
				models: [model],
				decks: [deck],
			});

			return converter.convert(data)[0].question;
		}

		it("converts br tags to newlines", () => {
			const result = convertWithHtml("line1<br>line2<br/>line3<br />line4");
			expect(result).toBe("line1\nline2\nline3\nline4");
		});

		it("converts bold tags to markdown", () => {
			expect(convertWithHtml("<b>bold</b>")).toBe("**bold**");
			expect(convertWithHtml("<strong>strong</strong>")).toBe("**strong**");
		});

		it("converts italic tags to markdown", () => {
			expect(convertWithHtml("<i>italic</i>")).toBe("*italic*");
			expect(convertWithHtml("<em>emphasis</em>")).toBe("*emphasis*");
		});

		it("converts img tags to obsidian embeds", () => {
			const result = convertWithHtml('<img src="photo.jpg">');
			expect(result).toBe("![[photo.jpg]]");
		});

		it("converts sound references to obsidian embeds", () => {
			const result = convertWithHtml("[sound:audio.mp3]");
			expect(result).toBe("![[audio.mp3]]");
		});

		it("converts pre tags to code blocks", () => {
			const result = convertWithHtml("<pre>const x = 1;</pre>");
			expect(result).toBe("```\nconst x = 1;\n```");
		});

		it("converts code tags to inline code", () => {
			const result = convertWithHtml("use <code>forEach</code> method");
			expect(result).toBe("use `forEach` method");
		});

		it("strips div and p tags", () => {
			const result = convertWithHtml("<div>inside div</div><p>inside p</p>");
			expect(result).toContain("inside div");
			expect(result).toContain("inside p");
			expect(result).not.toContain("<div>");
			expect(result).not.toContain("<p>");
		});

		it("preserves u tags", () => {
			const result = convertWithHtml("<u>underlined</u>");
			expect(result).toBe("<u>underlined</u>");
		});

		it("decodes HTML entities", () => {
			const result = convertWithHtml("&amp; &lt; &gt; &nbsp; &quot; &#39;");
			expect(result).toBe("& < >   \" '");
		});

		it("collapses excessive blank lines", () => {
			const result = convertWithHtml("line1\n\n\n\n\nline2");
			expect(result).toBe("line1\n\nline2");
		});

		it("trims result", () => {
			const result = convertWithHtml("  hello  ");
			expect(result).toBe("hello");
		});
	});

	describe("note type metadata", () => {
		it("sets ankiModelId from model", () => {
			const model = createAnkiModel({ id: 5555 });
			const note = createAnkiNote({ mid: model.id });
			const card = createAnkiCard({ nid: note.id, did: 1 });
			const deck = createAnkiDeck({ id: 1 });

			const data = createApkgData({
				notes: [note],
				cards: [card],
				models: [model],
				decks: [deck],
			});

			const result = converter.convert(data);

			expect(result[0]?.ankiModelId).toBe(5555);
		});

		it("sets templateOrd from card.ord", () => {
			const model = createReversedModel();
			const note = createAnkiNote({ mid: model.id, flds: "F\x1fB" });
			const card0 = createAnkiCard({ id: 100, nid: note.id, did: 1, ord: 0 });
			const card1 = createAnkiCard({ id: 101, nid: note.id, did: 1, ord: 1 });
			const deck = createAnkiDeck({ id: 1 });

			const data = createApkgData({
				notes: [note],
				cards: [card0, card1],
				models: [model],
				decks: [deck],
			});

			const result = converter.convert(data);

			expect(result.find((c) => c.cardType === "basic")?.templateOrd).toBe(0);
			expect(result.find((c) => c.cardType === "reversed")?.templateOrd).toBe(
				1,
			);
		});

		it("builds fieldValues from model field names", () => {
			const model = createAnkiModel({
				id: 9000,
				name: "Vocab",
				flds: [
					{ name: "Word", ord: 0 },
					{ name: "Meaning", ord: 1 },
					{ name: "Example", ord: 2 },
				],
			});
			const note = createAnkiNote({
				mid: model.id,
				flds: "apple\x1fa fruit\x1fI ate an apple",
			});
			const card = createAnkiCard({ nid: note.id, did: 1 });
			const deck = createAnkiDeck({ id: 1 });

			const data = createApkgData({
				notes: [note],
				cards: [card],
				models: [model],
				decks: [deck],
			});

			const result = converter.convert(data);

			expect(result[0]?.fieldValues).toEqual({
				Word: "apple",
				Meaning: "a fruit",
				Example: "I ate an apple",
			});
		});

		it("converts HTML in fieldValues", () => {
			const model = createAnkiModel();
			const note = createAnkiNote({
				mid: model.id,
				flds: "<b>bold Q</b>\x1f<i>italic A</i>",
			});
			const card = createAnkiCard({ nid: note.id, did: 1 });
			const deck = createAnkiDeck({ id: 1 });

			const data = createApkgData({
				notes: [note],
				cards: [card],
				models: [model],
				decks: [deck],
			});

			const result = converter.convert(data);

			expect(result[0]?.fieldValues).toEqual({
				Front: "**bold Q**",
				Back: "*italic A*",
			});
		});
	});

	describe("extractMediaFiles", () => {
		function getMediaFiles(flds: string): string[] {
			const model = createAnkiModel();
			const note = createAnkiNote({ mid: model.id, flds });
			const card = createAnkiCard({ nid: note.id, did: 1 });
			const deck = createAnkiDeck({ id: 1 });

			const data = createApkgData({
				notes: [note],
				cards: [card],
				models: [model],
				decks: [deck],
			});

			return converter.convert(data)[0].mediaFiles;
		}

		it("extracts img src filenames", () => {
			const files = getMediaFiles('<img src="photo.jpg">\x1fanswer');
			expect(files).toContain("photo.jpg");
		});

		it("extracts sound filenames", () => {
			const files = getMediaFiles("[sound:pronunciation.mp3]\x1fanswer");
			expect(files).toContain("pronunciation.mp3");
		});

		it("deduplicates media files", () => {
			const files = getMediaFiles(
				'<img src="same.jpg">\x1f<img src="same.jpg">',
			);
			expect(files).toEqual(["same.jpg"]);
		});
	});
});
