import { TFile } from "obsidian";

import type { AssistantContext } from "@true-recall/core/ai/assistant";

import type TrueRecallPlugin from "@true-recall/obsidian/main";

export function resolveAssistantSourceFile(
	plugin: TrueRecallPlugin,
	context: AssistantContext,
): TFile | null {
	const path =
		context.source?.path ??
		context.card?.sourceNotePath ??
		context.draftCard?.sourceNotePath ??
		context.activeNotePath;
	if (!path) return null;
	const file = plugin.app.vault.getAbstractFileByPath(path);
	return file instanceof TFile ? file : null;
}
