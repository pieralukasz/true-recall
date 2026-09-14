import { requestUrl } from "obsidian";

import {
	AppError,
	fromHttpResponse,
	InvalidResponseError,
	NetworkError,
} from "@true-recall/core/errors";

export interface JsonRequestOptions {
	url: string;
	method?: "GET" | "POST" | "DELETE";
	headers?: Record<string, string>;
	body?: unknown;
	provider?: string;
}

export async function requestJson({
	url,
	method = "GET",
	headers,
	body,
	provider,
}: JsonRequestOptions): Promise<unknown> {
	let response: Awaited<ReturnType<typeof requestUrl>>;
	try {
		response = await requestUrl({
			url,
			method,
			contentType: body === undefined ? undefined : "application/json",
			headers,
			body: body === undefined ? undefined : JSON.stringify(body),
			throw: false,
		});
	} catch (error) {
		if (error instanceof AppError) throw error;
		throw new NetworkError("connection-lost", {
			cause: error,
			context: {
				method,
				route: routeOf(url),
				...(provider ? { provider } : {}),
			},
		});
	}

	let data: unknown;
	try {
		data = response.json as unknown;
	} catch (error) {
		if (response.status < 400) {
			throw new InvalidResponseError("Response body is not valid JSON", {
				cause: error,
				context: {
					method,
					route: routeOf(url),
					...(provider ? { provider } : {}),
				},
			});
		}
	}

	if (response.status >= 400) {
		throw fromHttpResponse(response.status, data, {
			method,
			route: routeOf(url),
			provider,
			cause: response,
		});
	}

	return data;
}

function routeOf(url: string): string {
	try {
		return new URL(url).pathname;
	} catch {
		return "unknown";
	}
}
