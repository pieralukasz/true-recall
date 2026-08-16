import { requestUrl } from "obsidian";

import type { IHttpClient } from "@true-recall/core";

import { capabilities } from "@true-recall/obsidian/utils/platform";

export class ObsidianHttpClient implements IHttpClient {
	async post(
		url: string,
		body: unknown,
		headers?: Record<string, string>,
	): Promise<{ status: number; json: unknown; text: string }> {
		const response = await requestUrl({
			url,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...headers,
			},
			body: JSON.stringify(body),
		});
		return {
			status: response.status,
			json: response.json,
			text: response.text,
		};
	}

	async *stream(
		url: string,
		body: unknown,
		headers?: Record<string, string>,
	): AsyncIterable<string> {
		// requestUrl does not support streaming responses; native fetch is
		// required here to get a readable stream reader. Called via activeWindow
		// so the request originates from the window the user is working in.
		// Mobile WebViews subject that fetch to CORS, so there we go through
		// requestUrl instead and emit the finished response in one chunk.
		if (!capabilities.canUseStreamingFetch()) {
			yield* this.streamViaRequestUrl(url, body, headers);
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
			});
		} catch (err) {
			// Network-layer failure before the first byte (CORS, blocked
			// fetch): degrade to the CORS-free non-streaming path.
			console.warn(
				"[True Recall] Streaming fetch failed, falling back to requestUrl:",
				err,
			);
			yield* this.streamViaRequestUrl(url, body, headers);
			return;
		}

		if (!response.body) {
			throw new Error(`No response body from ${url}`);
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
	): AsyncIterable<string> {
		const response = await this.post(url, body, headers);
		if (response.status >= 400) {
			throw new Error(`HTTP ${response.status} from ${url}`);
		}
		yield response.text;
	}
}
