import { describe, expect, it, vi } from "vitest";

import { generateWithPreset } from "@true-recall/obsidian/plugin/SelectionActions";

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
