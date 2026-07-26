import type { App } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import type { FrontmatterService } from "@true-recall/core/flashcard/source/frontmatter.service";
import type { FrontmatterIndexService } from "@true-recall/core/services/notes/frontmatter-index.service";
import type { HierarchyService } from "@true-recall/core/services/notes/hierarchy.service";

import {
	folderFromPath,
	ProjectManagementService,
} from "@true-recall/obsidian/services/project-management.service";

vi.mock("@true-recall/obsidian/data", () => ({
	mutate: vi.fn(),
}));

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

describe("createProjectWithChildren", () => {
	function makeService(existingFolders: string[] = []) {
		const existingPaths = new Set(existingFolders);
		const createdFolders: string[] = [];
		const createdFiles: string[] = [];

		const app = {
			vault: {
				getAbstractFileByPath: (path: string) =>
					existingPaths.has(path) ? {} : null,
				createFolder: async (path: string) => {
					createdFolders.push(path);
					existingPaths.add(path);
				},
				create: async (path: string) => {
					createdFiles.push(path);
				},
			},
		} as unknown as App;

		const service = new ProjectManagementService(
			app,
			{ markAsProject: vi.fn() } as unknown as FrontmatterService,
			{ invalidateGraph: vi.fn() } as unknown as HierarchyService,
			{} as unknown as FrontmatterIndexService,
		);

		return { service, createdFolders, createdFiles };
	}

	it("creates missing nested folders before creating the note", async () => {
		const { service, createdFolders, createdFiles } = makeService();

		await service.createProjectWithChildren("Foo", "Projects/Learning", []);

		expect(createdFolders).toEqual(["Projects", "Projects/Learning"]);
		expect(createdFiles).toEqual(["Projects/Learning/Foo.md"]);
	});

	it("skips folder segments that already exist", async () => {
		const { service, createdFolders } = makeService(["Projects"]);

		await service.createProjectWithChildren("Foo", "Projects/Learning", []);

		expect(createdFolders).toEqual(["Projects/Learning"]);
	});

	it("creates no folders for a vault-root project", async () => {
		const { service, createdFolders, createdFiles } = makeService();

		await service.createProjectWithChildren("Foo", "", []);

		expect(createdFolders).toEqual([]);
		expect(createdFiles).toEqual(["Foo.md"]);
	});
});
