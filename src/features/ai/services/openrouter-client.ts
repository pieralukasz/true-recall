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

const BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

export class OpenRouterClient {
	constructor(
		private apiKey: string,
		private model: string,
	) {}

	async chat(
		request: ChatCompletionRequest,
	): Promise<ChatCompletionResponse> {
		const response = await requestUrl({
			url: BASE_URL,
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
