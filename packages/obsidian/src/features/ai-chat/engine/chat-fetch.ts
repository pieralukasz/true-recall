import { requestUrl } from "obsidian";

/** The shape the AI SDK providers accept for `fetch`. */
type FetchFn = (
	input: RequestInfo | URL,
	init?: RequestInit,
) => Promise<Response>;

function urlOf(input: Parameters<FetchFn>[0]): string {
	if (typeof input === "string") return input;
	if (input instanceof URL) return input.href;
	return input.url;
}

function headersOf(init?: RequestInit): Record<string, string> {
	const out: Record<string, string> = {};
	new Headers(init?.headers).forEach((value, key) => {
		out[key] = value;
	});
	return out;
}

function abortError(): DOMException {
	return new DOMException("The request was aborted.", "AbortError");
}

/**
 * Obsidian's requestUrl is CORS-free but cannot stream: the whole SSE
 * transcript arrives at once and the chat shows the answer in one step.
 */
async function viaRequestUrl(
	input: Parameters<FetchFn>[0],
	init?: RequestInit,
): Promise<Response> {
	if (init?.signal?.aborted) throw abortError();
	const res = await requestUrl({
		url: urlOf(input),
		method: init?.method ?? "GET",
		headers: headersOf(init),
		body: typeof init?.body === "string" ? init.body : undefined,
		throw: false,
	});
	if (init?.signal?.aborted) throw abortError();
	return new Response(res.text, { status: res.status, headers: res.headers });
}

/**
 * The fetch the chat model uses. Desktop streams through the window's fetch
 * and falls back to requestUrl when that fails before the first byte (CORS,
 * a local server without CORS headers). Mobile WebViews apply CORS to fetch,
 * so there every call goes through requestUrl.
 */
export function createChatFetch(options: { streaming: boolean }): FetchFn {
	return async (input, init) => {
		if (!options.streaming) return viaRequestUrl(input, init);
		try {
			return await activeWindow.fetch(input, init);
		} catch (error) {
			if (init?.signal?.aborted) throw error;
			console.warn(
				"[True Recall] AI chat: streaming fetch failed, retrying without streaming:",
				error,
			);
			return viaRequestUrl(input, init);
		}
	};
}
