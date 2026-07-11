import pako from "pako";

/**
 * Gzip helpers that prefer the native Streams API over pako. pako runs the
 * whole deflate synchronously on the JS thread (~6s for a 160MB database),
 * while CompressionStream is chunked and handled by the engine. pako remains
 * as the fallback for runtimes without the Streams API.
 */

async function pipeThrough(
	data: Uint8Array,
	transform: ReadableWritablePair<Uint8Array, Uint8Array>,
): Promise<Uint8Array> {
	const stream = new Blob([toBlobPart(data)]).stream().pipeThrough(transform);
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Detach a copy on SharedArrayBuffer-typed views so Blob accepts them. */
function toBlobPart(data: Uint8Array): BlobPart {
	return data.buffer instanceof ArrayBuffer
		? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
		: new Uint8Array(data);
}

export async function gzipCompress(data: Uint8Array): Promise<Uint8Array> {
	if (typeof CompressionStream !== "undefined") {
		try {
			return await pipeThrough(data, new CompressionStream("gzip"));
		} catch (e) {
			console.warn(
				"[True Recall] Native gzip failed, falling back to pako:",
				e,
			);
		}
	}
	return pako.gzip(data);
}

export async function gzipDecompress(data: Uint8Array): Promise<Uint8Array> {
	if (typeof DecompressionStream !== "undefined") {
		try {
			return await pipeThrough(data, new DecompressionStream("gzip"));
		} catch (e) {
			console.warn(
				"[True Recall] Native gunzip failed, falling back to pako:",
				e,
			);
		}
	}
	return pako.ungzip(data);
}
