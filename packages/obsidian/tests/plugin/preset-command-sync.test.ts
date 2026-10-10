import { describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS } from "@true-recall/core/constants";

import { AiAssistantPlugin } from "@true-recall/plugins/ai-assistant/AiAssistantPlugin";
import { CardPolishPlugin } from "@true-recall/plugins/card-polish/CardPolishPlugin";
import type { PluginContext } from "@true-recall/plugins/types";

function createContext() {
	const commands: Record<string, unknown> = {};
	const addCommand = vi.fn((command: { id: string }) => {
		commands[`true-recall:${command.id}`] = command;
	});
	const settings = {
		...DEFAULT_SETTINGS,
		assistantPresets: [
			{ id: "explain", name: "Explain", instruction: "Explain this" },
		],
		cardPolish: {
			customPromptAutoApply: false,
			userPresets: [
				{
					id: "concise",
					name: "Make concise",
					prompt: "Shorten this",
					autoApply: false,
					builtin: false,
				},
			],
		},
	};
	const context = {
		settings,
		app: { commands: { commands } },
		workspace: {},
		obsidianPlugin: {
			manifest: { id: "true-recall" },
			settings,
			addCommand,
		},
	} as unknown as PluginContext;

	return { context, addCommand };
}

describe("preset command synchronization", () => {
	it("does not re-register an existing Assistant preset command", () => {
		const { context, addCommand } = createContext();

		new AiAssistantPlugin(context).syncPresetCommands();
		new AiAssistantPlugin(context).syncPresetCommands();

		expect(addCommand).toHaveBeenCalledTimes(1);
	});

	it("does not re-register an existing Card Polish preset command", () => {
		const { context, addCommand } = createContext();

		new CardPolishPlugin(context).syncPresetCommands();
		const registered = addCommand.mock.calls.length;
		new CardPolishPlugin(context).syncPresetCommands();

		// One command per user preset plus the free built-in "Clean".
		expect(registered).toBe(2);
		expect(addCommand).toHaveBeenCalledTimes(2);
	});
});
