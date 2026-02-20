import type { ReadonlySignal } from "@preact/signals";
import { effect } from "@preact/signals-core";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { track } from "@shared/services/signals";
import type { OrphanedCardGroup } from "@features/library/services/orphaned-cards.service";
import { usePlugin } from "@shared/ui/preact";

function useOrphanedCards() {
	const plugin = usePlugin();

	const load = useCallback((): OrphanedCardGroup[] => {
		if (
			!plugin.orphanedCardsService ||
			!plugin.cardStore ||
			!plugin.frontmatterIndex
		) {
			return [];
		}
		const orphans = plugin.orphanedCardsService.getOrphanedCardsExtended(
			plugin.cardStore,
			plugin.frontmatterIndex,
		);
		return plugin.orphanedCardsService.groupOrphanedCards(orphans);
	}, [plugin]);

	return load;
}

export interface OrphanedData {
	groups: OrphanedCardGroup[];
	totalCount: number;
	moveTarget: OrphanedCardGroup | null;
	searchQuery: string;
	setMoveTarget: (group: OrphanedCardGroup | null) => void;
	setSearchQuery: (query: string) => void;
	refresh: () => void;
}

export function useOrphanedData(
	refreshSignal?: ReadonlySignal<number>,
): OrphanedData {
	const loadGroups = useOrphanedCards();

	const [groups, setGroups] = useState<OrphanedCardGroup[]>(() => loadGroups());
	const [moveTarget, setMoveTarget] = useState<OrphanedCardGroup | null>(null);
	const [searchQuery, setSearchQuery] = useState("");

	const totalCount = useMemo(
		() => groups.reduce((sum, g) => sum + g.cards.length, 0),
		[groups],
	);

	const refresh = useCallback(() => {
		setGroups(loadGroups());
		setMoveTarget(null);
		setSearchQuery("");
	}, [loadGroups]);

	// External refresh trigger (e.g. native header action button)
	useEffect(() => {
		if (!refreshSignal) return;
		const dispose = effect(() => {
			track(refreshSignal);
			refresh();
		});
		return dispose;
	}, [refreshSignal, refresh]);

	return {
		groups,
		totalCount,
		moveTarget,
		searchQuery,
		setMoveTarget,
		setSearchQuery,
		refresh,
	};
}
