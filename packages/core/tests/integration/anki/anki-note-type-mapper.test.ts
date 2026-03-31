import {
	AnkiNoteTypeMapper,
	type NoteTypeStore,
	stripHtmlFromTemplate,
} from "../../../src/integration/anki/anki-note-type-mapper";
import type { NoteType } from "../../../src/types/note.types";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_BASIC_REVERSED_ID,
	BUILTIN_CLOZE_ID,
} from "../../../src/types/note.types";
import {
	createAnkiModel,
	createClozeModel,
	createReversedModel,
} from "./mocks/anki.mocks";

function createMockStore(existingTypes: NoteType[] = []): NoteTypeStore {
	const types = [...existingTypes];
	return {
		getAll: () => types,
		getBySlug: (slug: string) => types.find((t) => t.slug === slug) ?? null,
		create: (nt: NoteType) => {
			types.push(nt);
		},
	};
}

describe("AnkiNoteTypeMapper", () => {
	describe("builtin matching", () => {
		it("maps standard Basic model to builtin-basic", () => {
			const store = createMockStore();
			const mapper = new AnkiNoteTypeMapper(store);
			const models = new Map([[1000, createAnkiModel()]]);

			mapper.mapModels(models);

			expect(mapper.getNoteTypeId(1000)).toBe(BUILTIN_BASIC_ID);
			expect(mapper.noteTypesCreated).toBe(0);
		});

		it("maps Basic+reversed model to builtin-basic-reversed", () => {
			const store = createMockStore();
			const mapper = new AnkiNoteTypeMapper(store);
			const models = new Map([[3000, createReversedModel()]]);

			mapper.mapModels(models);

			expect(mapper.getNoteTypeId(3000)).toBe(BUILTIN_BASIC_REVERSED_ID);
			expect(mapper.noteTypesCreated).toBe(0);
		});

		it("maps standard Cloze model to builtin-cloze", () => {
			const store = createMockStore();
			const mapper = new AnkiNoteTypeMapper(store);
			const models = new Map([[2000, createClozeModel()]]);

			mapper.mapModels(models);

			expect(mapper.getNoteTypeId(2000)).toBe(BUILTIN_CLOZE_ID);
			expect(mapper.noteTypesCreated).toBe(0);
		});
	});

	describe("custom type creation", () => {
		it("creates custom note type for model with non-standard fields", () => {
			const store = createMockStore();
			const mapper = new AnkiNoteTypeMapper(store);
			const model = createAnkiModel({
				id: 5000,
				name: "Vocabulary",
				flds: [
					{ name: "Word", ord: 0 },
					{ name: "Meaning", ord: 1 },
					{ name: "Example", ord: 2 },
				],
				tmpls: [
					{
						name: "Card 1",
						qfmt: "{{Word}}",
						afmt: "{{Meaning}}<br>{{Example}}",
						ord: 0,
					},
				],
				css: ".card { font-family: serif; }",
			});
			const models = new Map([[5000, model]]);

			mapper.mapModels(models);

			const noteTypeId = mapper.getNoteTypeId(5000);
			expect(noteTypeId).toBeDefined();
			expect(noteTypeId).not.toBe(BUILTIN_BASIC_ID);
			expect(mapper.noteTypesCreated).toBe(1);

			const created = store.getAll().find((nt) => nt.id === noteTypeId);
			expect(created?.name).toBe("Vocabulary");
			expect(created?.fields).toEqual(["Word", "Meaning", "Example"]);
			expect(created?.css).toBe(".card { font-family: serif; }");
			expect(created?.type).toBe(0);
			expect(created?.isBuiltin).toBe(false);
		});

		it("creates cloze type with type=1 for cloze model with custom fields", () => {
			const store = createMockStore();
			const mapper = new AnkiNoteTypeMapper(store);
			const model = createClozeModel({
				id: 6000,
				name: "Sentence Cloze",
				flds: [
					{ name: "Sentence", ord: 0 },
					{ name: "Notes", ord: 1 },
				],
			});
			const models = new Map([[6000, model]]);

			mapper.mapModels(models);

			const noteTypeId = mapper.getNoteTypeId(6000);
			const created = store.getAll().find((nt) => nt.id === noteTypeId);
			expect(created?.type).toBe(1);
		});

		it("deduplicates names with counter suffix", () => {
			const existingType: NoteType = {
				id: "existing-1",
				name: "Vocabulary",
				type: 0,
				fields: ["Front", "Back"],
				templates: [],
				css: "",
				isBuiltin: false,
			};
			const store = createMockStore([existingType]);
			const mapper = new AnkiNoteTypeMapper(store);
			const model = createAnkiModel({
				id: 7000,
				name: "Vocabulary",
				flds: [
					{ name: "Term", ord: 0 },
					{ name: "Definition", ord: 1 },
					{ name: "Context", ord: 2 },
				],
			});
			const models = new Map([[7000, model]]);

			mapper.mapModels(models);

			const noteTypeId = mapper.getNoteTypeId(7000);
			const created = store.getAll().find((nt) => nt.id === noteTypeId);
			expect(created?.name).toBe("Vocabulary (2)");
		});

		it("reuses existing custom type by name", () => {
			const existingType: NoteType = {
				id: "existing-vocab",
				name: "My Vocab",
				type: 0,
				fields: ["Word", "Meaning"],
				templates: [],
				css: "",
				isBuiltin: false,
			};
			const store = createMockStore([existingType]);
			const mapper = new AnkiNoteTypeMapper(store);
			const model = createAnkiModel({
				id: 8000,
				name: "My Vocab",
				flds: [
					{ name: "Word", ord: 0 },
					{ name: "Meaning", ord: 1 },
				],
			});
			const models = new Map([[8000, model]]);

			mapper.mapModels(models);

			expect(mapper.getNoteTypeId(8000)).toBe("existing-vocab");
			expect(mapper.noteTypesCreated).toBe(0);
		});

		it("strips HTML from templates when creating note type", () => {
			const store = createMockStore();
			const mapper = new AnkiNoteTypeMapper(store);
			const model = createAnkiModel({
				id: 9000,
				name: "HTML Model",
				flds: [
					{ name: "Q", ord: 0 },
					{ name: "A", ord: 1 },
					{ name: "Extra", ord: 2 },
				],
				tmpls: [
					{
						name: "Card 1",
						qfmt: '<div class="front">{{Q}}</div>',
						afmt: "<hr id=answer><div>{{A}}</div><br>{{Extra}}",
						ord: 0,
					},
				],
			});
			const models = new Map([[9000, model]]);

			mapper.mapModels(models);

			const noteTypeId = mapper.getNoteTypeId(9000);
			const created = store.getAll().find((nt) => nt.id === noteTypeId);
			expect(created?.templates[0]?.qfmt).toBe("{{Q}}");
			expect(created?.templates[0]?.afmt).toBe("{{A}}\n{{Extra}}");
		});
	});
});

