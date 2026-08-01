import { describe, expect, it, vi } from "vitest";

import {
	createNoteFromSelection,
	generateWithPreset,
	generateWithPresetGlobal,
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
				providerType: "openrouter",
				openRouterApiKey: "test-key",
				lmStudioModel: "",
				lmStudioGenerationModel: "",
				lmStudioCardPolishModel: "",
				generationPresets: [
					{
						id: "basic",
						name: "Basic",
						prompt: "Generate cards",
					},
					{
						id: "custom",
						name: "My Flashcards",
						prompt: "Custom instruction",
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

describe("generateWithPresetGlobal", () => {
	it("runs the caller's preset rather than the default — the panel's picker path", async () => {
		const { plugin, startThread } = createPlugin();
		const file = { path: "Notes/source.md", basename: "source" };

		await generateWithPresetGlobal(
			plugin as never,
			"custom",
			"Whole note body",
			file as never,
		);

		expect(startThread).toHaveBeenCalledWith(
			expect.objectContaining({
				instruction: "Custom instruction",
				presetId: "generation:custom",
				displayMessage: "Generate with My Flashcards",
				context: expect.objectContaining({
					source: { path: "Notes/source.md", text: "Whole note body" },
					applyGeneratedCardsImmediately: true,
				}),
			}),
		);
	});

	it("refuses to enqueue when no AI provider is configured", async () => {
		const { plugin, startThread } = createPlugin();
		plugin.settings.openRouterApiKey = "";

		await generateWithPresetGlobal(
			plugin as never,
			"custom",
			"Whole note body",
			{ path: "Notes/source.md", basename: "source" } as never,
		);

		expect(startThread).not.toHaveBeenCalled();
	});
});
