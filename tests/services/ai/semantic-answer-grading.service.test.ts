import { DEFAULT_SETTINGS } from "../../../src/shared/constants";
import { describe, expect, it } from "vitest";
import { AIRequestError } from "../../../src/features/ai/services/openrouter-client";
import { SemanticAnswerGradingService } from "../../../src/features/ai/services/semantic-answer-grading.service";
import type { TrueRecallSettings } from "../../../src/shared/types";

function createSettings(overrides: Partial<TrueRecallSettings>): TrueRecallSettings {
	return {
		...DEFAULT_SETTINGS,
		...overrides,
	};
}

describe("SemanticAnswerGradingService", () => {
	it("parses valid JSON and returns AI result", async () => {
		const settings = createSettings({ openRouterApiKey: "byok-key" });
		const service = new SemanticAnswerGradingService(
			() => settings,
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

	it("retries with BYOK when subscription budget is exceeded (429)", async () => {
		const settings = createSettings({
			subscriptionKey: "sub-key",
			openRouterApiKey: "byok-key",
		});

		const service = new SemanticAnswerGradingService(
			() => settings,
			(config) => ({
				chat: async () => {
					if (config.apiKey === "sub-key") {
						throw new AIRequestError(429, "budget exceeded");
					}
					return {
						id: "resp-3",
						choices: [
							{
								message: {
									role: "assistant",
									content: '{"score": 87, "feedback": "Core meaning is preserved."}',
								},
								finish_reason: "stop",
							},
						],
					};
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

		expect(result.score).toBe(87);
		expect(result.source).toBe("ai");
		expect(result.passed).toBe(true);
	});
});
