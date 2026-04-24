import { describe, expect, it } from "vitest";

import {
	buildByokPrompt,
	buildPresetFormatSpec,
	buildPresetPrompt,
} from "../../../src/ai/prompts/block-prompt-builder";
import type { GenerationPreset } from "../../../src/types/generation-preset.types";
import type { NoteType } from "../../../src/types/note.types";

const basicNoteType: NoteType = {
	id: "builtin-basic",
	name: "Basic",
	type: 0,
	fields: ["Front", "Back"],
	templates: [],
	css: "",
	isBuiltin: true,
};

const vocabNoteType: NoteType = {
	id: "custom-vocab",
	name: "My Vocab",
	type: 0,
	fields: ["Word", "Translation", "Example", "Image"],
	templates: [],
	css: "",
	isBuiltin: false,
};

function makePreset(
	overrides: Partial<GenerationPreset> = {},
): GenerationPreset {
	return {
		id: "preset-1",
		name: "Test preset",
		prompt: "Focus on definitions.",
		noteTypeId: "builtin-basic",
		tts: null,
		image: null,
		requiresPro: false,
		builtin: false,
		isDefault: true,
		createdAt: 0,
		updatedAt: 0,
		...overrides,
	};
}

describe("buildPresetPrompt", () => {
	it("includes the user prompt verbatim", () => {
		const result = buildPresetPrompt(makePreset(), basicNoteType);
		expect(result).toContain("Focus on definitions.");
	});

	it("lists all fields to fill for a basic note type", () => {
		const result = buildPresetPrompt(makePreset(), basicNoteType);
		expect(result).toContain("Fields to fill: Front, Back");
	});

	it("uses note type slug in JSON spec", () => {
		const result = buildPresetPrompt(makePreset(), basicNoteType);
		expect(result).toContain('"type": "basic"');
	});

	it("includes field entries in JSON spec", () => {
		const result = buildPresetPrompt(makePreset(), basicNoteType);
		expect(result).toContain('"Front": "..."');
		expect(result).toContain('"Back": "..."');
	});

	it("omits the image target field from JSON spec and fields-to-fill", () => {
		const preset = makePreset({
			noteTypeId: "custom-vocab",
			image: { targetField: "Image", sourceField: "Word" },
		});
		const result = buildPresetPrompt(preset, vocabNoteType);

		expect(result).not.toContain('"Image": "..."');
		expect(result).toContain("Fields to fill: Word, Translation, Example");
	});

	it("skips the empty-prompt block when prompt is blank", () => {
		const result = buildPresetPrompt(makePreset({ prompt: "" }), basicNoteType);
		expect(result).not.toContain("Focus on definitions.");
		expect(result).toContain("Generate flashcards from the provided text.");
	});

	it("ends with return-only-raw-JSON instruction", () => {
		const result = buildPresetPrompt(makePreset(), basicNoteType);
		expect(result).toContain(
			"Return ONLY the raw JSON array. No markdown fences, no explanation.",
		);
	});
});

describe("buildPresetFormatSpec", () => {
	it("uses note type slug in JSON spec", () => {
		const result = buildPresetFormatSpec(makePreset(), basicNoteType);
		expect(result).toContain('"type": "basic"');
	});

	it("lists fields to fill", () => {
		const result = buildPresetFormatSpec(makePreset(), basicNoteType);
		expect(result).toContain("Fields to fill: Front, Back");
	});

	it("omits the image target field", () => {
		const preset = makePreset({
			noteTypeId: "custom-vocab",
			image: { targetField: "Image", sourceField: "Word" },
		});
		const result = buildPresetFormatSpec(preset, vocabNoteType);
		expect(result).not.toContain('"Image": "..."');
	});

	it("includes source rule", () => {
		const result = buildPresetFormatSpec(makePreset(), basicNoteType);
		expect(result).toContain('"source"');
		expect(result).toContain("EXACT substring");
	});
});

describe("buildByokPrompt", () => {
	it("includes custom prompt, note type slug, and source rule", () => {
		const noteType: NoteType = { ...basicNoteType, slug: "basic" };
		const result = buildByokPrompt(noteType, "auto", "my custom prompt");
		expect(result).toContain("my custom prompt");
		expect(result).toContain('"type": "basic"');
		expect(result).toContain("source");
	});
});
