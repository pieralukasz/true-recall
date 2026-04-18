import { describe, expect, it, vi } from "vitest";

import {
	AIRequestError,
	OpenRouterClient,
} from "../../../src/ai/clients/openrouter-client";
import { CardPolishService } from "../../../src/ai/polish/card-polish.service";
import {
	PolishAbortedError,
	PolishParseError,
	PolishProviderError,
} from "../../../src/ai/polish/card-polish.types";
import type { IHttpClient } from "../../../src/interfaces/http-client";

type HttpResponse = { status: number; json: unknown; text: string };

function makeClient(response: Partial<HttpResponse>): {
	client: OpenRouterClient;
	http: IHttpClient;
} {
	const http: IHttpClient = {
		post: vi.fn().mockResolvedValue({
			status: 200,
			text: "",
			json: undefined,
			...response,
		}),
		stream: vi.fn(),
	};
	const client = new OpenRouterClient("sk-test", "test-model", http);
	return { client, http };
}

function validLLMResponse(front: string, back: string) {
	return {
		id: "x",
		choices: [
			{
				message: {
					role: "assistant",
					content: JSON.stringify({ front, back }),
				},
				finish_reason: "stop",
			},
		],
		usage: { prompt_tokens: 10, completion_tokens: 20 },
	};
}

describe("CardPolishService", () => {
	it("returns a PolishResult on a valid LLM response", async () => {
		const { client } = makeClient({ json: validLLMResponse("New Q", "New A") });
		const svc = new CardPolishService(client);
		const result = await svc.transform({
			cardFront: "Old Q",
			cardBack: "Old A",
			prompt: "Fix formatting.",
		});
		expect(result.front).toBe("New Q");
		expect(result.back).toBe("New A");
		expect(result.usage.promptTokens).toBe(10);
		expect(result.usage.completionTokens).toBe(20);
	});

	it("throws PolishParseError when content is not valid JSON", async () => {
		const { client } = makeClient({
			json: {
				id: "x",
				choices: [
					{
						message: { role: "assistant", content: "this is not json" },
						finish_reason: "stop",
					},
				],
			},
		});
		const svc = new CardPolishService(client);
		await expect(
			svc.transform({ cardFront: "Q", cardBack: "A", prompt: "fix" }),
		).rejects.toBeInstanceOf(PolishParseError);
	});

	it("throws PolishParseError when JSON does not match schema", async () => {
		const { client } = makeClient({
			json: {
				id: "x",
				choices: [
					{
						message: {
							role: "assistant",
							content: JSON.stringify({ front: "" }),
						},
						finish_reason: "stop",
					},
				],
			},
		});
		const svc = new CardPolishService(client);
		await expect(
			svc.transform({ cardFront: "Q", cardBack: "A", prompt: "fix" }),
		).rejects.toBeInstanceOf(PolishParseError);
	});

	it("wraps AIRequestError in PolishProviderError", async () => {
		const http: IHttpClient = {
			post: vi.fn().mockRejectedValue(new AIRequestError(500, "boom")),
			stream: vi.fn(),
		};
		const client = new OpenRouterClient("sk-test", "test-model", http);
		const svc = new CardPolishService(client);
		await expect(
			svc.transform({ cardFront: "Q", cardBack: "A", prompt: "fix" }),
		).rejects.toBeInstanceOf(PolishProviderError);
	});

	it("throws PolishAbortedError when signal is already aborted", async () => {
		const { client } = makeClient({ json: validLLMResponse("X", "Y") });
		const svc = new CardPolishService(client);
		const controller = new AbortController();
		controller.abort();
		await expect(
			svc.transform({
				cardFront: "Q",
				cardBack: "A",
				prompt: "fix",
				signal: controller.signal,
			}),
		).rejects.toBeInstanceOf(PolishAbortedError);
	});
});
