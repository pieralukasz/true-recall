import { describe, expect, it } from "vitest";
import { mapOpenverseResults } from "../../src/services/assistant/openverse";

describe("mapOpenverseResults", () => {
	it("maps results defensively", () => {
		const json = {
			results: [
				{
					url: "https://img/1.jpg",
					thumbnail: "https://t/1.jpg",
					title: "One",
					license: "cc0",
				},
				{ url: null, thumbnail: null, title: null, license: null },
			],
		};
		const out = mapOpenverseResults(json, 5);
		expect(out).toEqual([
			{
				url: "https://img/1.jpg",
				thumbnailUrl: "https://t/1.jpg",
				title: "One",
				license: "cc0",
			},
		]);
	});

	it("caps at count", () => {
		const json = {
			results: Array.from({ length: 9 }, (_, i) => ({ url: `https://img/${i}` })),
		};
		expect(mapOpenverseResults(json, 3)).toHaveLength(3);
	});

	it("returns an empty array for malformed input", () => {
		expect(mapOpenverseResults(null, 5)).toEqual([]);
		expect(mapOpenverseResults({}, 5)).toEqual([]);
	});
});