describe("stripHtmlFromTemplate", () => {
	it("preserves {{FieldName}} syntax", () => {
		expect(stripHtmlFromTemplate("{{Front}}")).toBe("{{Front}}");
	});

	it("preserves {{cloze:Field}} syntax", () => {
		expect(stripHtmlFromTemplate("{{cloze:Text}}")).toBe("{{cloze:Text}}");
	});

	it("preserves {{FrontSide}}", () => {
		expect(stripHtmlFromTemplate("{{FrontSide}}")).toBe("{{FrontSide}}");
	});

	it("preserves conditionals", () => {
		expect(stripHtmlFromTemplate("{{#Extra}}{{Extra}}{{/Extra}}")).toBe(
			"{{#Extra}}{{Extra}}{{/Extra}}",
		);
	});

	it("removes <hr id=answer>", () => {
		expect(stripHtmlFromTemplate("<hr id=answer>{{Back}}")).toBe("{{Back}}");
		expect(stripHtmlFromTemplate('<hr id="answer">{{Back}}')).toBe("{{Back}}");
	});

	it("converts <br> to newlines", () => {
		expect(stripHtmlFromTemplate("{{Q}}<br>{{A}}")).toBe("{{Q}}\n{{A}}");
	});

	it("strips HTML wrapper tags", () => {
		expect(stripHtmlFromTemplate('<div class="front">{{Front}}</div>')).toBe(
			"{{Front}}",
		);
	});

	it("decodes HTML entities", () => {
		expect(stripHtmlFromTemplate("&amp; &lt; &gt;")).toBe("& < >");
	});

	it("returns empty string for empty input", () => {
		expect(stripHtmlFromTemplate("")).toBe("");
	});

	it("strips {{edit:Field}} to {{Field}}", () => {
		expect(stripHtmlFromTemplate("{{edit:Front}}")).toBe("{{Front}}");
	});

	it("strips {{edit:Field}} with HTML wrapper", () => {
		expect(
			stripHtmlFromTemplate("<div>{{edit:Front}}</div><br>{{edit:Back}}"),
		).toBe("{{Front}}\n{{Back}}");
	});

	it("preserves {{FrontSide}} in back template", () => {
		expect(stripHtmlFromTemplate("{{FrontSide}}\n{{Back}}")).toBe(
			"{{FrontSide}}\n{{Back}}",
		);
	});

	it("preserves {{FrontSide}} while stripping HTML", () => {
		expect(
			stripHtmlFromTemplate(
				"<div>{{FrontSide}}</div><hr id=answer><div>{{Back}}</div>",
			),
		).toBe("{{FrontSide}}{{Back}}");
	});
});
