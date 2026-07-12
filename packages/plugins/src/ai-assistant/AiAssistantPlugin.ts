import { ItemView } from "obsidian";

import type { AssistantContext } from "@true-recall/core/ai/assistant";
import { VIEW_TYPE_REVIEW } from "@true-recall/core/constants";

import { openAskAiModal } from "@true-recall/obsidian/features/assistant/ui/AskAiModal";

import type { PluginContext } from "../types";

export class AiAssistantPlugin {
	private listener: ((e: Event) => void) | null = null;

	constructor(private ctx: PluginContext) {}

	activate(): void {
		this.listener = (e: Event) => {
			const detail = (e as CustomEvent<{ context: AssistantContext }>).detail;
			if (!detail) return;
			openAskAiModal(this.ctx.obsidianPlugin, detail.context);
		};
		window.addEventListener("true-recall:ask-ai", this.listener);

		this.ctx.obsidianPlugin.assistantService?.start();
		this.registerPresetCommands();
	}

	deactivate(): void {
		if (this.listener) {
			window.removeEventListener("true-recall:ask-ai", this.listener);
		}
		this.listener = null;
	}

	/** One hotkey-bindable command per chip, active in the review view. */
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
					if (!checking) {
						window.dispatchEvent(
							new CustomEvent("true-recall:ask-ai-preset", {
								detail: {
									instruction: preset.instruction,
									presetId: preset.id,
								},
							}),
						);
					}
					return true;
				},
			});
		}
	}
}
