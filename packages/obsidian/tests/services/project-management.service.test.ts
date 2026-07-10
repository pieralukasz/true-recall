import { describe, expect, it } from "vitest";

import { folderFromPath } from "@true-recall/obsidian/services/project-management.service";

describe("folderFromPath", () => {
	it("returns the containing folder for a nested path", () => {
		expect(folderFromPath("Projects/Foo.md")).toBe("Projects");
	});

	it("returns an empty string for a vault-root path", () => {
		expect(folderFromPath("Foo.md")).toBe("");
	});

	it("returns the full nested folder for a deeply nested path", () => {
		expect(folderFromPath("Projects/Work/Foo.md")).toBe("Projects/Work");
	});
});
