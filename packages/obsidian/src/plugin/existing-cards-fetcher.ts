import type { TFile } from "obsidian";

import type { ExistingCardContext } from "@true-recall/core/ai/prompts/existing-cards-block";

import type TrueRecallPlugin from "../main";

/**
 * Fetch existing flashcards for a note by its sourceUid.
 * Returns an empty array when the note has no sourceUid or any error occurs —
 * generation must degrade gracefully if enrichment fails.
 * Sorted most-recent first so downstream truncation drops the oldest.
 */
export async function fetchExistingCardsForFile(
	plugin: TrueRecallPlugin,
	file: TFile,
): Promise<ExistingCardContext[]> {
	try {
		const fmService = plugin.flashcardManager.getFrontmatterService();
		const sourceUid = await fmService.getSourceNoteUid(file.path);
		if (!sourceUid) return [];

		const cards = plugin.cardStore.cards.getCardsBySourceUid(sourceUid);
		const sorted = [...cards].sort(
			(a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
		);
		return sorted
			.filter((c) => c.question && c.answer)
			.map((c) => ({
				id: c.id,
				question: c.question as string,
				answer: c.answer as string,
			}));
	} catch (error) {
		console.warn(
			"[ExistingCardsFetcher] Failed to fetch existing cards for note:",
			error,
		);
		return [];
	}
}
