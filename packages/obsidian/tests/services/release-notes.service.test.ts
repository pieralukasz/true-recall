import { describe, expect, it } from "vitest";

import {
	getReleaseNotes,
	parseReleaseNotes,
} from "@true-recall/obsidian/services/release-notes.service";

describe("parseReleaseNotes", () => {
	it("keeps release bodies separate, ignores drafts and sorts versions numerically", () => {
		const notes = parseReleaseNotes(
			[
				"# Changelog",
				"## Unreleased",
				"Work in progress",
				"## 2.5.9 (2026-09-15)",
				"### Fixes",
				"- Older patch",
				"## 2.5.10 (2026-09-16)",
				"Newer patch",
				"## 2.6.0-beta.1 (2026-09-17)",
				"Beta changes",
			].join("\n"),
		);

		expect(notes.map((release) => release.version)).toEqual([
			"2.5.10",
			"2.5.9",
		]);
		expect(notes[0]?.body).toBe("Newer patch");
		expect(notes[1]?.body).toBe("### Fixes\n- Older patch");
	});
});

describe("getReleaseNotes", () => {
	it.each([
		["2.5.1", "2.4.2", ["2.5.1", "2.5.0"]],
		["2.5.1", "2.5.0", ["2.5.1"]],
		["2.5.0", "2.4.2", ["2.5.0"]],
		["2.5.1", "2.5.1", []],
		["2.5.0", "2.5.1", []],
		["1.9.10", "1.9.9", ["1.9.10"]],
		["2.5.1", "2.5.1-beta.1", ["2.5.1"]],
		["2.5.1-beta.1", "2.5.0", []],
		["invalid", "2.5.0", []],
		["2.5.1", "invalid", []],
	])("selects notes through %s since %s", (current, previous, expected) => {
		expect(
			getReleaseNotes(current, previous).map((release) => release.version),
		).toEqual(expected);
	});

	it("includes the full 2.5.0 notes when upgrading straight to 2.5.1", () => {
		const notes = getReleaseNotes("2.5.1", "2.4.2");
		expect(notes[1]?.body).toContain("**Native settings pages.**");
		expect(notes[1]?.body).toContain(
			"**Ask a follow-up after a typed answer.**",
		);
		expect(notes[1]?.body).toContain("Requires **Obsidian 1.13.0 or later**");
		expect(notes[0]?.body).not.toContain("**Native settings pages.**");
	});

	it("provides earlier releases for manually browsing history without future versions", () => {
		const notes = getReleaseNotes("2.5.0");
		expect(notes[0]?.version).toBe("2.5.0");
		expect(notes.some((release) => release.version === "2.4.2")).toBe(true);
		expect(notes.some((release) => release.version === "2.5.1")).toBe(false);
	});
});
