import { ItemView } from "obsidian";

import { cardPolishWorkflowId } from "@true-recall/core/ai/workflows/ai-workflow";
import { VIEW_TYPE_REVIEW } from "@true-recall/core/constants";

import { readLiveAssistantContext } from "@true-recall/obsidian/features/assistant/ui/useLiveAssistantContext";

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
		this.registerReviewCommands();
	}

	deactivate(): void {
		// Commands gate on live settings; there is nothing else to unbind.
	}

	private registerReviewCommands(): void {
		// One command per preset so each can take a hotkey in Obsidian's native
		// settings. The preset is looked up at invocation time so live edits apply,
		// and the command ids are part of the user's hotkey config — never rename.
		for (const declared of this.ctx.settings.cardPolish?.userPresets ?? []) {
			const presetId = declared.id;
			this.ctx.obsidianPlugin.addCommand({
				id: `card-polish-${presetId}`,
				name: `Polish: ${declared.name}`,
				checkCallback: (checking) => {
					if (this.ctx.settings.pluginStates?.["card-polish"] === false) {
						return false;
					}
					const activeView = this.ctx.workspace.getActiveViewOfType(ItemView);
					if ((activeView?.getViewType() ?? "") !== VIEW_TYPE_REVIEW) {
						return false;
					}
					const preset = (this.ctx.settings.cardPolish?.userPresets ?? []).find(
						(candidate) => candidate.id === presetId,
					);
					if (!preset) return false;
					if (!checking) this.runPreset(preset.prompt, preset.id);
					return true;
				},
			});
		}
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
