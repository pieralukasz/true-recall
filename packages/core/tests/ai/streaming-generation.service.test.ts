import { afterEach, describe, expect, it, vi } from "vitest";

import { StreamingGenerationService } from "@true-recall/core/ai/generation/streaming-generation.service";
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

/** Creates a mock httpClient whose stream() captures the request payload. */
function makeCapturingHttpClient() {
	const capturedRequests: unknown[] = [];

	// Returns an async generator that yields one empty SSE chunk then completes.
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

/** Minimal flashcardManager for generation tests (no cards actually created). */
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

describe("StreamingGenerationService.generate", () => {
	afterEach(() => {
		// Reset global streaming state between tests.
		finishStreaming();
	});

	it("throws when preset id is unknown", async () => {
		const svc = new StreamingGenerationService(
			() => makeByokSettings(),
			flashcardManager,
			{ fetch: vi.fn(), stream: vi.fn() } as any,
		);
		await expect(svc.generate("text", sourceFile, "missing")).rejects.toThrow(
			'Generation preset "missing" not found',
		);
	});

	it("throws when preset's note type is missing", async () => {
		const settings = makeByokSettings({
			generationPresets: [{ ...basicPreset, noteTypeId: "ghost" }],
		});
		const svc = new StreamingGenerationService(
			() => settings,
			flashcardManager,
			{ fetch: vi.fn(), stream: vi.fn() } as any,
		);
		await expect(
			svc.generate("text", sourceFile, basicPreset.id),
		).rejects.toThrow(
			'Preset "preset-basic" references unknown note type "ghost"',
		);
	});

	it("BYOK path: sends buildPresetPrompt as system and raw text as user", async () => {
		const { httpClient, capturedRequests } = makeCapturingHttpClient();
		const svc = new StreamingGenerationService(
			() => makeByokSettings(),
			flashcardManager,
			httpClient,
		);

		const inputText = "Some study text";
		await svc.generate(inputText, sourceFile, basicPreset.id);

		expect(capturedRequests).toHaveLength(1);
		const body = capturedRequests[0] as any;
		const messages: Array<{ role: string; content: string }> = body.messages;

		expect(messages).toHaveLength(2);
		expect(messages[0]?.role).toBe("system");
		expect(messages[0]?.content).toBe(
			buildPresetPrompt(basicPreset, basicNoteType),
		);
		expect(messages[1]?.role).toBe("user");
		expect(messages[1]?.content).toBe(inputText);
	});

	it("BYOK path: includes temperature, omits metadata", async () => {
		const { httpClient, capturedRequests } = makeCapturingHttpClient();
		const svc = new StreamingGenerationService(
			() => makeByokSettings({ aiTemperature: 0.3 }),
			flashcardManager,
			httpClient,
		);

		await svc.generate("text", sourceFile, basicPreset.id);

		const body = capturedRequests[0] as any;
		expect(body.temperature).toBeDefined();
		expect(body.metadata).toBeUndefined();
	});

	it("Pro path: sends customPrompt as system, formatSpec+text as user", async () => {
		const proPreset: GenerationPreset = {
			...basicPreset,
			customPrompt: "Custom pro prompt",
		};
		const settings = makeProSettings({
			generationPresets: [proPreset],
			defaultGenerationPresetId: proPreset.id,
		});
		const { httpClient, capturedRequests } = makeCapturingHttpClient();
		const svc = new StreamingGenerationService(
			() => settings,
			flashcardManager,
			httpClient,
		);

		const inputText = "Pro study text";
		await svc.generate(inputText, sourceFile, proPreset.id);

		const body = capturedRequests[0] as any;
		const messages: Array<{ role: string; content: string }> = body.messages;

		expect(messages[0]?.role).toBe("system");
		expect(messages[0]?.content).toBe("Custom pro prompt");
		expect(messages[1]?.content).toBe(
			`${buildPresetFormatSpec(proPreset, basicNoteType)}\n\n${inputText}`,
		);
	});

	it("Pro path: includes metadata with call_context, note_type, preset_id, omits temperature", async () => {
		const proPreset: GenerationPreset = {
			...basicPreset,
			customPrompt: "Pro prompt",
		};
		const settings = makeProSettings({
			generationPresets: [proPreset],
			defaultGenerationPresetId: proPreset.id,
		});
		const { httpClient, capturedRequests } = makeCapturingHttpClient();
		const svc = new StreamingGenerationService(
			() => settings,
			flashcardManager,
			httpClient,
		);

		await svc.generate("text", sourceFile, proPreset.id);

		const body = capturedRequests[0] as any;
		expect(body.metadata).toEqual({
			call_context: "generation",
			note_type: "basic",
			preset_id: proPreset.id,
		});
		expect(body.temperature).toBeUndefined();
	});

	it("Pro path with empty customPrompt falls back to buildPresetPrompt", async () => {
		const proPresetEmpty: GenerationPreset = {
			...basicPreset,
			customPrompt: "",
		};
		const settings = makeProSettings({
			generationPresets: [proPresetEmpty],
			defaultGenerationPresetId: proPresetEmpty.id,
		});
		const { httpClient, capturedRequests } = makeCapturingHttpClient();
		const svc = new StreamingGenerationService(
			() => settings,
			flashcardManager,
			httpClient,
		);

		await svc.generate("text", sourceFile, proPresetEmpty.id);

		const body = capturedRequests[0] as any;
		const messages: Array<{ role: string; content: string }> = body.messages;
		expect(messages[0]?.content).toBe(
			buildPresetPrompt(proPresetEmpty, basicNoteType),
		);
	});

	it("concurrency guard throws when another generation is in-flight", async () => {
		// Use a stream that never resolves to hold the first generation open.
		let resolveNever!: () => void;
		const neverStream = vi.fn(async function* () {
			await new Promise<void>((res) => {
				resolveNever = res;
			});
		});
		const httpClient = { fetch: vi.fn(), stream: neverStream } as any;
		const svc = new StreamingGenerationService(
			() => makeByokSettings(),
			flashcardManager,
			httpClient,
		);

		const firstGeneration = svc.generate("text1", sourceFile, basicPreset.id);

		// Wait a microtask so generate() reaches startStreaming()
		await Promise.resolve();

		await expect(
			svc.generate("text2", sourceFile, basicPreset.id),
		).rejects.toThrow("Generation already in progress");

		// Clean up — unblock the first stream so the test teardown is clean.
		resolveNever();
		await firstGeneration.catch(() => {});
	});
});
