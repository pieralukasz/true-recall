import type { IHttpClient } from "../../interfaces/http-client";
import {
	buildAIHeaders,
	type ChatMessage,
	OPENROUTER_URL,
} from "./openrouter-client";

export interface StreamingChatRequest {
	messages: ChatMessage[];
	temperature?: number;
	metadata?: Record<string, unknown>;
}

export interface StreamChunk {
	content: string;
	finishReason: string | null;
}

interface StreamChoiceDelta {
	content?: string;
}

interface StreamChoice {
	delta?: StreamChoiceDelta;
	finish_reason?: string | null;
}

interface StreamChunkPayload {
	choices?: StreamChoice[];
}

export class StreamingOpenRouterClient {
	private providerType: "pro" | "openrouter" | "custom" | "lmstudio";

	constructor(
		private apiKey: string,
		private model: string,
		private httpClient: IHttpClient,
		private baseUrl: string = OPENROUTER_URL,
		private userId?: string,
		options?: { providerType?: "pro" | "openrouter" | "custom" | "lmstudio" },
	) {
		this.providerType = options?.providerType ?? "openrouter";
	}

	async *chatStream(
		request: StreamingChatRequest,
		signal?: AbortSignal,
	): AsyncGenerator<StreamChunk> {
		const headers = buildAIHeaders(this.apiKey, {
			providerType: this.providerType,
			userId: this.userId,
		});

		const stream = this.httpClient.stream(
			this.baseUrl,
			{
				model: this.model,
				stream: true,
				...request,
			},
			headers,
		);

		// If signal is already aborted, throw immediately
		if (signal?.aborted) {
			throw new DOMException("The operation was aborted.", "AbortError");
		}

		for await (const sseData of stream) {
			if (signal?.aborted) {
				throw new DOMException("The operation was aborted.", "AbortError");
			}

			// Parse SSE lines from the chunk
			const lines = sseData.split("\n");

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed || trimmed === "data: [DONE]") continue;
				if (!trimmed.startsWith("data: ")) continue;

				try {
					const json = JSON.parse(trimmed.slice(6)) as StreamChunkPayload;
					const choice = json.choices?.[0];
					const content = choice?.delta?.content;
					if (content) {
						yield {
							content,
							finishReason: choice?.finish_reason ?? null,
						};
					}
				} catch {
					// Skip malformed SSE chunks
				}
			}
		}
	}
}
