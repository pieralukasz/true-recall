import { ItemView } from "obsidian";

import { cardPolishWorkflowId } from "@true-recall/core/ai/workflows/ai-workflow";
import { VIEW_TYPE_REVIEW } from "@true-recall/core/constants";

import { readLiveAssistantContext } from "@true-recall/obsidian/features/assistant/ui/useLiveAssistantContext";
import { isPluginEnabled } from "@true-recall/obsidian/plugin/plugin-utils";

import type { PluginContext } from "../types";

/**
 * Card Polish is a preset family, not a surface. The ✨ action in review opens
 * the shared AI workspace in card-polish mode; this plugin only registers the
 * hotkey-bindable command per preset. Everything runs through the assistant task
 * service, so polish results are threads and proposals like every other AI edit.
 */
export class CardPolishPlugin {
	constructor(private readonly ctx: PluginContext) {}

	activate(): void {
		this.syncPresetCommands();
	}

	deactivate(): void {
		// Commands gate on live settings; there is nothing else to unbind.
	}

	syncPresetCommands(): void {
		// One command per preset so each can take a hotkey in Obsidian's native
		// settings. The preset is looked up at invocation time so live edits apply,
		// and the command ids are part of the user's hotkey config — never rename.
		const plugin = this.ctx.obsidianPlugin;
		for (const declared of plugin.settings.cardPolish?.userPresets ?? []) {
			const presetId = declared.id;
			const commandId = `card-polish-${presetId}`;
			if (this.hasCommand(commandId)) continue;
			this.ctx.obsidianPlugin.addCommand({
				id: commandId,
				name: `Polish: ${declared.name}`,
				checkCallback: (checking) => {
					if (!isPluginEnabled(plugin.settings, "card-polish")) {
						return false;
					}
					const activeView = this.ctx.workspace.getActiveViewOfType(ItemView);
					if ((activeView?.getViewType() ?? "") !== VIEW_TYPE_REVIEW) {
						return false;
					}
					const preset = (plugin.settings.cardPolish?.userPresets ?? []).find(
						(candidate) => candidate.id === presetId,
					);
					if (!preset || preset.disabled) return false;
					if (!checking) this.runPreset(preset.prompt, preset.id);
					return true;
				},
			});
		}
	}

	private hasCommand(id: string): boolean {
		const app = this.ctx.app as unknown as {
			commands?: { commands?: Record<string, unknown> };
		};
		const pluginId = this.ctx.obsidianPlugin.manifest.id;
		return app.commands?.commands?.[`${pluginId}:${id}`] !== undefined;
	}

	private runPreset(prompt: string, presetId: string): void {
		const plugin = this.ctx.obsidianPlugin;
		plugin.assistantService?.startThread({
			instruction: prompt,
			presetId: cardPolishWorkflowId(presetId),
			context: readLiveAssistantContext(plugin),
		});
	}
}
