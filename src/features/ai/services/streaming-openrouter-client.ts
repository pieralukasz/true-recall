import {
	AIRequestError,
	buildOpenRouterHeaders,
	type ChatMessage,
	OPENROUTER_URL,
} from "./openrouter-client";

export interface StreamingChatRequest {
	messages: ChatMessage[];
	temperature?: number;
}

export interface StreamChunk {
	content: string;
	finishReason: string | null;
}

export class StreamingOpenRouterClient {
	private baseUrl: string;

	constructor(
		private apiKey: string,
		private model: string,
		proxyUrl?: string,
		private userId?: string,
	) {
		this.baseUrl = proxyUrl ?? OPENROUTER_URL;
	}

	async *chatStream(
		request: StreamingChatRequest,
		signal?: AbortSignal,
	): AsyncGenerator<StreamChunk> {
		const headers = buildOpenRouterHeaders(this.apiKey, this.userId);

		const response = await fetch(this.baseUrl, {
			method: "POST",
			headers,
			body: JSON.stringify({
				model: this.model,
				stream: true,
				...request,
			}),
			signal,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new AIRequestError(response.status, errorText);
		}

		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error("Response body is not readable");
		}

		const decoder = new TextDecoder();
		let buffer = "";

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() ?? "";

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed || trimmed === "data: [DONE]") continue;
					if (!trimmed.startsWith("data: ")) continue;

					try {
						const json = JSON.parse(trimmed.slice(6));
						const choice = json.choices?.[0];
						const content = choice?.delta?.content;
						if (content) {
							yield {
								content,
								finishReason: choice.finish_reason ?? null,
							};
						}
					} catch {
						// Skip malformed SSE chunks
					}
				}
			}
		} finally {
			reader.releaseLock();
		}
	}
}
