import { State } from "ts-fsrs";

import type { CardSchedulingMeta } from "@true-recall/core/types";
import type { FSRSCardData } from "@true-recall/core/types/fsrs/card.types";

import type { ActionableSessionSnapshot } from "@true-recall/obsidian/features/study/services/actionable-session-snapshot.service";

export type ProjectCounts = ActionableSessionSnapshot["counts"];

/** Per-source-note lookups built once per aggregation pass. */
export interface ProjectAggregationIndexes {
	allCardsBySourceUid: Map<string, FSRSCardData[]>;
	activeCardsBySourceUid: Map<string, CardSchedulingMeta[]>;
	now: Date;
}

export function buildProjectAggregationIndexes(
	allCards: CardSchedulingMeta[],
	activeCards: CardSchedulingMeta[],
	now: Date,
): ProjectAggregationIndexes {
	return {
		allCardsBySourceUid: buildCardsBySourceUid(allCards),
		activeCardsBySourceUid: buildActiveCardsBySourceUid(activeCards),
		now,
	};
}

function buildCardsBySourceUid(
	cards: CardSchedulingMeta[],
): Map<string, FSRSCardData[]> {
	const map = new Map<string, FSRSCardData[]>();
	for (const card of cards) {
		const uid = card.sourceUid ?? card.fsrs.sourceUid;
		if (!uid) continue;
		const fsrs = card.fsrs.sourceUid
			? card.fsrs
			: { ...card.fsrs, sourceUid: uid };
		const bucket = map.get(uid);
		if (bucket) {
			bucket.push(fsrs);
		} else {
			map.set(uid, [fsrs]);
		}
	}
	return map;
}

function buildActiveCardsBySourceUid(
	cards: CardSchedulingMeta[],
): Map<string, CardSchedulingMeta[]> {
	const map = new Map<string, CardSchedulingMeta[]>();
	for (const card of cards) {
		const uid = card.sourceUid ?? card.fsrs.sourceUid;
		if (!uid) continue;
		const bucket = map.get(uid);
		if (bucket) {
			bucket.push(card);
		} else {
			map.set(uid, [card]);
		}
	}
	return map;
}

export function collectActiveCardsForSources(
	sourceUids: ReadonlySet<string>,
	activeCardsBySourceUid: ReadonlyMap<string, CardSchedulingMeta[]>,
): CardSchedulingMeta[] {
	const collected: CardSchedulingMeta[] = [];
	for (const uid of sourceUids) {
		const cards = activeCardsBySourceUid.get(uid);
		if (!cards || cards.length === 0) continue;
		collected.push(...cards);
	}
	return collected;
}

/**
 * Counts without any session logic (no daily limits, no ordering). Used for
 * archived projects, which never start a session.
 */
export function computeRawCounts(
	sourceUids: ReadonlySet<string>,
	allCardsBySourceUid: ReadonlyMap<string, FSRSCardData[]>,
	now: Date,
): ProjectCounts {
	const counts: ProjectCounts = {
		new: 0,
		learning: 0,
		learningPending: 0,
		due: 0,
	};
	for (const uid of sourceUids) {
		const cards = allCardsBySourceUid.get(uid);
		if (!cards) continue;
		for (const card of cards) {
			if (card.suspended) continue;
			if (card.buriedUntil && new Date(card.buriedUntil) > now) continue;
			tallyCard(counts, card, now);
		}
	}
	return counts;
}

function tallyCard(counts: ProjectCounts, card: FSRSCardData, now: Date): void {
	switch (card.state) {
		case State.New:
			counts.new++;
			break;
		case State.Learning:
		case State.Relearning:
			if (new Date(card.due) <= now) counts.learning++;
			else counts.learningPending++;
			break;
		case State.Review:
			if (new Date(card.due) <= now) counts.due++;
			break;
	}
}
