import type { IHttpClient } from "../../interfaces/http-client";
import type {
	SemanticGradingResult,
	SuggestedRating,
	TrueRecallSettings,
	TypeInVerdict,
} from "../../types";
import {
	type ChatCompletionResponse,
	getTextContent,
	OpenRouterClient,
} from "../clients/openrouter-client";
import {
	type AIClientConfig,
	resolveAIClientConfig,
} from "../config/ai-client-config";
import {
	buildTypeInGradingMessages,
	type TypeInGradingPromptRelatedCard,
} from "../prompts/type-in-grading-prompt";

const DEFAULT_TIMEOUT_MS = 20000;
const MAX_COMMENT_LENGTH = 400;
const MAX_POINTS = 5;
const MAX_ERRORS = 3;

const VERDICTS: ReadonlySet<string> = new Set(["correct", "partial", "wrong"]);
const RATINGS: ReadonlySet<string> = new Set(["again", "hard", "good", "easy"]);

interface GradeAnswerInput {
	question: string;
	correctAnswer: string;
	userAnswer: string;
	timeoutMs?: number;
	sourceContext?: string;
	sourceNotePath?: string;
	relatedCards?: TypeInGradingPromptRelatedCard[];
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

function truncateComment(comment: string): string {
	const normalized = comment.trim().replace(/\s+/g, " ");
	if (normalized.length <= MAX_COMMENT_LENGTH) return normalized;
	return `${normalized.slice(0, MAX_COMMENT_LENGTH - 1)}…`;
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

function isStringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) && value.every((item) => typeof item === "string")
	);
}

function clampList(items: string[], max: number): string[] {
	return items
		.map((item) => item.trim())
		.filter(Boolean)
		.slice(0, max);
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
				undefined,
				undefined,
				{ providerType: config.providerType },
			),
	) {}

	async gradeAnswer(input: GradeAnswerInput): Promise<SemanticGradingResult> {
		const settings = this.getSettings();

		let config: AIClientConfig;
		try {
			config = resolveAIClientConfig(settings, "grading");
		} catch {
			throw new Error("AI key missing. Rate manually.");
		}

		const client = this.createClient(config);
		const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

		const metadata = config.hasProTier
			? { call_context: "grading" }
			: undefined;

		const response = await this.withTimeout(
			client.chat({
				messages: buildTypeInGradingMessages(
					{
						question: input.question,
						correctAnswer: input.correctAnswer,
						userAnswer: input.userAnswer,
						sourceContext: input.sourceContext,
						sourceNotePath: input.sourceNotePath,
						relatedCards: input.relatedCards,
					},
					settings.aiTypeInGradingPrompt,
				),
				...(config.hasProTier ? {} : { temperature: 0 }),
				metadata,
			}),
			timeoutMs,
		);

		const content = getTextContent(response.choices[0]?.message);
		return this.parsePayload(content);
	}

	private parsePayload(content: string): SemanticGradingResult {
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

		if (!parsed || typeof parsed !== "object") {
			throw new Error("AI response missing required fields");
		}

		const payload = parsed as Record<string, unknown>;
		if (
			typeof payload.verdict !== "string" ||
			!VERDICTS.has(payload.verdict) ||
			typeof payload.teacherComment !== "string" ||
			!isStringArray(payload.covered) ||
			!isStringArray(payload.missing) ||
			!isStringArray(payload.errors) ||
			typeof payload.suggestedRating !== "string" ||
			!RATINGS.has(payload.suggestedRating)
		) {
			throw new Error("AI response missing required fields");
		}

		return {
			verdict: payload.verdict as TypeInVerdict,
			teacherComment: truncateComment(payload.teacherComment),
			covered: clampList(payload.covered, MAX_POINTS),
			missing: clampList(payload.missing, MAX_POINTS),
			errors: clampList(payload.errors, MAX_ERRORS),
			suggestedRating: payload.suggestedRating as SuggestedRating,
		};
	}

	private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
		return new Promise((resolve, reject) => {
			const timeoutId = window.setTimeout(() => {
				reject(new Error("AI grading timeout"));
			}, timeoutMs);

			promise
				.then((result) => {
					window.clearTimeout(timeoutId);
					resolve(result);
				})
				.catch((error: unknown) => {
					window.clearTimeout(timeoutId);
					reject(error instanceof Error ? error : new Error(String(error)));
				});
		});
	}
}
