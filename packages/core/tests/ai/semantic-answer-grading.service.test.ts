import { describe, expect, it } from "vitest";

import { AIRequestError } from "../../src/ai/clients/openrouter-client";
import { SemanticAnswerGradingService } from "../../src/ai/grading/semantic-answer-grading.service";
import { DEFAULT_SETTINGS } from "../../src/constants";
import type { TrueRecallSettings } from "../../src/types";

function createSettings(
	overrides: Partial<TrueRecallSettings>,
): TrueRecallSettings {
	return {
		...DEFAULT_SETTINGS,
		...overrides,
	};
}

const dummyHttpClient = {} as never;

const VALID_PAYLOAD = JSON.stringify({
	verdict: "correct",
	teacherComment: "Nicely explained in your own words.",
	covered: ["energy currency", "used by cells"],
	missing: [],
	errors: [],
	suggestedRating: "good",
});

function serviceReturning(
	settings: TrueRecallSettings,
	content: string,
	capture?: {
		onRequest?: (request: {
			messages: Array<{ role: "system" | "user"; content: string }>;
		}) => void;
		onConfig?: (config: { model: string }) => void;
	},
): SemanticAnswerGradingService {
	return new SemanticAnswerGradingService(
		() => settings,
		dummyHttpClient,
		(config) => {
			capture?.onConfig?.(config);
			return {
				chat: async (request) => {
					capture?.onRequest?.(request);
					return {
						id: "resp",
						choices: [
							{
								message: { role: "assistant", content },
								finish_reason: "stop",
							},
						],
					};
				},
			};
		},
	);
}

const BASE_INPUT = {
	question: "What is ATP?",
	correctAnswer: "Adenosine triphosphate, the energy currency of the cell",
	userAnswer: "It's the molecule cells use as energy money",
};

