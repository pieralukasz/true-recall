import type { TFile } from "obsidian";

import type { GenerationPreset } from "@true-recall/core/types/generation-preset.types";

import type TrueRecallPlugin from "../main";

const SOURCE_NOTE_CHAR_LIMIT = 4000;

/**
 * Collect source note content and/or related cards for AI generation context,
 * based on the preset's `includeSourceNote` / `includeRelatedCards` flags.
 * Returns a pre-formatted text block to inject into the system prompt, or
 * undefined when no context collection is needed.
 */
export async function collectGenerationContext(
	plugin: TrueRecallPlugin,
	preset: GenerationPreset,
	file: TFile,
): Promise<string | undefined> {
	if (!preset.includeSourceNote && !preset.includeRelatedCards)
		return undefined;

	const parts: string[] = [];

	if (preset.includeSourceNote) {
		try {
			const content = await plugin.app.vault.cachedRead(file);
			if (content.trim()) {
				const truncated = content.slice(0, SOURCE_NOTE_CHAR_LIMIT);
				const suffix = content.length > SOURCE_NOTE_CHAR_LIMIT ? "\n…" : "";
				parts.push(`Source note (${file.path}):\n${truncated}${suffix}`);
			}
		} catch (error) {
			console.warn("[GenerationContext] Failed to read source note:", error);
		}
	}

	if (preset.includeRelatedCards) {
		try {
			const fmService = plugin.flashcardManager.getFrontmatterService();
			const sourceUid = await fmService.getSourceNoteUid(file.path);
			if (sourceUid) {
				const cards = plugin.cardStore?.cards.getCardsBySourceUid(sourceUid);
				if (cards && cards.length > 0) {
					const rendered = cards
						.filter((c) => c.question || c.answer)
						.slice(0, 10)
						.map(
							(c, i) => `#${i + 1}\n  ${c.question ?? ""}\n  ${c.answer ?? ""}`,
						)
						.join("\n\n");
					parts.push(
						`Related flashcards (for style and terminology reference only; do not copy):\n${rendered}`,
					);
				}
			}
		} catch (error) {
			console.warn(
				"[GenerationContext] Failed to collect related cards:",
				error,
			);
		}
	}

	return parts.length > 0 ? parts.join("\n\n") : undefined;
}
