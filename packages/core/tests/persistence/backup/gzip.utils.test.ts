import pako from "pako";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	gzipCompress,
	gzipDecompress,
} from "../../../src/persistence/backup/gzip.utils";

const sample = () => new TextEncoder().encode("SQLite format 3".repeat(1000));

describe("gzip.utils", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	describe("native streams path", () => {
		it("round-trips data through compress and decompress", async () => {
			const data = sample();
			const compressed = await gzipCompress(data);
			const decompressed = await gzipDecompress(compressed);

			expect(decompressed).toEqual(data);
			expect(compressed.length).toBeLessThan(data.length);
		});

		it("produces a valid gzip header", async () => {
			const compressed = await gzipCompress(sample());

			expect(compressed[0]).toBe(0x1f);
			expect(compressed[1]).toBe(0x8b);
		});

		it("produces output pako can decompress", async () => {
			const data = sample();
			const compressed = await gzipCompress(data);

			expect(pako.ungzip(compressed)).toEqual(data);
		});
	});

	describe("pako fallback path", () => {
		it("round-trips when the Streams API is unavailable", async () => {
			vi.stubGlobal("CompressionStream", undefined);
			vi.stubGlobal("DecompressionStream", undefined);

			const data = sample();
			const compressed = await gzipCompress(data);
			const decompressed = await gzipDecompress(compressed);

			expect(decompressed).toEqual(data);
			expect(compressed[0]).toBe(0x1f);
			expect(compressed[1]).toBe(0x8b);
		});

		it("falls back to pako when the native stream throws", async () => {
			vi.stubGlobal(
				"CompressionStream",
				class {
					constructor() {
						throw new Error("boom");
					}
				},
			);
			vi.spyOn(console, "warn").mockImplementation(() => {});

			const data = sample();
			const compressed = await gzipCompress(data);

			expect(pako.ungzip(compressed)).toEqual(data);
			expect(console.warn).toHaveBeenCalledOnce();
		});

		it("decompresses native-stream output with pako and vice versa", async () => {
			const data = sample();
			const nativeCompressed = await gzipCompress(data);

			vi.stubGlobal("DecompressionStream", undefined);
			const viaPako = await gzipDecompress(nativeCompressed);

			expect(viaPako).toEqual(data);
		});
	});
});
