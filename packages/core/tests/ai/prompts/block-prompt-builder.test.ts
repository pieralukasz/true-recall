import { describe, expect, it } from "vitest";

import {
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

const customNoteType: NoteType = {
	id: "custom-vocab",
	name: "My Vocab",
	type: 0,
	fields: ["Word", "Translation", "Example", "Image"],
	templates: [],
	css: "",
	isBuiltin: false,
};

const basicPreset: GenerationPreset = {
	id: "preset-1",
	name: "Basic preset",
	noteTypeId: "builtin-basic",
	fields: {
		Front: { role: "ai-text", instruction: "Generate a concise question." },
		Back: { role: "ai-text", instruction: "Generate a clear answer." },
	},
	tts: null,
	isPinned: false,
	isDefault: true,
	createdAt: 0,
	updatedAt: 0,
};

const mixedPreset: GenerationPreset = {
	id: "preset-2",
	name: "Mixed preset",
	noteTypeId: "custom-vocab",
	fields: {
		Word: { role: "ai-text", instruction: "The vocabulary word in context." },
		Translation: { role: "manual" },
		Example: { role: "ai-text", instruction: "An example sentence." },
		Image: { role: "image", sourceField: "Word" },
	},
	tts: null,
	isPinned: false,
	isDefault: false,
	createdAt: 0,
	updatedAt: 0,
};

const presetWithCustomPrompt: GenerationPreset = {
	...basicPreset,
	id: "preset-3",
	customPrompt: "Focus on important concepts only.",
};

describe("buildPresetPrompt", () => {
	it("includes field instructions for ai-text fields", () => {
		const result = buildPresetPrompt(basicPreset, basicNoteType);

		expect(result).toContain('"Front": Generate a concise question.');
		expect(result).toContain('"Back": Generate a clear answer.');
	});

	it("marks manual fields as skip", () => {
		const result = buildPresetPrompt(mixedPreset, customNoteType);

		expect(result).toContain('"Translation": (skip — user fills manually)');
	});

	it("omits image fields from JSON output spec", () => {
		const result = buildPresetPrompt(mixedPreset, customNoteType);

		// Image field should not appear in the JSON output spec entries
		const jsonSpecMatch = result.match(/Each element:\n(\{.*?\})/s);
		expect(jsonSpecMatch).not.toBeNull();
		expect(jsonSpecMatch![1]).not.toContain('"Image"');
	});

	it("omits image fields from field instructions", () => {
		const result = buildPresetPrompt(mixedPreset, customNoteType);

		// Image field should not appear in field instructions section
		const lines = result.split("\n");
		const instructionLines = lines.filter((l) => l.startsWith("- "));
		const imageInstructionLine = instructionLines.find((l) =>
			l.includes('"Image"'),
		);
		expect(imageInstructionLine).toBeUndefined();
	});

	it("includes customPrompt when provided", () => {
		const result = buildPresetPrompt(presetWithCustomPrompt, basicNoteType);

		expect(result).toContain("Focus on important concepts only.");
	});

	it("does not include customPrompt section when not provided", () => {
		const result = buildPresetPrompt(basicPreset, basicNoteType);

		expect(result).not.toContain("Focus on important concepts only.");
	});

	it("uses note type slug in JSON spec", () => {
		const result = buildPresetPrompt(basicPreset, basicNoteType);

		expect(result).toContain('"type": "basic"');
	});

	it("uses slugified name for custom note types", () => {
		const result = buildPresetPrompt(mixedPreset, customNoteType);

		expect(result).toContain('"type": "my-vocab"');
	});

	it("includes source field in JSON spec", () => {
		const result = buildPresetPrompt(basicPreset, basicNoteType);

		expect(result).toContain('"source": "..."');
	});

	it("starts with generate flashcards instruction", () => {
		const result = buildPresetPrompt(basicPreset, basicNoteType);

		expect(result).toMatch(/^Generate flashcards from the provided text\./);
	});

	it("ends with return only raw JSON instruction", () => {
		const result = buildPresetPrompt(basicPreset, basicNoteType);

		expect(result).toContain(
			"Return ONLY the raw JSON array. No markdown fences, no explanation.",
		);
	});
});

describe("buildPresetFormatSpec", () => {
	it("includes field context for ai-text fields", () => {
		const result = buildPresetFormatSpec(basicPreset, basicNoteType);

		expect(result).toContain('"Front": Generate a concise question.');
		expect(result).toContain('"Back": Generate a clear answer.');
	});

	it("includes field context section label", () => {
		const result = buildPresetFormatSpec(basicPreset, basicNoteType);

		expect(result).toContain("Field context:");
	});

	it("omits image fields from JSON spec", () => {
		const result = buildPresetFormatSpec(mixedPreset, customNoteType);

		const jsonSpecMatch = result.match(/Each element: (\{.*?\})/);
		expect(jsonSpecMatch).not.toBeNull();
		expect(jsonSpecMatch![1]).not.toContain('"Image"');
	});

	it("does not include manual fields in field context", () => {
		const result = buildPresetFormatSpec(mixedPreset, customNoteType);

		expect(result).not.toContain("skip — user fills manually");
	});

	it("uses note type slug in JSON spec", () => {
		const result = buildPresetFormatSpec(basicPreset, basicNoteType);

		expect(result).toContain('"type": "basic"');
	});

	it("includes source instruction", () => {
		const result = buildPresetFormatSpec(basicPreset, basicNoteType);

		expect(result).toContain('"source"');
		expect(result).toContain("EXACT substring");
	});

	it("ends with return only raw JSON instruction", () => {
		const result = buildPresetFormatSpec(basicPreset, basicNoteType);

		expect(result).toContain("Return ONLY the raw JSON array.");
	});
});
