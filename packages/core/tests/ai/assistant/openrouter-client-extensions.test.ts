import { describe, expect, it } from "vitest";

import {
	type ChatCompletionRequest,
	OpenRouterClient,
} from "../../../src/ai/clients/openrouter-client";
import type { IHttpClient } from "../../../src/interfaces/http-client";

function makeCapturingHttpClient() {
	const captured: unknown[] = [];
	const httpClient: IHttpClient = {
		post: async (_url, body) => {
			captured.push(body);
			return {
				status: 200,
				json: {
					id: "r1",
					choices: [
						{
							message: {
								role: "assistant",
								content: "hi",
								annotations: [
									{
										type: "url_citation",
										url_citation: {
											url: "https://example.com",
											title: "Example",
										},
									},
								],
							},
							finish_reason: "stop",
						},
					],
				},
				text: "",
			};
		},
		stream: async function* () {},
	};
	return { httpClient, captured };
}

describe("OpenRouterClient extensions", () => {
	it("passes the plugins field through to the request body", async () => {
		const { httpClient, captured } = makeCapturingHttpClient();
		const client = new OpenRouterClient(
			"key",
			"google/gemini-2.5-flash",
			httpClient,
		);
		const request: ChatCompletionRequest = {
			messages: [{ role: "user", content: "hello" }],
			plugins: [{ id: "web" }],
		};
		await client.chat(request);
		expect((captured[0] as { plugins?: unknown }).plugins).toEqual([
			{ id: "web" },
		]);
	});

	it("forwards cache_control to OpenRouter providers", async () => {
		const { httpClient, captured } = makeCapturingHttpClient();
		const client = new OpenRouterClient(
			"key",
			"anthropic/claude-sonnet-4",
			httpClient,
		);
		await client.chat({
			messages: [{ role: "user", content: "hi" }],
			cache_control: { type: "ephemeral" },
		});
		expect((captured[0] as { cache_control?: unknown }).cache_control).toEqual({
			type: "ephemeral",
		});
	});

	it("strips cache_control for non-OpenRouter providers", async () => {
		const { httpClient, captured } = makeCapturingHttpClient();
		const client = new OpenRouterClient(
			"lm-studio",
			"local-model",
			httpClient,
			"http://localhost:1234/v1/chat/completions",
			undefined,
			undefined,
			{ providerType: "lmstudio" },
		);
		await client.chat({
			messages: [{ role: "user", content: "hi" }],
			cache_control: { type: "ephemeral" },
		});
		expect(
			(captured[0] as { cache_control?: unknown }).cache_control,
		).toBeUndefined();
	});

	it("passes max_tokens through to the request body", async () => {
		const { httpClient, captured } = makeCapturingHttpClient();
		const client = new OpenRouterClient(
			"key",
			"google/gemini-2.5-flash",
			httpClient,
		);
		await client.chat({
			messages: [{ role: "user", content: "hi" }],
			max_tokens: 4096,
		});
		expect((captured[0] as { max_tokens?: unknown }).max_tokens).toBe(4096);
	});

	it("exposes url_citation annotations on the response message", async () => {
		const { httpClient } = makeCapturingHttpClient();
		const client = new OpenRouterClient(
			"key",
			"google/gemini-2.5-flash",
			httpClient,
		);
		const response = await client.chat({
			messages: [{ role: "user", content: "hi" }],
		});
		const annotations = response.choices[0]?.message.annotations ?? [];
		expect(annotations[0]?.url_citation?.url).toBe("https://example.com");
	});
});
