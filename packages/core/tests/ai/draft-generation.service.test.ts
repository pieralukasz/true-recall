import { describe, expect, it } from "vitest";

import { DraftGenerationService } from "../../src/ai/generation/draft-generation.service";
import { DEFAULT_SETTINGS } from "../../src/constants";
import type { IHttpClient } from "../../src/interfaces/http-client";
import type { GenerationPreset } from "../../src/types/generation-preset.types";
import type { NoteType } from "../../src/types/note.types";

const NOTE_TYPE: NoteType = {
	id: "builtin-basic",
	name: "Basic",
	type: 0,
	fields: ["Front", "Back"],
	templates: [],
	css: "",
	isBuiltin: true,
	slug: "basic",
};

const PRESET: GenerationPreset = {
	id: "atomic",
	name: "Atomic",
	prompt: "Create one atomic card per fact.",
	noteTypeId: NOTE_TYPE.id,
	requiresPro: false,
	builtin: false,
	isDefault: true,
	createdAt: 1,
	updatedAt: 1,
};

function makeService(responseContent: string) {
	const bodies: unknown[] = [];
	const http: IHttpClient = {
		post: async (_url, body) => {
			bodies.push(body);
			return {
				status: 200,
				text: "",
				json: {
					id: "response",
					choices: [
						{
							message: { role: "assistant", content: responseContent },
							finish_reason: "stop",
						},
					],
				},
			};
		},
		stream: async function* () {},
	};
	return {
		bodies,
		service: new DraftGenerationService(
			() => ({
				...DEFAULT_SETTINGS,
				providerType: "openrouter",
				openRouterApiKey: "test-key",
			}),
			(slug) => (slug === NOTE_TYPE.slug ? NOTE_TYPE : null),
			http,
		),
	};
}

describe("DraftGenerationService", () => {
	it("uses a generation preset and returns source-grounded drafts without writes", async () => {
		const text = "Warsaw is the capital of Poland.";
		const { service, bodies } = makeService(
			JSON.stringify([
				{
					type: "basic",
					Front: "What is the capital of Poland?",
					Back: "Warsaw",
					source: text,
				},
			]),
		);

		const blocks = await service.generate(text, PRESET, NOTE_TYPE);

		expect(blocks).toEqual([
			{
				noteTypeId: NOTE_TYPE.id,
				noteTypeSlug: "basic",
				fields: {
					Front: "What is the capital of Poland?",
					Back: "Warsaw",
				},
				sourceText: text,
			},
		]);
		const request = bodies[0] as {
			messages: Array<{ role: string; content: string }>;
		};
		expect(request.messages[0]?.content).toContain(PRESET.prompt);
		expect(request.messages[1]?.content).toBe(text);
	});

	it("injects optional source and related-card context into the prompt", async () => {
		const { service, bodies } = makeService("[]");
		await service.generate("input", PRESET, NOTE_TYPE, {
			contextText: "Source note: Topic.md",
			existingCards: [{ id: "1", question: "Existing?", answer: "Yes" }],
		});

		const request = bodies[0] as {
			messages: Array<{ content: string }>;
		};
		expect(request.messages[0]?.content).toContain("Source note: Topic.md");
	});
});
