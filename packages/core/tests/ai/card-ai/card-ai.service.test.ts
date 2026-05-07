import { beforeEach, describe, expect, it, vi } from "vitest";

import { CardAIService } from "../../../src/ai/card-ai/card-ai.service";
import {
	CardAIAbortedError,
	CardAIParseError,
	CardAIProviderError,
} from "../../../src/ai/card-ai/card-ai.types";
import {
	AIRequestError,
	type OpenRouterClient,
} from "../../../src/ai/clients/openrouter-client";

function client(content: string): OpenRouterClient {
	return {
		chat: vi.fn().mockResolvedValue({
			choices: [{ message: { role: "assistant", content } }],
			usage: { prompt_tokens: 10, completion_tokens: 20 },
		}),
	} as unknown as OpenRouterClient;
}

const request = {
	fields: { Front: "q", Back: "" },
	prompt: "P",
	operation: "edit" as const,
};

describe("CardAIService", () => {
	beforeEach(() => vi.clearAllMocks());

	it("parses a valid JSON response", async () => {
		const r = await new CardAIService(
			client(`{"Front":"Q","Back":"A"}`),
		).transform(request);
		expect(r.fields).toEqual({ Front: "Q", Back: "A" });
		expect(r.usage).toEqual({ promptTokens: 10, completionTokens: 20 });
	});

	it("strips ```json fences", async () => {
		const r = await new CardAIService(
			client('```json\n{"Front":"Q","Back":"A"}\n```'),
		).transform(request);
		expect(r.fields).toEqual({ Front: "Q", Back: "A" });
	});

	it("throws CardAIParseError on garbage", async () => {
		await expect(
			new CardAIService(client("not json")).transform({
				...request,
			}),
		).rejects.toBeInstanceOf(CardAIParseError);
	});

	it("throws CardAIParseError when a requested key is missing", async () => {
		await expect(
			new CardAIService(client(`{"Front":"Q"}`)).transform({
				...request,
			}),
		).rejects.toBeInstanceOf(CardAIParseError);
	});

	it("throws CardAIAbortedError when signal is pre-aborted", async () => {
		const c = new AbortController();
		c.abort();
		await expect(
			new CardAIService(client(`{"Front":"Q","Back":"A"}`)).transform({
				...request,
				signal: c.signal,
			}),
		).rejects.toBeInstanceOf(CardAIAbortedError);
	});

	it("wraps AIRequestError in CardAIProviderError with the cause preserved", async () => {
		const cause = new AIRequestError(429, "rate limited");
		const failingClient = {
			chat: vi.fn().mockRejectedValue(cause),
		} as unknown as OpenRouterClient;
		const svc = new CardAIService(failingClient);
		await expect(svc.transform(request)).rejects.toMatchObject({
			constructor: CardAIProviderError,
			cause,
		});
	});

	it("wraps a non-Error rejection in CardAIProviderError with fallback message", async () => {
		const failingClient = {
			chat: vi.fn().mockRejectedValue("unexpected string"),
		} as unknown as OpenRouterClient;
		const svc = new CardAIService(failingClient);
		await expect(svc.transform(request)).rejects.toMatchObject({
			constructor: CardAIProviderError,
			message: "Provider request failed",
		});
	});

	it("converts a mid-request abort into CardAIAbortedError instead of provider error", async () => {
		const c = new AbortController();
		const abortingClient = {
			chat: vi.fn().mockImplementation(async () => {
				c.abort();
				throw new Error("fetch aborted");
			}),
		} as unknown as OpenRouterClient;
		const svc = new CardAIService(abortingClient);
		await expect(
			svc.transform({
				...request,
				signal: c.signal,
			}),
		).rejects.toBeInstanceOf(CardAIAbortedError);
	});

	it("tolerates JSON embedded in prose via brace-span fallback", async () => {
		const r = await new CardAIService(
			client('Sure! Here you go: {"Front":"Q","Back":"A"} Let me know.'),
		).transform(request);
		expect(r.fields).toEqual({ Front: "Q", Back: "A" });
	});
});
