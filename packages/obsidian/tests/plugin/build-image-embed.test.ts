import { describe, expect, it } from "vitest";

import { buildImageEmbed } from "@true-recall/obsidian/plugin/build-image-embed";

describe("buildImageEmbed", () => {
	describe("external URLs", () => {
		it.each([
			"https://refactoring.guru/images/patterns/x.png",
			"http://example.com/img.jpg",
			"https://cdn.example.com/a.svg?v=2",
		])("wraps %s in markdown image syntax", (url) => {
			expect(buildImageEmbed(url)).toBe(`![](${url})`);
		});

		it("treats https:// case-insensitively", () => {
			expect(buildImageEmbed("HTTPS://x.com/y.png")).toBe(
				"![](HTTPS://x.com/y.png)",
			);
		});

		it("trims whitespace before deciding", () => {
			expect(buildImageEmbed("  https://x.com/y.png  ")).toBe(
				"![](https://x.com/y.png)",
			);
		});
	});

	describe("vault attachments", () => {
		it.each([
			["image.png", "![[image.png]]"],
			["folder/diagram.svg", "![[folder/diagram.svg]]"],
			["My File.jpg", "![[My File.jpg]]"],
		])("wraps %s as embed wikilink", (path, expected) => {
			expect(buildImageEmbed(path)).toBe(expected);
		});
	});
});
