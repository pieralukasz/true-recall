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
	annotations?: UrlCitationAnnotation[];
}

/** OpenRouter message annotation for web-search citations (defensively typed). */
export interface UrlCitationAnnotation {
	type: string;
	url_citation?: {
		url: string;
		title?: string;
		content?: string;
	};
}

/** OpenRouter request plugin (e.g. { id: "web" } enables web search). */
export interface RequestPlugin {
	id: string;
	max_results?: number;
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

/**
 * OpenRouter prompt-caching breakpoint. Sent at the top level of the request;
 * OpenRouter applies it to the last cacheable block and advances it forward as
 * the conversation grows, so the static prefix (system prompt + tools) and
 * settled history are billed as cache reads instead of full input.
 */
export interface CacheControl {
	type: "ephemeral";
}

export interface ChatCompletionRequest {
	messages: ChatMessage[];
	temperature?: number;
	/** Hard cap on generated tokens. Prevents runaway output. */
	max_tokens?: number;
	tools?: ToolDefinition[];
	tool_choice?: "auto" | "none";
	metadata?: Record<string, unknown>;
	plugins?: RequestPlugin[];
	/** Prompt caching. Only forwarded to OpenRouter/Pro providers (see chat). */
	cache_control?: CacheControl;
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

		// Prompt caching is an OpenRouter feature; local/custom OpenAI-compatible
		// endpoints may reject the unknown field, so only forward it there.
		const { cache_control, ...rest } = request;
		const body: Record<string, unknown> = { model: this.model, ...rest };
		const supportsCaching =
			this.providerType === "openrouter" || this.providerType === "pro";
		if (cache_control && supportsCaching) {
			body.cache_control = cache_control;
		}

		const response = await this.httpClient.post(this.baseUrl, body, headers);

		if (response.status !== 200) {
			throw new AIRequestError(response.status, response.text);
		}

		return response.json as ChatCompletionResponse;
	}
}
