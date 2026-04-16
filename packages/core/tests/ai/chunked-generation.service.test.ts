import { describe, expect, it, vi } from "vitest";

import { ChunkedGenerationService } from "@true-recall/core/ai/generation/chunked-generation.service";
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

function makeSettings(): TrueRecallSettings {
	return {
		openRouterApiKey: "sk-test",
		aiModel: "openai/gpt-4o-mini",
		generationPresets: [basicPreset],
		defaultGenerationPresetId: basicPreset.id,
	} as TrueRecallSettings;
}

const flashcardManager = {
	getNoteTypeById: (id: string) =>
		id === basicNoteType.id ? basicNoteType : null,
	getNoteTypeBySlug: (slug: string) =>
		slug === basicNoteType.slug ? basicNoteType : null,
} as any;

const httpClient = { fetch: vi.fn(), stream: vi.fn() } as any;

describe("ChunkedGenerationService.generateFromNote", () => {
	it("throws when preset id is unknown", async () => {
		const svc = new ChunkedGenerationService(
			() => makeSettings(),
			flashcardManager,
			httpClient,
		);
		await expect(
			svc.generateFromNote(
				"hi",
				{ basename: "n", path: "n.md" } as any,
				"missing",
			),
		).rejects.toThrow('Generation preset "missing" not found');
	});
});
