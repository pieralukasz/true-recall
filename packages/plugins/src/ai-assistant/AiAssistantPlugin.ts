import { ItemView } from "obsidian";

import { assistantWorkflowId } from "@true-recall/core/ai/workflows/ai-workflow";
import { VIEW_TYPE_REVIEW } from "@true-recall/core/constants";

import { openAssistantThreadModal } from "@true-recall/obsidian/features/assistant/ui/AskAiModal";
import { readLiveAssistantContext } from "@true-recall/obsidian/features/assistant/ui/useLiveAssistantContext";

import type { PluginContext } from "../types";

export class AiAssistantPlugin {
	constructor(private ctx: PluginContext) {}

	activate(): void {
		this.ctx.obsidianPlugin.assistantService?.start();
		this.registerPresetCommands();
	}

	deactivate(): void {
		// Nothing to unbind: surfaces are opened through openAiWorkspace, which
		// owns its own lifecycle, and the commands below gate on live settings.
	}

	/** One hotkey-bindable command per chip, active in the review view. The
	 * command ids are part of the user's hotkey config — never rename them. */
	private registerPresetCommands(): void {
		for (const declared of this.ctx.settings.assistantPresets ?? []) {
			const presetId = declared.id;
			this.ctx.obsidianPlugin.addCommand({
				id: `ai-assistant-${presetId}`,
				name: `Ask AI: ${declared.name}`,
				checkCallback: (checking) => {
					if (this.ctx.settings.pluginStates?.["ai-assistant"] === false) {
						return false;
					}
					const activeView = this.ctx.workspace.getActiveViewOfType(ItemView);
					if ((activeView?.getViewType() ?? "") !== VIEW_TYPE_REVIEW) {
						return false;
					}
					const preset = (this.ctx.settings.assistantPresets ?? []).find(
						(p) => p.id === presetId,
					);
					if (!preset) return false;
					if (!checking) this.runPreset(preset.instruction, preset.id);
					return true;
				},
			});
		}
	}

	/** Runs straight away — a named preset needs no surface to pick from — and
	 * shows the resulting thread. */
	private runPreset(instruction: string, presetId: string): void {
		const plugin = this.ctx.obsidianPlugin;
		const result = plugin.assistantService?.startThread({
			instruction,
			presetId: assistantWorkflowId(presetId),
			context: readLiveAssistantContext(plugin),
		});
		if (result) openAssistantThreadModal(plugin, result.threadId);
	}
}
