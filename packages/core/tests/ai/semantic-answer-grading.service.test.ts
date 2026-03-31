import { DEFAULT_SETTINGS } from "../../src/constants";
import { describe, expect, it } from "vitest";
import { AIRequestError } from "../../src/ai/clients/openrouter-client";
import { SemanticAnswerGradingService } from "../../src/ai/grading/semantic-answer-grading.service";
import type { TrueRecallSettings } from "../../src/types";

function createSettings(overrides: Partial<TrueRecallSettings>): TrueRecallSettings {
	return {
		...DEFAULT_SETTINGS,
		...overrides,
	};
}

const dummyHttpClient = {} as never;

describe("SemanticAnswerGradingService", () => {
	it("parses valid JSON and returns AI result", async () => {
		const settings = createSettings({ openRouterApiKey: "byok-key" });
		const service = new SemanticAnswerGradingService(
			() => settings,
			dummyHttpClient,
			() => ({
				chat: async () => ({
					id: "resp-1",
					choices: [
						{
							message: {
								role: "assistant",
								content:
									'{"score": 92, "feedback": "Meaning is correct with minor wording differences."}',
							},
							finish_reason: "stop",
						},
					],
				}),
			}),
		);

		const result = await service.gradeAnswer({
			question: "Main cause of WW2",
			correctAnswer: "Germany invaded Poland",
			userAnswer: "Hitler invaded Polish lands",
			passThreshold: 85,
			localFallbackScore: 70,
		});

		expect(result).toEqual({
			score: 92,
			passed: true,
			source: "ai",
			feedback: "Meaning is correct with minor wording differences.",
		});
	});

	it("falls back to local score on timeout", async () => {
		const settings = createSettings({ openRouterApiKey: "byok-key" });
		const service = new SemanticAnswerGradingService(
			() => settings,
			dummyHttpClient,
			() => ({
				chat: async () => new Promise(() => {}),
			}),
		);

		const result = await service.gradeAnswer({
			question: "Q",
			correctAnswer: "A",
			userAnswer: "B",
			passThreshold: 85,
			localFallbackScore: 60,
			timeoutMs: 1,
		});

		expect(result.score).toBe(60);
		expect(result.source).toBe("local-fallback");
		expect(result.passed).toBe(false);
	});

	it("falls back to local score on invalid AI payload", async () => {
		const settings = createSettings({ openRouterApiKey: "byok-key" });
		const service = new SemanticAnswerGradingService(
			() => settings,
			dummyHttpClient,
			() => ({
				chat: async () => ({
					id: "resp-2",
					choices: [
						{
							message: {
								role: "assistant",
								content: "not json",
							},
							finish_reason: "stop",
						},
					],
				}),
			}),
		);

		const result = await service.gradeAnswer({
			question: "Q",
			correctAnswer: "A",
			userAnswer: "B",
			passThreshold: 85,
			localFallbackScore: 88,
		});

		expect(result.score).toBe(88);
		expect(result.source).toBe("local-fallback");
		expect(result.passed).toBe(true);
	});

	it("falls back to local score on 429 rate limit", async () => {
		const settings = createSettings({
			openRouterApiKey: "byok-key",
		});

		const service = new SemanticAnswerGradingService(
			() => settings,
			dummyHttpClient,
			() => ({
				chat: async () => {
					throw new AIRequestError(429, "rate limited");
				},
			}),
		);

		const result = await service.gradeAnswer({
			question: "Q",
			correctAnswer: "A",
			userAnswer: "B",
			passThreshold: 85,
			localFallbackScore: 40,
		});

		expect(result.score).toBe(40);
		expect(result.source).toBe("local-fallback");
		expect(result.passed).toBe(false);
	});

	it("uses custom type-in grading prompt from settings when provided", async () => {
		const settings = createSettings({
			openRouterApiKey: "byok-key",
			aiTypeInGradingPrompt: "CUSTOM_GRADING_PROMPT",
		});
		let capturedSystem = "";

		const service = new SemanticAnswerGradingService(
			() => settings,
			dummyHttpClient,
			() => ({
				chat: async (request) => {
					capturedSystem = request.messages[0]?.content ?? "";
					return {
						id: "resp-custom",
						choices: [
							{
								message: {
									role: "assistant",
									content: '{"score": 90, "feedback": "Correct."}',
								},
								finish_reason: "stop",
							},
						],
					};
				},
			}),
		);

		await service.gradeAnswer({
			question: "Q",
			correctAnswer: "A",
			userAnswer: "B",
			passThreshold: 85,
			localFallbackScore: 10,
		});

		expect(capturedSystem).toBe("CUSTOM_GRADING_PROMPT");
	});

	it("includes source context in user message when provided", async () => {
		const settings = createSettings({ openRouterApiKey: "byok-key" });
		let capturedUserMessage = "";

		const service = new SemanticAnswerGradingService(
			() => settings,
			dummyHttpClient,
			() => ({
				chat: async (request) => {
					capturedUserMessage = request.messages[1]?.content ?? "";
					return {
						id: "resp-ctx",
						choices: [
							{
								message: {
									role: "assistant",
									content: '{"score": 95, "feedback": "Correct."}',
								},
								finish_reason: "stop",
							},
						],
					};
				},
			}),
		);

		await service.gradeAnswer({
			question: "What is ATP?",
			correctAnswer: "Adenosine triphosphate",
			userAnswer: "ATP is the energy currency",
			passThreshold: 85,
			localFallbackScore: 10,
			sourceContext: "ATP (adenosine triphosphate) is the primary energy carrier in cells.",
		});

		expect(capturedUserMessage).toContain("<context>");
		expect(capturedUserMessage).toContain("adenosine triphosphate");
		expect(capturedUserMessage).toContain("</context>");
		expect(capturedUserMessage).toContain("Question: What is ATP?");
	});

	it("omits context block when sourceContext is not provided", async () => {
		const settings = createSettings({ openRouterApiKey: "byok-key" });
		let capturedUserMessage = "";

		const service = new SemanticAnswerGradingService(
			() => settings,
			dummyHttpClient,
			() => ({
				chat: async (request) => {
					capturedUserMessage = request.messages[1]?.content ?? "";
					return {
						id: "resp-no-ctx",
						choices: [
							{
								message: {
									role: "assistant",
									content: '{"score": 80, "feedback": "Close."}',
								},
								finish_reason: "stop",
							},
						],
					};
				},
			}),
		);

		await service.gradeAnswer({
			question: "Q",
			correctAnswer: "A",
			userAnswer: "B",
			passThreshold: 85,
			localFallbackScore: 10,
		});

		expect(capturedUserMessage).not.toContain("<context>");
		expect(capturedUserMessage.startsWith("Question: Q")).toBe(true);
	});
});
