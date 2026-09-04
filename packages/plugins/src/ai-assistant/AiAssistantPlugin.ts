import { ItemView } from "obsidian";

import { assistantWorkflowId } from "@true-recall/core/ai/workflows/ai-workflow";
import { VIEW_TYPE_REVIEW } from "@true-recall/core/constants";

import { openAssistantThreadModal } from "@true-recall/obsidian/features/assistant/ui/AskAiModal";
import { readLiveAssistantContext } from "@true-recall/obsidian/features/assistant/ui/useLiveAssistantContext";
import { isPluginEnabled } from "@true-recall/obsidian/plugin/plugin-utils";

import type { PluginContext } from "../types";

export class AiAssistantPlugin {
	constructor(private ctx: PluginContext) {}

	activate(): void {
		this.ctx.obsidianPlugin.assistantService?.start();
		this.syncPresetCommands();
	}

	deactivate(): void {
		// Nothing to unbind: surfaces are opened through openAiWorkspace, which
		// owns its own lifecycle, and the commands below gate on live settings.
	}

	/** One hotkey-bindable command per chip, active in the review view. The
	 * command ids are part of the user's hotkey config — never rename them. */
	syncPresetCommands(): void {
		const plugin = this.ctx.obsidianPlugin;
		for (const declared of plugin.settings.assistantPresets ?? []) {
			const presetId = declared.id;
			const commandId = `ai-assistant-${presetId}`;
			if (this.hasCommand(commandId)) continue;
			this.ctx.obsidianPlugin.addCommand({
				id: commandId,
				name: `Ask AI: ${declared.name}`,
				checkCallback: (checking) => {
					if (!isPluginEnabled(plugin.settings, "ai-assistant")) {
						return false;
					}
					const activeView = this.ctx.workspace.getActiveViewOfType(ItemView);
					if ((activeView?.getViewType() ?? "") !== VIEW_TYPE_REVIEW) {
						return false;
					}
					const preset = (plugin.settings.assistantPresets ?? []).find(
						(p) => p.id === presetId,
					);
					if (!preset) return false;
					if (!checking) this.runPreset(preset.instruction, preset.id);
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
