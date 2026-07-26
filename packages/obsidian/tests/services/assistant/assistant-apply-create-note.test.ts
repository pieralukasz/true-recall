import { describe, expect, it, vi } from "vitest";

import type {
	AssistantProposal,
	AssistantTask,
} from "@true-recall/core/ai/assistant";

import { AssistantApplyService } from "@true-recall/obsidian/services/assistant/assistant-apply.service";

function createPlugin(options: { defaultProjectFolder: string }) {
	const present = new Set<string>();
	const create = vi.fn(async (path: string) => {
		present.add(path);
		return { path };
	});
	const createFolder = vi.fn(async (path: string) => {
		present.add(path);
	});
	const plugin = {
		settings: { defaultProjectFolder: options.defaultProjectFolder },
		app: {
			vault: {
				getAbstractFileByPath: (path: string) =>
					present.has(path) ? { path } : null,
				create,
				createFolder,
			},
		},
		flashcardManager: {
			getFrontmatterService: () => ({
				generateUid: () => "uid-1",
				setSourceNoteUid: vi.fn(async () => {}),
			}),
		},
		commandService: { execute: vi.fn(async () => {}) },
	};
	return { plugin, create, createFolder };
}

const task = { context: {} } as AssistantTask;

const proposal: Extract<AssistantProposal, { type: "create_note" }> = {
	id: "p1",
	status: "proposed",
	type: "create_note",
	title: "My Note",
	markdown: "content",
};

describe("AssistantApplyService — create_note", () => {
	it("creates the missing target folder before creating the note", async () => {
		const { plugin, create, createFolder } = createPlugin({
			defaultProjectFolder: "Projects/Inbox",
		});
		const service = new AssistantApplyService(plugin as never);

		const result = await service.apply(task, proposal);

		expect(result.ok).toBe(true);
		expect(createFolder.mock.calls.map((c) => c[0])).toEqual([
			"Projects",
			"Projects/Inbox",
		]);
		expect(create).toHaveBeenCalledWith("Projects/Inbox/My Note.md", "content");
	});

	it("creates the note directly when no folder is configured", async () => {
		const { plugin, create, createFolder } = createPlugin({
			defaultProjectFolder: "",
		});
		const service = new AssistantApplyService(plugin as never);

		const result = await service.apply(task, proposal);

		expect(result.ok).toBe(true);
		expect(createFolder).not.toHaveBeenCalled();
		expect(create).toHaveBeenCalledWith("My Note.md", "content");
	});
});
