import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	AIRequestError,
	type OpenRouterClient,
} from "@true-recall/core/ai/clients/openrouter-client";

import {
	CardAIAbortedError,
	CardAIParseError,
	CardAIProviderError,
	CardAIService,
} from "@true-recall/plugins/shared/card-ai";

function client(content: string): OpenRouterClient {
	return {
		chat: vi.fn().mockResolvedValue({
			choices: [{ message: { role: "assistant", content } }],
			usage: { prompt_tokens: 10, completion_tokens: 20 },
		}),
	} as unknown as OpenRouterClient;
}

const BASIC_NOTE_TYPE = {
	name: "Basic",
	fields: ["Front", "Back"] as const,
};

const request = {
	fields: { Front: "q", Back: "" },
	noteType: BASIC_NOTE_TYPE,
	prompt: "P",
	operation: "edit" as const,
	mode: "edit" as const,
	fieldScope: "all" as const,
};

describe("CardAIService", () => {
	beforeEach(() => vi.clearAllMocks());

	it("parses a single-element JSON array response", async () => {
		const r = await new CardAIService(
			client(`[{"Front":"Q","Back":"A"}]`),
		).transform(request);
		expect(r.cards).toEqual([{ Front: "Q", Back: "A" }]);
		expect(r.usage).toEqual({ promptTokens: 10, completionTokens: 20 });
	});

	it("parses a multi-element JSON array response", async () => {
		const r = await new CardAIService(
			client(
				`[{"Front":"Q1","Back":"A1"},{"Front":"Q2","Back":"A2"},{"Front":"Q3","Back":"A3"}]`,
			),
		).transform({ ...request, mode: "split" });
		expect(r.cards).toHaveLength(3);
		expect(r.cards[0]).toEqual({ Front: "Q1", Back: "A1" });
		expect(r.cards[2]).toEqual({ Front: "Q3", Back: "A3" });
	});

	it("accepts an unchanged singleton as a safe split no-op", async () => {
		const c = client(`[{"Front":"q","Back":""}]`);
		const result = await new CardAIService(c).transform({
			...request,
			mode: "split",
		});

		expect(result.cards).toEqual([request.fields]);
		expect(c.chat).toHaveBeenCalledOnce();
	});

	it("repairs a split response with the wrong number of cards", async () => {
		const c = {
			chat: vi
				.fn()
				.mockResolvedValueOnce({
					choices: [
						{
							message: {
								role: "assistant",
								content: `[{"Front":"Changed","Back":"A"}]`,
							},
						},
					],
					usage: { prompt_tokens: 10, completion_tokens: 20 },
				})
				.mockResolvedValueOnce({
					choices: [
						{
							message: {
								role: "assistant",
								content: `[{"Front":"Q1","Back":"A1"},{"Front":"Q2","Back":"A2"}]`,
							},
						},
					],
					usage: { prompt_tokens: 12, completion_tokens: 22 },
				}),
		} as unknown as OpenRouterClient;

		const result = await new CardAIService(c).transform({
			...request,
			mode: "split",
		});

		expect(result.cards).toHaveLength(2);
		expect(result.usage).toEqual({ promptTokens: 22, completionTokens: 42 });
		expect(c.chat).toHaveBeenCalledTimes(2);
		expect(
			(c.chat as ReturnType<typeof vi.fn>).mock.calls[1]?.[0].messages.at(-1)
				.content,
		).toContain("Correct it now");
	});

	it("falls back to an unchanged card when split repair still fails", async () => {
		const c = client(`[{"Front":"Still one card","Back":"A"}]`);
		const result = await new CardAIService(c).transform({
			...request,
			mode: "split",
		});

		expect(result.cards).toEqual([request.fields]);
		expect(c.chat).toHaveBeenCalledTimes(2);
	});

	it("strips ```json fences around an array", async () => {
		const r = await new CardAIService(
			client('```json\n[{"Front":"Q","Back":"A"}]\n```'),
		).transform(request);
		expect(r.cards).toEqual([{ Front: "Q", Back: "A" }]);
	});

	it("throws CardAIParseError on garbage", async () => {
		await expect(
			new CardAIService(client("not json")).transform(request),
		).rejects.toBeInstanceOf(CardAIParseError);
	});

	it("throws CardAIParseError when a requested key is missing in any element", async () => {
		await expect(
			new CardAIService(client(`[{"Front":"Q"}]`)).transform(request),
		).rejects.toBeInstanceOf(CardAIParseError);
	});

	it("throws CardAIParseError on legacy single-object response (regression)", async () => {
		await expect(
			new CardAIService(client(`{"Front":"Q","Back":"A"}`)).transform(request),
		).rejects.toBeInstanceOf(CardAIParseError);
	});

	it("uses a low deterministic temperature and output cap", async () => {
		const c = client(`[{"Front":"Q","Back":"A"}]`);
		await new CardAIService(c).transform(request);
		const chat = c.chat as ReturnType<typeof vi.fn>;
		expect(chat).toHaveBeenCalledWith(
			expect.objectContaining({ temperature: 0.2, max_tokens: 4096 }),
		);
	});

	it("rejects extra cards in edit mode", async () => {
		await expect(
			new CardAIService(
				client(`[{"Front":"Q1","Back":"A1"},{"Front":"Q2","Back":"A2"}]`),
			).transform(request),
		).rejects.toBeInstanceOf(CardAIParseError);
	});

	it("preserves fields outside the configured edit scope", async () => {
		const result = await new CardAIService(
			client(`[{"Front":"Clear question","Back":"Invented answer"}]`),
		).transform({ ...request, fieldScope: "question" });

		expect(result.cards).toEqual([{ Front: "Clear question", Back: "" }]);
	});

	it("rejects a spawn response that edits the source card", async () => {
		await expect(
			new CardAIService(
				client(`[{"Front":"Changed","Back":""},{"Front":"New","Back":"A"}]`),
			).transform({ ...request, mode: "spawn" }),
		).rejects.toBeInstanceOf(CardAIParseError);
	});

	it("throws CardAIAbortedError when signal is pre-aborted", async () => {
		const c = new AbortController();
		c.abort();
		await expect(
			new CardAIService(client(`[{"Front":"Q","Back":"A"}]`)).transform({
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

	it("tolerates a JSON array embedded in prose via array-span fallback", async () => {
		const r = await new CardAIService(
			client('Sure! Here you go: [{"Front":"Q","Back":"A"}] Let me know.'),
		).transform(request);
		expect(r.cards).toEqual([{ Front: "Q", Back: "A" }]);
	});

	it("rejects a bracketed-number prose pattern (e.g. 'cards: [1] foo') — anchor requires { after [", async () => {
		await expect(
			new CardAIService(client("Here are cards: [1] one [2] two")).transform(
				request,
			),
		).rejects.toBeInstanceOf(CardAIParseError);
	});
});
