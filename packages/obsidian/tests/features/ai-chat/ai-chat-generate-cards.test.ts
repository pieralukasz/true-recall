import { describe, expect, it, vi } from "vitest";

vi.mock("@true-recall/core/ai/clients/streaming-openrouter-client", () => ({
	StreamingOpenRouterClient: class {
		async *chatStream() {
			yield { content: "[" };
			yield {
				content: '{"type":"basic","Front":"Q1","Back":"A1","source":"S1"},',
			};
			yield { content: " " };
			yield { content: "\u200b" };
			yield {
				content: '{"type":"basic","Front":"Q2","Back":"A2","source":"S2"}]',
			};
		}
	},
}));
vi.mock("@true-recall/core/ai/config/ai-client-config", () => ({
	resolveAIClientConfig: () => ({
		apiKey: "k",
		model: "auto",
		baseUrl: "u",
		providerType: "pro",
		hasProTier: true,
		temperature: 0.7,
	}),
}));
vi.mock("@true-recall/core/ai/generation/preset-resolver", () => ({
	resolveGenerationTarget: () => ({
		preset: { id: "p", name: "Flash", prompt: "x" },
		noteType: { id: "basic", slug: "basic", fields: ["Front", "Back"] },
	}),
}));
vi.mock("@true-recall/core/ai/prompts/generation-request", () => ({
	buildGenerationPrompt: () => ({
		systemPrompt: "s",
		userContent: "u",
		metadata: {},
	}),
}));
vi.mock("../../../src/plugin/collect-generation-context", () => ({
	collectGenerationContext: async () => undefined,
}));
vi.mock("../../../src/plugin/existing-cards-fetcher", () => ({
	fetchExistingCardsForFile: async () => [],
}));
vi.mock("../../../src/adapters/ObsidianHttpClient", () => ({
	ObsidianHttpClient: class {},
}));

import { TFile } from "obsidian";

import {
	type GenerateCardsOutput,
	runGenerateCards,
} from "../../../src/features/ai-chat/engine/generate-cards";
import {
	countPending,
	proposalCallIds,
} from "../../../src/features/ai-chat/engine/proposals";

function pluginWithNote(text: string) {
	const file = Object.assign(new TFile(), {
		path: "a.md",
		basename: "a",
		extension: "md",
	});
	return {
		settings: { defaultGenerationPresetId: "p", generationPresets: [] },
		flashcardManager: {
			getNoteTypeBySlug: () => ({
				id: "basic",
				slug: "basic",
				fields: ["Front", "Back"],
			}),
		},
		app: {
			vault: {
				getAbstractFileByPath: (p: string) => (p === "a.md" ? file : null),
				cachedRead: async () => text,
			},
		},
	} as never;
}

async function collect(gen: AsyncGenerator<GenerateCardsOutput>) {
	const out: GenerateCardsOutput[] = [];
	for await (const x of gen) out.push(x);
	return out;
}

describe("runGenerateCards", () => {
	it("reports reading, writing, reviewing, then all cards with their sources", async () => {
		const steps = await collect(
			runGenerateCards(
				pluginWithNote("Some note text."),
				{ note: { path: "a.md", title: "a" } },
				{},
			),
		);
		expect(steps.map((s) => s.stage)).toEqual([
			"reading",
			"writing",
			"writing",
			"reviewing",
			"reviewing",
			"done",
		]);
		const last = steps.at(-1);
		expect(last?.reviewed).toBe(true);
		expect(last?.presetName).toBe("Flash");
		expect(last?.cards).toEqual([
			{ question: "Q1", answer: "A1", source: "S1" },
			{ question: "Q2", answer: "A2", source: "S2" },
		]);
	});

	it("explains when there is no note", async () => {
		const steps = await collect(runGenerateCards(pluginWithNote("x"), {}, {}));
		expect(steps.at(-1)).toMatchObject({ stage: "done", cards: [] });
		expect(steps.at(-1)?.error).toMatch(/Open a note/);
	});
});

describe("generate_cards proposals", () => {
	const part = (state: string, output: unknown, preliminary?: boolean) => ({
		id: "m",
		role: "assistant",
		parts: [
			{
				type: "tool-generate_cards",
				toolCallId: "g",
				state,
				output,
				preliminary,
			},
		],
	});

	it("is pending only once the final result has cards", () => {
		expect(
			proposalCallIds([
				part("output-available", { cards: [{}] }, true),
			] as never),
		).toEqual([]);
		expect(
			proposalCallIds([part("output-available", { cards: [] })] as never),
		).toEqual([]);
		expect(
			countPending([part("output-available", { cards: [{}] })] as never, {}),
		).toBe(1);
	});
});
