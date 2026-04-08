import type { CardSchedulingMeta } from "../../types";

function getSiblingKey(card: CardSchedulingMeta): string | null {
	if (card.cardType === "image-occlusion" && card.noteId) {
		return `io:${card.noteId}`;
	}
	if (card.cardType === "cloze" && card.noteId) {
		return `cloze:${card.noteId}`;
	}
	return null;
}

/**
 * When burySiblings is off, spread IO/cloze siblings apart in the
 * queue so cards from the same note don't appear back-to-back.
 */
export function spaceSiblings(
	queue: CardSchedulingMeta[],
): CardSchedulingMeta[] {
	if (queue.length <= 2) return queue;

	const noteGroups = new Map<string, number>();
	const hasMultiple = new Set<string>();

	for (const card of queue) {
		const key = getSiblingKey(card);
		if (!key) continue;
		if (noteGroups.has(key)) {
			hasMultiple.add(key);
		}
		noteGroups.set(key, (noteGroups.get(key) ?? 0) + 1);
	}

	if (hasMultiple.size === 0) return queue;

	const result: CardSchedulingMeta[] = [];
	const deferred: CardSchedulingMeta[] = [];
	const lastSeen = new Map<string, number>();
	const minSpacing = Math.max(
		3,
		Math.ceil(
			queue.length /
				Math.max(...[...hasMultiple].map((k) => noteGroups.get(k) ?? 1)),
		),
	);

	for (const card of queue) {
		const key = getSiblingKey(card);
		if (key && hasMultiple.has(key)) {
			const last = lastSeen.get(key);
			if (last !== undefined && result.length - last < minSpacing) {
				deferred.push(card);
				continue;
			}
			lastSeen.set(key, result.length);
		}
		result.push(card);
	}

	for (const card of deferred) {
		const key = getSiblingKey(card);
		if (!key) continue;
		const last = lastSeen.get(key) ?? -minSpacing;
		const targetPos = Math.min(last + minSpacing, result.length);
		result.splice(targetPos, 0, card);
		lastSeen.set(key, targetPos);
	}

	return result;
}
