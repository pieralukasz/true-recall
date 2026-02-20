import type { FlashcardItem } from "../../../../shared/types";

export type PanelItem =
	| { type: "basic"; card: FlashcardItem }
	| { type: "cloze-group"; template: string; cards: FlashcardItem[] }
	| { type: "reverse-group"; original: FlashcardItem; reversed: FlashcardItem };

export function groupCards(cards: FlashcardItem[]): PanelItem[] {
	const result: PanelItem[] = [];
	const processedIds = new Set<string>();

	// Index cloze cards by template
	const clozeGroups = new Map<string, FlashcardItem[]>();
	for (const card of cards) {
		if (card.cardType === "cloze" && card.clozeTemplate) {
			const group = clozeGroups.get(card.clozeTemplate);
			if (group) {
				group.push(card);
			} else {
				clozeGroups.set(card.clozeTemplate, [card]);
			}
			processedIds.add(card.id);
		}
	}

	// Index reversed cards: reverseOfBatchId points to original card's id
	const reverseByOriginalId = new Map<string, FlashcardItem>();
	for (const card of cards) {
		if (card.cardType === "reversed" && card.reverseOfBatchId) {
			reverseByOriginalId.set(card.reverseOfBatchId, card);
			processedIds.add(card.id);
		}
	}

	// Track which cloze templates and reverse originals have been emitted
	const emittedClozeTemplates = new Set<string>();
	const emittedReverseOriginals = new Set<string>();

	for (const card of cards) {
		// Cloze card: emit group on first encounter
		if (card.cardType === "cloze" && card.clozeTemplate) {
			if (!emittedClozeTemplates.has(card.clozeTemplate)) {
				emittedClozeTemplates.add(card.clozeTemplate);
				const group = clozeGroups.get(card.clozeTemplate);
				if (group) {
					result.push({
						type: "cloze-group",
						template: card.clozeTemplate,
						cards: group,
					});
				}
			}
			continue;
		}

		// Reversed card: skip, will be emitted as part of reverse-group
		if (card.cardType === "reversed" && card.reverseOfBatchId) {
			continue;
		}

		// Original card that has a reverse pair
		const reversed = reverseByOriginalId.get(card.id);
		if (reversed) {
			if (!emittedReverseOriginals.has(card.id)) {
				emittedReverseOriginals.add(card.id);
				processedIds.add(card.id);
				result.push({ type: "reverse-group", original: card, reversed });
			}
			continue;
		}

		// Basic card (not part of any group)
		if (!processedIds.has(card.id)) {
			result.push({ type: "basic", card });
		}
	}

	return result;
}
