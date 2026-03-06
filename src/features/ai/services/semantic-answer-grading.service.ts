import {
	getBYOKFallbackConfig,
	resolveAIClientConfig,
	type AIClientConfig,
} from "@features/ai/services/ai-client-config";
import {
	AIRequestError,
	OpenRouterClient,
	getTextContent,
	type ChatCompletionResponse,
} from "@features/ai/services/openrouter-client";
import { buildTypeInGradingMessages } from "@features/ai/prompts/type-in-grading-prompt";
import type {
	SemanticGradingResult,
	TrueRecallSettings,
} from "@shared/types";

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_FEEDBACK_LENGTH = 280;

interface SemanticGradingPayload {
	score: number;
	feedback: string;
}

interface GradeAnswerInput {
	question: string;
	correctAnswer: string;
	userAnswer: string;
	passThreshold: number;
	localFallbackScore: number;
	timeoutMs?: number;
}

type ClientFactory = (config: AIClientConfig) => {
	chat: (request: {
		messages: Array<{
			role: "system" | "user";
			content: string;
		}>;
		temperature: number;
	}) => Promise<ChatCompletionResponse>;
};

function clampScore(score: number): number {
	return Math.max(0, Math.min(100, Math.round(score)));
}

function clampThreshold(value: number): number {
	return Math.max(0, Math.min(100, Math.round(value)));
}

function truncateFeedback(feedback: string): string {
	const normalized = feedback.trim().replace(/\s+/g, " ");
	if (normalized.length <= MAX_FEEDBACK_LENGTH) return normalized;
	return `${normalized.slice(0, MAX_FEEDBACK_LENGTH - 1)}…`;
}

function extractJsonBlock(text: string): string | null {
	const trimmed = text.trim();
	if (!trimmed) return null;

	const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fencedMatch?.[1]) {
		return fencedMatch[1].trim();
	}

	const start = trimmed.indexOf("{");
	const end = trimmed.lastIndexOf("}");
	if (start === -1 || end <= start) return null;
	return trimmed.slice(start, end + 1);
}

export class SemanticAnswerGradingService {
	constructor(
		private getSettings: () => TrueRecallSettings,
		private createClient: ClientFactory = (config) =>
			new OpenRouterClient(
				config.apiKey,
				config.model,
				config.proxyUrl,
				config.userId,
			),
	) {}

	async gradeAnswer(input: GradeAnswerInput): Promise<SemanticGradingResult> {
		const settings = this.getSettings();

		let primaryConfig: AIClientConfig;
		try {
			primaryConfig = resolveAIClientConfig(settings);
		} catch {
			return this.buildLocalFallback(
				input,
				"AI key missing. Using local text comparison.",
			);
		}

		try {
			return await this.requestSemanticGrade(primaryConfig, input);
		} catch (error) {
			if (error instanceof AIRequestError && error.isBudgetExceeded) {
				const fallbackConfig = getBYOKFallbackConfig(settings);
				if (fallbackConfig) {
					try {
						return await this.requestSemanticGrade(fallbackConfig, input);
					} catch (fallbackError) {
						return this.buildLocalFallback(
							input,
							this.describeFailure(fallbackError),
						);
					}
				}
			}

			return this.buildLocalFallback(input, this.describeFailure(error));
		}
	}

	private async requestSemanticGrade(
		config: AIClientConfig,
		input: GradeAnswerInput,
	): Promise<SemanticGradingResult> {
		const client = this.createClient(config);
		const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

		const response = await this.withTimeout(
			client.chat({
				messages: buildTypeInGradingMessages(
					{
						question: input.question,
						correctAnswer: input.correctAnswer,
						userAnswer: input.userAnswer,
						passThreshold: input.passThreshold,
					},
					this.getSettings().aiTypeInGradingPrompt,
				),
				temperature: 0,
			}),
			timeoutMs,
		);

		const content = getTextContent(response.choices[0]?.message);
		const parsed = this.parsePayload(content);
		const score = clampScore(parsed.score);

		return {
			score,
			feedback: truncateFeedback(parsed.feedback),
			passed: score >= clampThreshold(input.passThreshold),
			source: "ai",
		};
	}

	private parsePayload(content: string): SemanticGradingPayload {
		const jsonText = extractJsonBlock(content);
		if (!jsonText) {
			throw new Error("Invalid AI response format");
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(jsonText);
		} catch {
			throw new Error("Failed to parse AI JSON response");
		}

		if (
			!parsed ||
			typeof parsed !== "object" ||
			typeof (parsed as SemanticGradingPayload).score !== "number" ||
			typeof (parsed as SemanticGradingPayload).feedback !== "string"
		) {
			throw new Error("AI response missing required fields");
		}

		return parsed as SemanticGradingPayload;
	}

	private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
		return new Promise((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				reject(new Error("AI grading timeout"));
			}, timeoutMs);

			promise
				.then((result) => {
					clearTimeout(timeoutId);
					resolve(result);
				})
				.catch((error) => {
					clearTimeout(timeoutId);
					reject(error);
				});
		});
	}

	private buildLocalFallback(
		input: GradeAnswerInput,
		reason: string,
	): SemanticGradingResult {
		const score = clampScore(input.localFallbackScore);
		return {
			score,
			passed: score >= clampThreshold(input.passThreshold),
			source: "local-fallback",
			feedback: truncateFeedback(reason),
		};
	}

	private describeFailure(error: unknown): string {
		if (error instanceof AIRequestError) {
			return `AI request failed (${error.statusCode}). Using local text comparison.`;
		}
		if (error instanceof Error) {
			return `${error.message}. Using local text comparison.`;
		}
		return "AI grading unavailable. Using local text comparison.";
	}
}
