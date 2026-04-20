import { beforeEach, describe, expect, it, vi } from "vitest";

import { CardAIService } from "../../../src/ai/card-ai/card-ai.service";
import {
	CardAIAbortedError,
	CardAIParseError,
} from "../../../src/ai/card-ai/card-ai.types";
import type { OpenRouterClient } from "../../../src/ai/clients/openrouter-client";

function client(content: string): OpenRouterClient {
	return {
		chat: vi.fn().mockResolvedValue({
			choices: [{ message: { role: "assistant", content } }],
			usage: { prompt_tokens: 10, completion_tokens: 20 },
		}),
	} as unknown as OpenRouterClient;
}

describe("CardAIService", () => {
	beforeEach(() => vi.clearAllMocks());

	it("parses a valid JSON response", async () => {
		const r = await new CardAIService(
			client(`{"Front":"Q","Back":"A"}`),
		).transform({
			fields: { Front: "q", Back: "" },
			prompt: "P",
		});
		expect(r.fields).toEqual({ Front: "Q", Back: "A" });
		expect(r.usage).toEqual({ promptTokens: 10, completionTokens: 20 });
	});

	it("strips ```json fences", async () => {
		const r = await new CardAIService(
			client('```json\n{"Front":"Q","Back":"A"}\n```'),
		).transform({ fields: { Front: "q", Back: "" }, prompt: "P" });
		expect(r.fields).toEqual({ Front: "Q", Back: "A" });
	});

	it("throws CardAIParseError on garbage", async () => {
		await expect(
			new CardAIService(client("not json")).transform({
				fields: { Front: "q", Back: "" },
				prompt: "P",
			}),
		).rejects.toBeInstanceOf(CardAIParseError);
	});

	it("throws CardAIParseError when a requested key is missing", async () => {
		await expect(
			new CardAIService(client(`{"Front":"Q"}`)).transform({
				fields: { Front: "q", Back: "" },
				prompt: "P",
			}),
		).rejects.toBeInstanceOf(CardAIParseError);
	});

	it("throws CardAIAbortedError when signal is pre-aborted", async () => {
		const c = new AbortController();
		c.abort();
		await expect(
			new CardAIService(client(`{"Front":"Q","Back":"A"}`)).transform({
				fields: { Front: "q", Back: "" },
				prompt: "P",
				signal: c.signal,
			}),
		).rejects.toBeInstanceOf(CardAIAbortedError);
	});
});
