import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("core platform boundary", () => {
	it("keeps production code and tests independent of the Obsidian package", () => {
		const root = resolve(import.meta.dirname, "../..");
		const files = ["src", "tests"].flatMap((folder) =>
			readdirSync(join(root, folder), { recursive: true })
				.filter(
					(entry): entry is string =>
						typeof entry === "string" && /\.tsx?$/.test(entry),
				)
				.map((entry) => join(folder, entry)),
		);
		const violations = files.filter((file) =>
			/(?:from\s*|import\s*\(|mock\s*\()\s*["'](?:obsidian|@true-recall\/obsidian(?:\/[^"']*)?)["']/.test(
				readFileSync(join(root, file), "utf8"),
			),
		);
		expect(violations).toEqual([]);
	});
});
