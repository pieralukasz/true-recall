import { describe, expect, it } from "vitest";

import { buildGenerationPrompt } from "@true-recall/core/ai/prompts/generation-request";
import type { GenerationPreset } from "@true-recall/core/types/generation-preset.types";
import type { NoteType } from "@true-recall/core/types/note.types";

const noteType: NoteType = {
	id: "nt-basic",
	name: "Basic",
	type: 0,
	fields: ["Front", "Back"],
	templates: [],
	css: "",
	isBuiltin: true,
	slug: "basic",
};

function makePreset(
	overrides: Partial<GenerationPreset> = {},
): GenerationPreset {
	return {
		id: "preset-1",
		name: "Preset",
		prompt: "Make flashcards.",
		noteTypeId: noteType.id,
		requiresPro: false,
		builtin: false,
		isDefault: false,
		createdAt: 0,
		updatedAt: 0,
		...overrides,
	};
}

describe("buildGenerationPrompt", () => {
	it("wraps a plain preset prompt in the format spec and sends the text bare", () => {
		const result = buildGenerationPrompt({
			preset: makePreset(),
			noteType,
			text: "Source material",
		});

		expect(result.systemPrompt).toContain("Make flashcards.");
		expect(result.systemPrompt).toContain("Fields to fill: Front, Back");
		expect(result.userContent).toBe("Source material");
	});

	it("uses a prompt carrying {{EXISTING_CARDS}} verbatim and moves the spec to the user message", () => {
		const preset = makePreset({
			prompt: "[ROLE] Pro prompt\n{{EXISTING_CARDS}}",
		});

		const result = buildGenerationPrompt({
			preset,
			noteType,
			text: "Source material",
			existingCards: [{ id: "c1", question: "Q1", answer: "A1" }],
		});

		expect(result.systemPrompt).toContain("[ROLE] Pro prompt");
		expect(result.systemPrompt).not.toContain("{{EXISTING_CARDS}}");
		expect(result.systemPrompt).toContain("- Q: Q1 | A: A1");
		expect(result.systemPrompt).not.toContain("Fields to fill");
		expect(result.userContent).toContain("Output a JSON array");
		expect(result.userContent.endsWith("Source material")).toBe(true);
	});

	it("renders the empty-cards sentinel when nothing exists yet", () => {
		const result = buildGenerationPrompt({
			preset: makePreset({ prompt: "Pro\n{{EXISTING_CARDS}}" }),
			noteType,
			text: "Text",
		});

		expect(result.systemPrompt).toContain(
			"No existing cards yet for this note.",
		);
	});

	it("prepends context text and appends the language override", () => {
		const result = buildGenerationPrompt({
			preset: makePreset({ languageOverride: "pl" }),
			noteType,
			text: "Text",
			contextText: "SOURCE NOTE:\nbody",
		});

		expect(result.systemPrompt.startsWith("SOURCE NOTE:\nbody")).toBe(true);
		expect(result.systemPrompt).toContain("LANGUAGE: Generate ALL flashcard");
		expect(result.systemPrompt).toContain("Polish");
	});

	it("labels a chunk with its heading breadcrumb and source note", () => {
		const result = buildGenerationPrompt({
			preset: makePreset(),
			noteType,
			text: "Chunk body",
			chunk: { headingBreadcrumb: "Intro > Basics", sourceName: "My Note" },
		});

		expect(result.userContent).toBe(
			'[Context: This section is from "Intro > Basics" in the note "My Note"]\n\nChunk body',
		);
	});

	it("omits the chunk label when the chunk has no breadcrumb", () => {
		const result = buildGenerationPrompt({
			preset: makePreset(),
			noteType,
			text: "Chunk body",
			chunk: { headingBreadcrumb: null, sourceName: "My Note" },
		});

		expect(result.userContent).toBe("Chunk body");
	});

	it("carries preset attribution metadata only on the Pro tier", () => {
		const preset = makePreset();

		expect(
			buildGenerationPrompt({ preset, noteType, text: "t", hasProTier: true })
				.metadata,
		).toEqual({
			call_context: "generation",
			note_type: "basic",
			preset_id: "preset-1",
		});
		expect(
			buildGenerationPrompt({ preset, noteType, text: "t" }).metadata,
		).toBeUndefined();
	});
});
