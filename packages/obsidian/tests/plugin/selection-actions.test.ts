import { describe, expect, it, vi } from "vitest";

import {
	createNoteFromSelection,
	generateWithPreset,
} from "@true-recall/obsidian/plugin/SelectionActions";

vi.mock(
	"@true-recall/obsidian/modals/study/CreateNoteFromSelectionModal",
	() => ({
		CreateNoteFromSelectionModal: class {
			static buildNotePath(name: string, folder: string): string {
				return folder ? `${folder}/${name}.md` : `${name}.md`;
			}
			openAndWait() {
				return Promise.resolve({
					cancelled: false,
					name: "Selection Note",
					folder: "Projects/New",
					parentProject: null,
				});
			}
		},
	}),
);

function createPlugin() {
	const startThread = vi.fn();
	return {
		plugin: {
			settings: {
				generationPresets: [
					{
						id: "basic",
						name: "Basic",
						prompt: "Generate cards",
					},
				],
			},
			app: {
				workspace: {
					getActiveFile: () => ({ path: "Notes/source.md" }),
				},
			},
			assistantService: { startThread },
		},
		startThread,
	};
}

describe("createNoteFromSelection", () => {
	it("creates the missing target folder before creating the note", async () => {
		const present = new Set<string>();
		const create = vi.fn(async (path: string) => {
			present.add(path);
			return { path, basename: "Selection Note" };
		});
		const createFolder = vi.fn(async (path: string) => {
			present.add(path);
		});
		const plugin = {
			app: {
				vault: {
					getAbstractFileByPath: (path: string) =>
						present.has(path) ? { path } : null,
					create,
					createFolder,
				},
				workspace: { openLinkText: vi.fn(async () => {}) },
			},
			flashcardManager: {
				getFrontmatterService: () => ({
					generateUid: () => "uid-1",
					setSourceNoteUid: vi.fn(async () => {}),
				}),
			},
		};

		await createNoteFromSelection(plugin as never, "selected text");

		expect(createFolder.mock.calls.map((c) => c[0])).toEqual([
			"Projects",
			"Projects/New",
		]);
		expect(create).toHaveBeenCalledWith(
			"Projects/New/Selection Note.md",
			"selected text",
		);
	});
});

describe("generateWithPreset", () => {
	it("marks source-note generation for direct apply instead of the AI inbox", async () => {
		const { plugin, startThread } = createPlugin();

		await generateWithPreset(plugin as never, "basic", "Selected text");

		expect(startThread).toHaveBeenCalledWith({
			instruction: "Generate cards",
			presetId: "generation:basic",
			context: {
				selectedText: "Selected text",
				activeNotePath: "Notes/source.md",
				source: { path: "Notes/source.md", text: "Selected text" },
				applyGeneratedCardsImmediately: true,
			},
			state: "active",
			displayMessage: "Generate with Basic",
		});
	});
});
