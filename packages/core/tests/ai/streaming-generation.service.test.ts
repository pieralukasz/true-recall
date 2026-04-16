import { describe, expect, it, vi } from "vitest";

import { StreamingGenerationService } from "@true-recall/core/ai/generation/streaming-generation.service";
import type { GenerationPreset } from "@true-recall/core/types/generation-preset.types";
import type { NoteType } from "@true-recall/core/types/note.types";
import type { TrueRecallSettings } from "@true-recall/core/types/settings.types";

const basicNoteType: NoteType = {
	id: "nt-basic",
	name: "Basic",
	type: 0,
	fields: ["Front", "Back"],
	templates: [],
	css: "",
	isBuiltin: true,
	slug: "basic",
};

const basicPreset: GenerationPreset = {
	id: "preset-basic",
	name: "Basic",
	noteTypeId: "nt-basic",
	fields: {
		Front: { role: "ai-text", instruction: "Question" },
		Back: { role: "ai-text", instruction: "Answer" },
	},
	tts: null,
	isPinned: true,
	isDefault: true,
	createdAt: 0,
	updatedAt: 0,
};

function makeSettings(
	overrides: Partial<TrueRecallSettings> = {},
): TrueRecallSettings {
	return {
		openRouterApiKey: "sk-test",
		aiModel: "openai/gpt-4o-mini",
		aiTemperature: 0.5,
		generationPresets: [basicPreset],
		defaultGenerationPresetId: basicPreset.id,
		...overrides,
	} as TrueRecallSettings;
}

const flashcardManager = {
	getNoteTypeById: (id: string) =>
		id === basicNoteType.id ? basicNoteType : null,
	getNoteTypeBySlug: (slug: string) =>
		slug === basicNoteType.slug ? basicNoteType : null,
} as any;

const httpClient = {
	fetch: vi.fn(),
	stream: vi.fn(),
} as any;

describe("StreamingGenerationService.generate", () => {
	it("throws when preset id is unknown", async () => {
		const svc = new StreamingGenerationService(
			() => makeSettings(),
			flashcardManager,
			httpClient,
		);
		await expect(
			svc.generate("text", { basename: "n", path: "n.md" } as any, "missing"),
		).rejects.toThrow('Generation preset "missing" not found');
	});

	it("throws when preset's note type is missing", async () => {
		const settings = makeSettings({
			generationPresets: [{ ...basicPreset, noteTypeId: "ghost" }],
		});
		const svc = new StreamingGenerationService(
			() => settings,
			flashcardManager,
			httpClient,
		);
		await expect(
			svc.generate(
				"text",
				{ basename: "n", path: "n.md" } as any,
				basicPreset.id,
			),
		).rejects.toThrow(
			'Preset "preset-basic" references unknown note type "ghost"',
		);
	});
});
