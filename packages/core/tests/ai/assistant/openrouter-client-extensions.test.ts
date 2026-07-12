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
		const client = new OpenRouterClient("key", "google/gemini-2.5-flash", httpClient);
		const request: ChatCompletionRequest = {
			messages: [{ role: "user", content: "hello" }],
			plugins: [{ id: "web" }],
		};
		await client.chat(request);
		expect((captured[0] as { plugins?: unknown }).plugins).toEqual([{ id: "web" }]);
	});

	it("exposes url_citation annotations on the response message", async () => {
		const { httpClient } = makeCapturingHttpClient();
		const client = new OpenRouterClient("key", "google/gemini-2.5-flash", httpClient);
		const response = await client.chat({
			messages: [{ role: "user", content: "hi" }],
		});
		const annotations = response.choices[0]?.message.annotations ?? [];
		expect(annotations[0]?.url_citation?.url).toBe("https://example.com");
	});
});
