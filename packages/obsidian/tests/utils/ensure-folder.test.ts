import { describe, expect, it, vi } from "vitest";

import { ensureFolderExists } from "@true-recall/obsidian/utils/ensure-folder";

function createVault(existing: string[] = []) {
	const present = new Set(existing);
	return {
		getAbstractFileByPath: vi.fn((path: string) =>
			present.has(path) ? { path } : null,
		),
		createFolder: vi.fn(async (path: string) => {
			present.add(path);
		}),
	};
}

describe("ensureFolderExists", () => {
	it("creates every missing ancestor segment in order", async () => {
		const vault = createVault();

		await ensureFolderExists(vault as never, "Projects/Deep/Nested");

		expect(vault.createFolder.mock.calls.map((c) => c[0])).toEqual([
			"Projects",
			"Projects/Deep",
			"Projects/Deep/Nested",
		]);
	});

	it("skips segments that already exist", async () => {
		const vault = createVault(["Projects"]);

		await ensureFolderExists(vault as never, "Projects/New");

		expect(vault.createFolder.mock.calls.map((c) => c[0])).toEqual([
			"Projects/New",
		]);
	});

	it("does nothing for an empty or root path", async () => {
		const vault = createVault();

		await ensureFolderExists(vault as never, "");
		await ensureFolderExists(vault as never, "/");

		expect(vault.createFolder).not.toHaveBeenCalled();
	});
});
