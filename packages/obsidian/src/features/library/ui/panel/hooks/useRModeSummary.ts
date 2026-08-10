import { useMemo } from "preact/hooks";
import { State } from "ts-fsrs";

import {
	type RetrievabilitySummary,
	summarizeRetrievability,
} from "@true-recall/core/services";

import { usePanelStore } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelStore";
import { usePlugin } from "@true-recall/obsidian/preact";

export interface RModeBands {
	ceiling: number;
	comfortFloor: number;
	urgentBelow: number;
}

/**
 * Retrievability breakdown for the cards of the note currently in the panel.
 *
 * Recomputed from the panel's card list rather than cached, because R moves
 * continuously — a stale snapshot would show a pool that no longer exists.
 */
export function useRModeSummary(): {
	summary: RetrievabilitySummary;
	bands: RModeBands;
} {
	const plugin = usePlugin();
	const { cardsWithFsrs } = usePanelStore();

	const { rMode, fsrsRequestRetention } = plugin.settings;

	return useMemo(() => {
		const bands: RModeBands = {
			ceiling: Math.min(0.999, fsrsRequestRetention + rMode.ceilingOffset),
			comfortFloor: fsrsRequestRetention,
			urgentBelow: rMode.urgentBelow,
		};

		const reviewCards = cardsWithFsrs.filter(
			(card) => card.fsrs.state === State.Review,
		);

		return {
			summary: summarizeRetrievability(reviewCards, plugin.fsrsService, bands),
			bands,
		};
	}, [
		cardsWithFsrs,
		plugin.fsrsService,
		fsrsRequestRetention,
		rMode.ceilingOffset,
		rMode.urgentBelow,
	]);
}
