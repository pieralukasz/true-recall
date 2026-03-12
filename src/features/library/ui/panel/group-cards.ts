import type { FlashcardItem } from "@shared/types";
import type { FSRSFlashcardItem } from "@shared/types/fsrs/card.types";

export type PanelItem =
	| { type: "card"; card: FlashcardItem }
	| {
			type: "io-group";
			cards: FlashcardItem[];
			fsrsCards: FSRSFlashcardItem[];
	  };

/**
 * Groups IO cards sharing the same image into a single panel entry.
 * Non-IO cards pass through as individual items.
 */
export function groupCards(
	cards: FlashcardItem[],
	fsrsMap: Map<string, FSRSFlashcardItem>,
): PanelItem[] {
	const items: PanelItem[] = [];
	const ioGroups = new Map<
		string,
		{ cards: FlashcardItem[]; fsrsCards: FSRSFlashcardItem[] }
	>();
	const consumedIds = new Set<string>();

	for (const card of cards) {
		const fsrs = fsrsMap.get(card.id);
		if (
			fsrs?.cardType === "image-occlusion" &&
			fsrs.ioImagePath &&
			fsrs.ioRegionsJson
		) {
			const key = fsrs.ioImagePath;
			let group = ioGroups.get(key);
			if (!group) {
				group = { cards: [], fsrsCards: [] };
				ioGroups.set(key, group);
			}
			group.cards.push(card);
			group.fsrsCards.push(fsrs);
			consumedIds.add(card.id);
		}
	}

	for (const card of cards) {
		if (consumedIds.has(card.id)) {
			const fsrs = fsrsMap.get(card.id);
			if (!fsrs) continue;
			if (!fsrs.ioImagePath) continue;
			const key = fsrs.ioImagePath;
			const group = ioGroups.get(key);
			if (group) {
				group.fsrsCards.sort(
					(a, b) => (a.templateOrd ?? 0) - (b.templateOrd ?? 0),
				);
				items.push({ type: "io-group", ...group });
				ioGroups.delete(key);
			}
		} else {
			items.push({ type: "card", card });
		}
	}

	return items;
}
