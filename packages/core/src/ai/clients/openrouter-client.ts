import type { IHttpClient } from "../../interfaces/http-client";

export interface TextContentPart {
	type: "text";
	text: string;
}

export interface ImageUrlContentPart {
	type: "image_url";
	image_url: { url: string };
}

export type ContentPart = TextContentPart | ImageUrlContentPart;

export interface ChatMessage {
	role: "system" | "user" | "assistant" | "tool";
	content: string | ContentPart[] | null;
	tool_calls?: ToolCall[];
	tool_call_id?: string;
}

export interface ToolCall {
	id: string;
	type: "function";
	function: { name: string; arguments: string };
}

export interface ToolDefinition {
	type: "function";
	function: {
		name: string;
		description: string;
		parameters: Record<string, unknown>;
	};
}

interface ChatCompletionRequest {
	messages: ChatMessage[];
	temperature?: number;
	tools?: ToolDefinition[];
	tool_choice?: "auto" | "none";
	metadata?: Record<string, unknown>;
}

export interface ChatCompletionResponse {
	id: string;
	choices: Array<{
		message: ChatMessage;
		finish_reason: string;
	}>;
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
	};
}

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export function buildAIHeaders(
	apiKey: string,
	options?: {
		providerType?: "pro" | "openrouter" | "custom" | "lmstudio";
		userId?: string;
		capability?: string;
	},
): Record<string, string> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		Authorization: `Bearer ${apiKey}`,
	};

	const isOpenRouter =
		options?.providerType === "openrouter" || options?.providerType === "pro";
	if (isOpenRouter) {
		headers["HTTP-Referer"] = "obsidian://true-recall";
		headers["X-Title"] = "True Recall";
	}
	if (isOpenRouter && options?.userId) headers["X-User-Id"] = options.userId;
	if (isOpenRouter && options?.capability)
		headers["x-tr-capability"] = options.capability;
	return headers;
}

/** @deprecated Use buildAIHeaders with providerType option instead */
export function buildOpenRouterHeaders(
	apiKey: string,
	userId?: string,
	capability?: string,
): Record<string, string> {
	return buildAIHeaders(apiKey, {
		providerType: "openrouter",
		userId,
		capability,
	});
}

/** Extract text content from a ChatMessage response (handles both string and ContentPart[] content). */
export function getTextContent(message: ChatMessage | undefined): string {
	if (!message) return "";
	if (typeof message.content === "string") return message.content;
	if (Array.isArray(message.content)) {
		return message.content
			.filter((p): p is TextContentPart => p.type === "text")
			.map((p) => p.text)
			.join("");
	}
	return "";
}

export class AIRequestError extends Error {
	constructor(
		public readonly statusCode: number,
		responseText: string,
	) {
		super(`AI API error (${statusCode}): ${responseText}`);
		this.name = "AIRequestError";
	}

	get isRateLimited(): boolean {
		return this.statusCode === 429;
	}

	get isUnauthorized(): boolean {
		return this.statusCode === 401;
	}
}

export interface AIClientOptions {
	apiKey: string;
	model: string;
}

export class OpenRouterClient {
	private providerType: "pro" | "openrouter" | "custom" | "lmstudio";

	constructor(
		private apiKey: string,
		private model: string,
		private httpClient: IHttpClient,
		private baseUrl: string = OPENROUTER_URL,
		private userId?: string,
		private capability?: string,
		options?: { providerType?: "pro" | "openrouter" | "custom" | "lmstudio" },
	) {
		this.providerType = options?.providerType ?? "openrouter";
	}

	async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
		const headers = buildAIHeaders(this.apiKey, {
			providerType: this.providerType,
			userId: this.userId,
			capability: this.capability,
		});

		const response = await this.httpClient.post(
			this.baseUrl,
			{
				model: this.model,
				...request,
			},
			headers,
		);

		if (response.status !== 200) {
			throw new AIRequestError(response.status, response.text);
		}

		return response.json as ChatCompletionResponse;
	}
}