describe("SemanticAnswerGradingService", () => {
	it("parses a valid teacher verdict payload", async () => {
		const settings = createSettings({ openRouterApiKey: "byok-key" });
		const service = serviceReturning(settings, VALID_PAYLOAD);

		const result = await service.gradeAnswer(BASE_INPUT);

		expect(result).toEqual({
			verdict: "correct",
			teacherComment: "Nicely explained in your own words.",
			covered: ["energy currency", "used by cells"],
			missing: [],
			errors: [],
			suggestedRating: "good",
		});
	});

	it("clamps oversized lists and comment length", async () => {
		const settings = createSettings({ openRouterApiKey: "byok-key" });
		const payload = JSON.stringify({
			verdict: "partial",
			teacherComment: "x".repeat(600),
			covered: Array.from({ length: 9 }, (_, i) => `covered ${i}`),
			missing: Array.from({ length: 9 }, (_, i) => `missing ${i}`),
			errors: Array.from({ length: 9 }, (_, i) => `error ${i}`),
			suggestedRating: "hard",
		});
		const service = serviceReturning(settings, payload);

		const result = await service.gradeAnswer(BASE_INPUT);

		expect(result.teacherComment.length).toBeLessThanOrEqual(400);
		expect(result.covered).toHaveLength(5);
		expect(result.missing).toHaveLength(5);
		expect(result.errors).toHaveLength(3);
	});

	it("throws on timeout", async () => {
		const settings = createSettings({ openRouterApiKey: "byok-key" });
		const service = new SemanticAnswerGradingService(
			() => settings,
			dummyHttpClient,
			() => ({
				chat: async () => new Promise(() => {}),
			}),
		);

		await expect(
			service.gradeAnswer({ ...BASE_INPUT, timeoutMs: 1 }),
		).rejects.toThrow("AI grading timeout");
	});

	it("throws on non-JSON payload", async () => {
		const settings = createSettings({ openRouterApiKey: "byok-key" });
		const service = serviceReturning(settings, "not json");

		await expect(service.gradeAnswer(BASE_INPUT)).rejects.toThrow(
			"Invalid AI response format",
		);
	});

	it.each([
		[
			"bad verdict enum",
			{ ...JSON.parse(VALID_PAYLOAD), verdict: "excellent" },
		],
		["non-array covered", { ...JSON.parse(VALID_PAYLOAD), covered: "energy" }],
		[
			"bad suggestedRating",
			{ ...JSON.parse(VALID_PAYLOAD), suggestedRating: "perfect" },
		],
		[
			"missing teacherComment",
			(() => {
				const p = JSON.parse(VALID_PAYLOAD);
				delete p.teacherComment;
				return p;
			})(),
		],
	])("throws on invalid payload: %s", async (_label, payload) => {
		const settings = createSettings({ openRouterApiKey: "byok-key" });
		const service = serviceReturning(settings, JSON.stringify(payload));

		await expect(service.gradeAnswer(BASE_INPUT)).rejects.toThrow(
			"AI response missing required fields",
		);
	});

	it("throws on request error instead of falling back", async () => {
		const settings = createSettings({ openRouterApiKey: "byok-key" });
		const service = new SemanticAnswerGradingService(
			() => settings,
			dummyHttpClient,
			() => ({
				chat: async () => {
					throw new AIRequestError(429, "rate limited");
				},
			}),
		);

		await expect(service.gradeAnswer(BASE_INPUT)).rejects.toThrow();
	});

	it("throws when no AI key is configured", async () => {
		const settings = createSettings({ openRouterApiKey: "" });
		const service = serviceReturning(settings, VALID_PAYLOAD);

		await expect(service.gradeAnswer(BASE_INPUT)).rejects.toThrow(
			"AI key missing",
		);
	});

	it("uses the grading model override when set", async () => {
		const settings = createSettings({
			openRouterApiKey: "byok-key",
			aiModel: "google/gemini-3.7-flash",
			gradingModel: "anthropic/claude-sonnet-4",
		});
		let capturedModel = "";
		const service = serviceReturning(settings, VALID_PAYLOAD, {
			onConfig: (config) => {
				capturedModel = config.model;
			},
		});

		await service.gradeAnswer(BASE_INPUT);

		expect(capturedModel).toBe("anthropic/claude-sonnet-4");
	});

	it("inherits the main model when grading override is empty", async () => {
		const settings = createSettings({
			openRouterApiKey: "byok-key",
			aiModel: "google/gemini-3.7-flash",
			gradingModel: "",
		});
		let capturedModel = "";
		const service = serviceReturning(settings, VALID_PAYLOAD, {
			onConfig: (config) => {
				capturedModel = config.model;
			},
		});

		await service.gradeAnswer(BASE_INPUT);

		expect(capturedModel).toBe("google/gemini-3.7-flash");
	});

	it("uses custom type-in grading prompt from settings when provided", async () => {
		const settings = createSettings({
			openRouterApiKey: "byok-key",
			aiTypeInGradingPrompt: "CUSTOM_GRADING_PROMPT",
		});
		let capturedSystem = "";
		const service = serviceReturning(settings, VALID_PAYLOAD, {
			onRequest: (request) => {
				capturedSystem = request.messages[0]?.content ?? "";
			},
		});

		await service.gradeAnswer(BASE_INPUT);

		expect(capturedSystem).toBe("CUSTOM_GRADING_PROMPT");
	});

	it("includes source context and related cards in the user message", async () => {
		const settings = createSettings({ openRouterApiKey: "byok-key" });
		let capturedUserMessage = "";
		const service = serviceReturning(settings, VALID_PAYLOAD, {
			onRequest: (request) => {
				capturedUserMessage = request.messages[1]?.content ?? "";
			},
		});

		await service.gradeAnswer({
			...BASE_INPUT,
			sourceContext: "ATP powers cellular work.",
			sourceNotePath: "biology/atp.md",
			relatedCards: [
				{
					noteType: "Basic",
					fields: { Front: "Where is ATP made?", Back: "Mitochondria" },
				},
			],
		});

		expect(capturedUserMessage).toContain("<context>");
		expect(capturedUserMessage).toContain("biology/atp.md");
		expect(capturedUserMessage).toContain(
			"Related flashcards from the same source",
		);
		expect(capturedUserMessage).toContain("Mitochondria");
		expect(capturedUserMessage).toContain("Question: What is ATP?");
		expect(capturedUserMessage).not.toContain("Pass threshold");
	});

	it("omits context block when sourceContext is not provided", async () => {
		const settings = createSettings({ openRouterApiKey: "byok-key" });
		let capturedUserMessage = "";
		const service = serviceReturning(settings, VALID_PAYLOAD, {
			onRequest: (request) => {
				capturedUserMessage = request.messages[1]?.content ?? "";
			},
		});

		await service.gradeAnswer(BASE_INPUT);

		expect(capturedUserMessage).not.toContain("<context>");
		expect(capturedUserMessage.startsWith("Question: What is ATP?")).toBe(true);
	});
});
