import { requestUrl } from "obsidian";

export interface ChatMessage {
	role: "system" | "user" | "assistant" | "tool";
	content: string | null;
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
}

export interface ChatCompletionResponse {
	id: string;
	choices: Array<{
		message: ChatMessage;
		finish_reason: string;
	}>;
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface AIClientOptions {
	apiKey: string;
	model: string;
	proxyUrl?: string;
}

export class OpenRouterClient {
	private baseUrl: string;

	constructor(
		private apiKey: string,
		private model: string,
		proxyUrl?: string,
	) {
		this.baseUrl = proxyUrl ?? OPENROUTER_URL;
	}

	async chat(
		request: ChatCompletionRequest,
	): Promise<ChatCompletionResponse> {
		const response = await requestUrl({
			url: this.baseUrl,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.apiKey}`,
				"HTTP-Referer": "obsidian://true-recall",
				"X-Title": "True Recall",
			},
			body: JSON.stringify({
				model: this.model,
				...request,
			}),
		});

		if (response.status !== 200) {
			throw new Error(
				`OpenRouter API error (${response.status}): ${response.text}`,
			);
		}

		return response.json as ChatCompletionResponse;
	}
}
