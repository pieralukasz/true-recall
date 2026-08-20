import { Platform, requestUrl } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ObsidianHttpClient } from "@true-recall/obsidian/adapters/ObsidianHttpClient";

const mutablePlatform = Platform as unknown as {
	isMobile: boolean;
	isPhone: boolean;
	isTablet: boolean;
};

const requestUrlMock = requestUrl as unknown as ReturnType<typeof vi.fn>;

async function collect(iterable: AsyncIterable<string>): Promise<string[]> {
	const chunks: string[] = [];
	for await (const chunk of iterable) chunks.push(chunk);
	return chunks;
}

function fakeStreamingFetch(chunks: string[]) {
	const encoder = new TextEncoder();
	let index = 0;
	return vi.fn(async () => ({
		body: {
			getReader: () => ({
				read: async () =>
					index < chunks.length
						? { done: false, value: encoder.encode(chunks[index++]) }
						: { done: true, value: undefined },
				releaseLock: () => {},
			}),
		},
	}));
}

describe("ObsidianHttpClient.stream", () => {
	let originalFetch: unknown;

	beforeEach(() => {
		originalFetch = (activeWindow as { fetch?: unknown }).fetch;
		requestUrlMock.mockReset();
	});

	afterEach(() => {
		(activeWindow as { fetch?: unknown }).fetch = originalFetch;
		mutablePlatform.isMobile = false;
		mutablePlatform.isPhone = false;
		vi.restoreAllMocks();
	});

	it("streams chunks through native fetch on desktop", async () => {
		const fetchMock = fakeStreamingFetch(["data: a\n\n", "data: b\n\n"]);
		(activeWindow as { fetch: unknown }).fetch = fetchMock;

		const client = new ObsidianHttpClient();
		const chunks = await collect(client.stream("https://x", { stream: true }));

		expect(chunks).toEqual(["data: a\n\n", "data: b\n\n"]);
		expect(requestUrlMock).not.toHaveBeenCalled();
	});

	it("uses requestUrl and yields one chunk on mobile", async () => {
		mutablePlatform.isMobile = true;
		mutablePlatform.isPhone = true;
		const fetchMock = vi.fn();
		(activeWindow as { fetch: unknown }).fetch = fetchMock;
		requestUrlMock.mockResolvedValue({
			status: 200,
			json: null,
			text: 'data: {"choices":[]}\n\ndata: [DONE]\n\n',
		});

		const client = new ObsidianHttpClient();
		const chunks = await collect(client.stream("https://x", { stream: true }));

		expect(fetchMock).not.toHaveBeenCalled();
		expect(chunks).toEqual(['data: {"choices":[]}\n\ndata: [DONE]\n\n']);
	});

	it("falls back to requestUrl when native fetch rejects", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		(activeWindow as { fetch: unknown }).fetch = vi.fn(async () => {
			throw new TypeError("Failed to fetch");
		});
		requestUrlMock.mockResolvedValue({
			status: 200,
			json: null,
			text: "data: fallback\n\n",
		});

		const client = new ObsidianHttpClient();
		const chunks = await collect(client.stream("https://x", {}));

		expect(chunks).toEqual(["data: fallback\n\n"]);
		expect(warn).toHaveBeenCalled();
	});

	it("throws on an HTTP error in the fallback path", async () => {
		mutablePlatform.isMobile = true;
		requestUrlMock.mockResolvedValue({ status: 401, json: null, text: "" });

		const client = new ObsidianHttpClient();
		await expect(collect(client.stream("https://x", {}))).rejects.toThrow(
			"HTTP 401",
		);
	});
});
