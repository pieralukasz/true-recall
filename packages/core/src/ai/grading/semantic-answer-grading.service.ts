import type { IHttpClient } from "../../interfaces/http-client";
import type { SemanticGradingResult, TrueRecallSettings } from "../../types";
import {
	AIRequestError,
	type ChatCompletionResponse,
	getTextContent,
	OpenRouterClient,
} from "../clients/openrouter-client";
import {
	type AIClientConfig,
	resolveAIClientConfig,
} from "../config/ai-client-config";
import { buildTypeInGradingMessages } from "../prompts/type-in-grading-prompt";

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
	sourceContext?: string;
}

type ClientFactory = (config: AIClientConfig) => {
	chat: (request: {
		messages: Array<{
			role: "system" | "user";
			content: string;
		}>;
		temperature?: number;
		metadata?: Record<string, unknown>;
	}) => Promise<ChatCompletionResponse>;
};

function clamp100(value: number): number {
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
		httpClient: IHttpClient,
		private createClient: ClientFactory = (config) =>
			new OpenRouterClient(
				config.apiKey,
				config.model,
				httpClient,
				config.baseUrl,
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
			return this.buildLocalFallback(input, this.describeFailure(error));
		}
	}

	private async requestSemanticGrade(
		config: AIClientConfig,
		input: GradeAnswerInput,
	): Promise<SemanticGradingResult> {
		const client = this.createClient(config);
		const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

		const metadata = config.isPro ? { call_context: "grading" } : undefined;

		const response = await this.withTimeout(
			client.chat({
				messages: buildTypeInGradingMessages(
					{
						question: input.question,
						correctAnswer: input.correctAnswer,
						userAnswer: input.userAnswer,
						passThreshold: input.passThreshold,
						sourceContext: input.sourceContext,
					},
					this.getSettings().aiTypeInGradingPrompt,
				),
				...(config.isPro ? {} : { temperature: 0 }),
				metadata,
			}),
			timeoutMs,
		);

		const content = getTextContent(response.choices[0]?.message);
		const parsed = this.parsePayload(content);
		const score = clamp100(parsed.score);

		return {
			score,
			feedback: truncateFeedback(parsed.feedback),
			passed: score >= clamp100(input.passThreshold),
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
				.catch((error: unknown) => {
					clearTimeout(timeoutId);
					reject(error instanceof Error ? error : new Error(String(error)));
				});
		});
	}

	private buildLocalFallback(
		input: GradeAnswerInput,
		reason: string,
	): SemanticGradingResult {
		const score = clamp100(input.localFallbackScore);
		return {
			score,
			passed: score >= clamp100(input.passThreshold),
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
