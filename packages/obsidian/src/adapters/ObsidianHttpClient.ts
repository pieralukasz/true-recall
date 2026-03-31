import type { IHttpClient } from "@true-recall/core";
import { requestUrl } from "obsidian";

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
		// eslint-disable-next-line @obsidianmd/no-fetch -- requestUrl does not support streaming responses; native fetch is required here
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...headers,
			},
			body: JSON.stringify(body),
		});

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
}
