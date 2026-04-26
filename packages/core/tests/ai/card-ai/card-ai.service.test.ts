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

const BASIC_NOTE_TYPE = {
	name: "Basic",
	fields: ["Front", "Back"] as const,
};

describe("CardAIService", () => {
	beforeEach(() => vi.clearAllMocks());

	it("parses a single-element JSON array response", async () => {
		const r = await new CardAIService(
			client(`[{"Front":"Q","Back":"A"}]`),
		).transform({
			fields: { Front: "q", Back: "" },
			noteType: BASIC_NOTE_TYPE,
			prompt: "P",
		});
		expect(r.cards).toEqual([{ Front: "Q", Back: "A" }]);
		expect(r.usage).toEqual({ promptTokens: 10, completionTokens: 20 });
	});

	it("parses a multi-element JSON array response", async () => {
		const r = await new CardAIService(
			client(
				`[{"Front":"Q1","Back":"A1"},{"Front":"Q2","Back":"A2"},{"Front":"Q3","Back":"A3"}]`,
			),
		).transform({
			fields: { Front: "q", Back: "" },
			noteType: BASIC_NOTE_TYPE,
			prompt: "P",
		});
		expect(r.cards).toHaveLength(3);
		expect(r.cards[0]).toEqual({ Front: "Q1", Back: "A1" });
		expect(r.cards[2]).toEqual({ Front: "Q3", Back: "A3" });
	});

	it("strips ```json fences around an array", async () => {
		const r = await new CardAIService(
			client('```json\n[{"Front":"Q","Back":"A"}]\n```'),
		).transform({
			fields: { Front: "q", Back: "" },
			noteType: BASIC_NOTE_TYPE,
			prompt: "P",
		});
		expect(r.cards).toEqual([{ Front: "Q", Back: "A" }]);
	});

	it("throws CardAIParseError on garbage", async () => {
		await expect(
			new CardAIService(client("not json")).transform({
				fields: { Front: "q", Back: "" },
				noteType: BASIC_NOTE_TYPE,
				prompt: "P",
			}),
		).rejects.toBeInstanceOf(CardAIParseError);
	});

	it("throws CardAIParseError when a requested key is missing in any element", async () => {
		await expect(
			new CardAIService(client(`[{"Front":"Q"}]`)).transform({
				fields: { Front: "q", Back: "" },
				noteType: BASIC_NOTE_TYPE,
				prompt: "P",
			}),
		).rejects.toBeInstanceOf(CardAIParseError);
	});

	it("throws CardAIParseError on legacy single-object response (regression)", async () => {
		await expect(
			new CardAIService(client(`{"Front":"Q","Back":"A"}`)).transform({
				fields: { Front: "q", Back: "" },
				noteType: BASIC_NOTE_TYPE,
				prompt: "P",
			}),
		).rejects.toBeInstanceOf(CardAIParseError);
	});

	it("sends temperature 0.7 in the chat request", async () => {
		const c = client(`[{"Front":"Q","Back":"A"}]`);
		await new CardAIService(c).transform({
			fields: { Front: "q", Back: "" },
			noteType: BASIC_NOTE_TYPE,
			prompt: "P",
		});
		const chat = c.chat as ReturnType<typeof vi.fn>;
		expect(chat).toHaveBeenCalledWith(
			expect.objectContaining({ temperature: 0.7 }),
		);
	});

	it("throws CardAIAbortedError when signal is pre-aborted", async () => {
		const c = new AbortController();
		c.abort();
		await expect(
			new CardAIService(client(`[{"Front":"Q","Back":"A"}]`)).transform({
				fields: { Front: "q", Back: "" },
				noteType: BASIC_NOTE_TYPE,
				prompt: "P",
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
		await expect(
			svc.transform({
				fields: { Front: "q", Back: "" },
				noteType: BASIC_NOTE_TYPE,
				prompt: "P",
			}),
		).rejects.toMatchObject({
			constructor: CardAIProviderError,
			cause,
		});
	});

	it("wraps a non-Error rejection in CardAIProviderError with fallback message", async () => {
		const failingClient = {
			chat: vi.fn().mockRejectedValue("unexpected string"),
		} as unknown as OpenRouterClient;
		const svc = new CardAIService(failingClient);
		await expect(
			svc.transform({
				fields: { Front: "q", Back: "" },
				noteType: BASIC_NOTE_TYPE,
				prompt: "P",
			}),
		).rejects.toMatchObject({
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
				fields: { Front: "q", Back: "" },
				noteType: BASIC_NOTE_TYPE,
				prompt: "P",
				signal: c.signal,
			}),
		).rejects.toBeInstanceOf(CardAIAbortedError);
	});

	it("tolerates a JSON array embedded in prose via array-span fallback", async () => {
		const r = await new CardAIService(
			client('Sure! Here you go: [{"Front":"Q","Back":"A"}] Let me know.'),
		).transform({
			fields: { Front: "q", Back: "" },
			noteType: BASIC_NOTE_TYPE,
			prompt: "P",
		});
		expect(r.cards).toEqual([{ Front: "Q", Back: "A" }]);
	});

	it("rejects a bracketed-number prose pattern (e.g. 'cards: [1] foo') — anchor requires { after [", async () => {
		await expect(
			new CardAIService(client("Here are cards: [1] one [2] two")).transform({
				fields: { Front: "q", Back: "" },
				noteType: BASIC_NOTE_TYPE,
				prompt: "P",
			}),
		).rejects.toBeInstanceOf(CardAIParseError);
	});
});
