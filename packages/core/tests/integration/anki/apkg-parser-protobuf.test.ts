import { describe, expect, it } from "vitest";

import {
	parseMediaProtobuf,
	readProtobufString,
	readProtobufVarint,
} from "../../../src/integration/anki/apkg/apkg-parser.service";

// Helper: encode a varint
function encodeVarint(value: number): number[] {
	const bytes: number[] = [];
	while (value > 0x7f) {
		bytes.push((value & 0x7f) | 0x80);
		value >>>= 7;
	}
	bytes.push(value);
	return bytes;
}

// Helper: encode a protobuf string field (tag + length + utf8 bytes)
function encodeStringField(fieldNumber: number, value: string): number[] {
	const tag = (fieldNumber << 3) | 2;
	const encoded = new TextEncoder().encode(value);
	return [...encodeVarint(tag), ...encodeVarint(encoded.length), ...encoded];
}

// Helper: encode a protobuf varint field
function encodeVarintField(fieldNumber: number, value: number): number[] {
	const tag = (fieldNumber << 3) | 0;
	return [...encodeVarint(tag), ...encodeVarint(value)];
}

// Helper: wrap bytes as a length-delimited sub-message
function encodeSubMessage(fieldNumber: number, inner: number[]): number[] {
	const tag = (fieldNumber << 3) | 2;
	return [...encodeVarint(tag), ...encodeVarint(inner.length), ...inner];
}

describe("readProtobufVarint", () => {
	it("decodes single-byte varint", () => {
		const data = new Uint8Array([0x08]);
		const result = readProtobufVarint(data, 0);
		expect(result).toEqual({ value: 8, next: 1 });
	});

	it("decodes multi-byte varint", () => {
		// 300 = 0b100101100 → [0xAC, 0x02]
		const data = new Uint8Array([0xac, 0x02]);
		const result = readProtobufVarint(data, 0);
		expect(result).toEqual({ value: 300, next: 2 });
	});

	it("returns null for empty data", () => {
		const result = readProtobufVarint(new Uint8Array([]), 0);
		expect(result).toBeNull();
	});

	it("reads from offset", () => {
		const data = new Uint8Array([0xff, 0x05]);
		const result = readProtobufVarint(data, 1);
		expect(result).toEqual({ value: 5, next: 2 });
	});
});

describe("readProtobufString", () => {
	it("extracts string for matching field number", () => {
		// field 1, wire type 2: tag = (1 << 3) | 2 = 0x0A
		const bytes = encodeStringField(1, "hello.jpg");
		const result = readProtobufString(new Uint8Array(bytes), 1);
		expect(result).toBe("hello.jpg");
	});

	it("returns empty string for non-matching field number", () => {
		const bytes = encodeStringField(2, "hello.jpg");
		const result = readProtobufString(new Uint8Array(bytes), 1);
		expect(result).toBe("");
	});

	it("skips varint fields to find the target string", () => {
		// varint field 3, then string field 1
		const bytes = [
			...encodeVarintField(3, 42),
			...encodeStringField(1, "found.png"),
		];
		const result = readProtobufString(new Uint8Array(bytes), 1);
		expect(result).toBe("found.png");
	});
});

describe("parseMediaProtobuf", () => {
	it("parses a single MediaEntry", () => {
		// MediaEntry { name = "image.jpg", size = 1024, sha1 = <bytes> }
		const inner = [
			...encodeStringField(1, "image.jpg"),
			...encodeVarintField(2, 1024),
		];
		const data = new Uint8Array(encodeSubMessage(1, inner));

		const result = parseMediaProtobuf(data);
		expect(result).toEqual({ "0": "image.jpg" });
	});

	it("parses multiple MediaEntries with ordinal indexing", () => {
		const entry0 = encodeSubMessage(1, encodeStringField(1, "audio.mp3"));
		const entry1 = encodeSubMessage(1, encodeStringField(1, "photo.png"));
		const entry2 = encodeSubMessage(1, encodeStringField(1, "video.mp4"));
		const data = new Uint8Array([...entry0, ...entry1, ...entry2]);

		const result = parseMediaProtobuf(data);
		expect(result).toEqual({
			"0": "audio.mp3",
			"1": "photo.png",
			"2": "video.mp4",
		});
	});

	it("returns empty object for empty data", () => {
		const result = parseMediaProtobuf(new Uint8Array([]));
		expect(result).toEqual({});
	});

	it("skips entries with no name field", () => {
		// Entry with only size (field 2), no name (field 1)
		const entryNoName = encodeSubMessage(1, encodeVarintField(2, 512));
		const entryWithName = encodeSubMessage(1, encodeStringField(1, "real.png"));
		const data = new Uint8Array([...entryNoName, ...entryWithName]);

		const result = parseMediaProtobuf(data);
		// Entry 0 has no name so skipped, entry 1 has name
		expect(result).toEqual({ "1": "real.png" });
	});

	it("skips top-level varint fields without breaking", () => {
		// A varint field before the repeated entries
		const varintField = encodeVarintField(5, 99);
		const entry = encodeSubMessage(1, encodeStringField(1, "file.txt"));
		const data = new Uint8Array([...varintField, ...entry]);

		const result = parseMediaProtobuf(data);
		expect(result).toEqual({ "0": "file.txt" });
	});

	it("handles unicode filenames", () => {
		const inner = encodeStringField(1, "日本語ファイル.jpg");
		const data = new Uint8Array(encodeSubMessage(1, inner));

		const result = parseMediaProtobuf(data);
		expect(result).toEqual({ "0": "日本語ファイル.jpg" });
	});
});
