import type { IHttpClient } from "../interfaces/http-client";
import {
	AIRequestError,
	buildOpenRouterHeaders,
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

export class StreamingOpenRouterClient {
	constructor(
		private apiKey: string,
		private model: string,
		private httpClient: IHttpClient,
		private baseUrl: string = OPENROUTER_URL,
		private userId?: string,
	) {}

	async *chatStream(
		request: StreamingChatRequest,
		signal?: AbortSignal,
	): AsyncGenerator<StreamChunk> {
		const headers = buildOpenRouterHeaders(this.apiKey, this.userId);

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

		// Set up abort listener
		let abortHandler: (() => void) | undefined;
		const abortPromise = signal
			? new Promise<never>((_, reject) => {
					abortHandler = () =>
						reject(
							new DOMException("The operation was aborted.", "AbortError"),
						);
					signal.addEventListener("abort", abortHandler, { once: true });
				})
			: null;

		try {
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
			if (abortHandler && signal) {
				signal.removeEventListener("abort", abortHandler);
			}
		}
	}
}
