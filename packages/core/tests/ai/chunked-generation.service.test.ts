import { afterEach, describe, expect, it, vi } from "vitest";

import { ChunkedGenerationService } from "@true-recall/core/ai/generation/chunked-generation.service";
import {
	buildPresetFormatSpec,
	buildPresetPrompt,
} from "@true-recall/core/ai/prompts/block-prompt-builder";
import { finishStreaming } from "@true-recall/core/ai/state/streaming-state";
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

function makeByokSettings(
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

function makeProSettings(
	overrides: Partial<TrueRecallSettings> = {},
): TrueRecallSettings {
	return {
		proKey: "pro-key-abc",
		generationPresets: [basicPreset],
		defaultGenerationPresetId: basicPreset.id,
		...overrides,
	} as TrueRecallSettings;
}

const sourceFile = { basename: "my-note", path: "my-note.md" } as any;

const flashcardManager = {
	getNoteTypeById: (id: string) =>
		id === basicNoteType.id ? basicNoteType : null,
	getNoteTypeBySlug: (slug: string) =>
		slug === basicNoteType.slug ? basicNoteType : null,
	getFrontmatterService: () => ({
		getSourceNoteUid: async () => "uid-1",
		generateUid: () => "uid-1",
		setSourceNoteUid: async () => {},
	}),
	createNote: () => ({ cards: [] }),
} as any;

/** Creates a mock httpClient whose stream() captures all request payloads. */
function makeCapturingHttpClient() {
	const capturedRequests: unknown[] = [];

	const stream = vi.fn(async function* (
		_url: string,
		body: unknown,
		_headers: unknown,
	) {
		capturedRequests.push(body);
		yield `data: {"choices":[{"delta":{"content":""},"finish_reason":null}]}\ndata: [DONE]\n`;
	});

	const httpClient = { fetch: vi.fn(), stream } as any;
	return { httpClient, capturedRequests };
}

/**
 * Generates a content string large enough to force the multi-chunk strategy.
 * The markdown-chunker uses SINGLE_THRESHOLD = 3000 words.
 */
function buildLargeContent(wordCount: number): string {
	// Each section contributes ~50 words under a heading.
	const sectionCount = Math.ceil(wordCount / 50);
	const sections: string[] = [];
	for (let i = 0; i < sectionCount; i++) {
		const words = Array.from({ length: 50 }, (_, j) => `word${i}_${j}`).join(
			" ",
		);
		sections.push(`## Section ${i}\n\n${words}`);
	}
	return sections.join("\n\n");
}

describe("ChunkedGenerationService.generateFromNote", () => {
	afterEach(() => {
		finishStreaming();
	});

	it("throws when preset id is unknown", async () => {
		const svc = new ChunkedGenerationService(
			() => makeByokSettings(),
			flashcardManager,
			{ fetch: vi.fn(), stream: vi.fn() } as any,
		);
		await expect(
			svc.generateFromNote("hi", sourceFile, "missing"),
		).rejects.toThrow('Generation preset "missing" not found');
	});

	it("single-chunk: result has failedChunks 0, totalChunks 1, errors []", async () => {
		// Short content — stays under the 3000-word threshold → single strategy.
		const shortContent = "This is a short note with just a few words.";
		const { httpClient } = makeCapturingHttpClient();
		const svc = new ChunkedGenerationService(
			() => makeByokSettings(),
			flashcardManager,
			httpClient,
		);

		const result = await svc.generateFromNote(
			shortContent,
			sourceFile,
			basicPreset.id,
		);

		expect(result.failedChunks).toBe(0);
		expect(result.totalChunks).toBe(1);
		expect(result.errors).toEqual([]);
		expect(result.preset).toEqual(basicPreset);
	});

	it("multi-chunk BYOK: each chunk uses buildPresetPrompt as system, no formatSpec prefix", async () => {
		const largeContent = buildLargeContent(3500);
		const { httpClient, capturedRequests } = makeCapturingHttpClient();
		const svc = new ChunkedGenerationService(
			() => makeByokSettings(),
			flashcardManager,
			httpClient,
		);

		const result = await svc.generateFromNote(
			largeContent,
			sourceFile,
			basicPreset.id,
		);

		// Must have used the chunked path.
		expect(result.totalChunks).toBeGreaterThan(1);
		expect(capturedRequests.length).toBeGreaterThan(1);

		const expectedSystemPrompt = buildPresetPrompt(basicPreset, basicNoteType);
		const expectedFormatSpec = buildPresetFormatSpec(
			basicPreset,
			basicNoteType,
		);

		for (const req of capturedRequests) {
			const body = req as any;
			const messages: Array<{ role: string; content: string }> = body.messages;

			// System message must equal buildPresetPrompt (not customPrompt, not empty).
			expect(messages[0]?.role).toBe("system");
			expect(messages[0]?.content).toBe(expectedSystemPrompt);

			// User message must NOT start with the format spec (BYOK has no formatPrefix).
			expect(messages[1]?.content).not.toContain(expectedFormatSpec);
		}
	});

	it("multi-chunk Pro: each chunk uses customPrompt as system, formatSpec prefixes user message", async () => {
		const proPreset: GenerationPreset = {
			...basicPreset,
			customPrompt: "Pro custom prompt",
		};
		const settings = makeProSettings({
			generationPresets: [proPreset],
			defaultGenerationPresetId: proPreset.id,
		});
		const largeContent = buildLargeContent(3500);
		const { httpClient, capturedRequests } = makeCapturingHttpClient();
		const svc = new ChunkedGenerationService(
			() => settings,
			flashcardManager,
			httpClient,
		);

		const result = await svc.generateFromNote(
			largeContent,
			sourceFile,
			proPreset.id,
		);

		expect(result.totalChunks).toBeGreaterThan(1);

		const expectedFormatSpec = buildPresetFormatSpec(proPreset, basicNoteType);

		for (const req of capturedRequests) {
			const body = req as any;
			const messages: Array<{ role: string; content: string }> = body.messages;

			// System must be the customPrompt.
			expect(messages[0]?.content).toBe("Pro custom prompt");

			// User message must be prefixed with the format spec.
			expect(messages[1]?.content).toContain(expectedFormatSpec);
		}
	});
});
