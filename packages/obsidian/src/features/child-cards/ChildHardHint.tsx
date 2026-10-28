import type { FSRSFlashcardItem } from "@true-recall/core/types";

import { t } from "@true-recall/obsidian/i18n";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";

import { hasHardStreak } from "./child-graduation";

/**
 * Shows above the rating bar, on the question face, when this card keeps coming
 * back as Hard. A hint after the rating would be useless: the session has
 * already moved on by then.
 */
export function ChildHardHint({ card }: { card: FSRSFlashcardItem }) {
	const plugin = usePlugin();
	if (!plugin.settings.childCardsEnabled) return null;

	const streak = plugin.settings.childHardStreak;
	const ratings = plugin.cardStore.stats
		.getCardReviewHistory(card.id, streak)
		.map((entry) => entry.r);
	if (!hasHardStreak(ratings, streak, plugin.settings.childAgainScore))
		return null;

	return (
		<button
			class="tr-child-hard-hint"
			onClick={(event) => plugin.childCardService.openChooser(card, event)}
		>
			{t("Card keeps failing, build a child card")}
		</button>
	);
}
