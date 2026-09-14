import { requestUrl } from "obsidian";

import type { IHttpClient } from "@true-recall/core";
import {
	AppError,
	fromHttpResponse,
	InvalidResponseError,
	NetworkError,
} from "@true-recall/core/errors";

import { capabilities } from "@true-recall/obsidian/utils/platform";

export class ObsidianHttpClient implements IHttpClient {
	async post(
		url: string,
		body: unknown,
		headers?: Record<string, string>,
	): Promise<{ status: number; json: unknown; text: string }> {
		let response: Awaited<ReturnType<typeof requestUrl>>;
		try {
			response = await requestUrl({
				url,
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...headers,
				},
				body: JSON.stringify(body),
				throw: false,
			});
		} catch (error) {
			throw networkError(error, url);
		}
		let data: unknown;
		try {
			data = response.json as unknown;
		} catch (error) {
			if (response.status < 400) {
				throw new InvalidResponseError("Response body is not valid JSON", {
					cause: error,
					context: { method: "POST", route: safeRoute(url) },
				});
			}
		}
		if (response.status >= 400) {
			throw fromHttpResponse(response.status, data, {
				method: "POST",
				route: safeRoute(url),
				cause: response,
			});
		}
		return {
			status: response.status,
			json: data,
			text: response.text,
		};
	}

	async *stream(
		url: string,
		body: unknown,
		headers?: Record<string, string>,
		signal?: AbortSignal,
	): AsyncIterable<string> {
		// requestUrl does not support streaming responses; native fetch is
		// required here to get a readable stream reader. Called via activeWindow
		// so the request originates from the window the user is working in.
		// Mobile WebViews subject that fetch to CORS, so there we go through
		// requestUrl instead and emit the finished response in one chunk.
		if (!capabilities.canUseStreamingFetch()) {
			yield* this.streamViaRequestUrl(url, body, headers, signal);
			return;
		}

		let response: Response;
		try {
			response = await activeWindow.fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...headers,
				},
				body: JSON.stringify(body),
				signal,
			});
		} catch (err) {
			if (signal?.aborted) throw new NetworkError("aborted", { cause: err });
			// Network-layer failure before the first byte (CORS, blocked
			// fetch): degrade to the CORS-free non-streaming path.
			console.warn(
				"[True Recall] Streaming fetch failed, falling back to requestUrl:",
				err,
			);
			yield* this.streamViaRequestUrl(url, body, headers, signal);
			return;
		}

		if (response.ok === false || response.status >= 400) {
			const text = await response.text();
			throw fromHttpResponse(response.status, parseJson(text), {
				method: "POST",
				route: safeRoute(url),
				requestId: response.headers.get("x-request-id") ?? undefined,
				cause: response,
			});
		}

		if (!response.body) {
			throw new InvalidResponseError("Streaming response has no body", {
				context: { method: "POST", route: safeRoute(url) },
			});
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				yield decoder.decode(value, { stream: true });
			}
		} finally {
			reader.releaseLock();
		}
	}

	/**
	 * Non-streaming fallback: the provider still answers an SSE request with
	 * the full "data: ..." transcript, requestUrl just delivers it all at
	 * once. Emitting it as a single chunk keeps the SSE parser upstream
	 * working unchanged; the user sees the answer appear in one step.
	 */
	private async *streamViaRequestUrl(
		url: string,
		body: unknown,
		headers?: Record<string, string>,
		signal?: AbortSignal,
	): AsyncIterable<string> {
		if (signal?.aborted) throw new NetworkError("aborted");
		const response = await this.post(url, body, headers);
		if (signal?.aborted) throw new NetworkError("aborted");
		yield response.text;
	}
}

function networkError(error: unknown, url: string): AppError {
	if (error instanceof AppError) return error;
	if (error instanceof DOMException && error.name === "AbortError") {
		return new NetworkError("aborted", { cause: error });
	}
	if (error instanceof DOMException && error.name === "TimeoutError") {
		return new NetworkError("timeout", { cause: error });
	}
	return new NetworkError("connection-lost", {
		cause: error,
		context: { method: "POST", route: safeRoute(url) },
	});
}

function safeRoute(url: string): string {
	try {
		return new URL(url).pathname;
	} catch {
		return "unknown";
	}
}

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}
