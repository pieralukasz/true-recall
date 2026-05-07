import { State } from "ts-fsrs";

import type { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import type { HierarchyService } from "@true-recall/core/services/notes/hierarchy.service";
import type { FSRSCardData } from "@true-recall/core/types/fsrs/card.types";
import type { CardStore } from "@true-recall/core/types/fsrs/store.types";

import { FSRS_COLORS } from "@true-recall/obsidian/helpers/fsrs-colors";

export interface ProjectStats {
	name: string;
	path: string;
	totalCards: number;
	due: number;
	newCount: number;
	learning: number;
	healthPct: number;
	childCount: number;
	lastReviewed: string | null;
}

interface ProjectStatsContext {
	sourceUids?: ReadonlySet<string>;
	cardsBySourceUid?: ReadonlyMap<string, FSRSCardData[]>;
	retrievabilityByCardId?: ReadonlyMap<string, number>;
	now?: Date;
	skipHealthPct?: boolean;
}

export function computeProjectStats(
	projectPath: string,
	projectName: string,
	childCount: number,
	hierarchyService: HierarchyService,
	cardStore: CardStore,
	fsrsService: FSRSService,
	context?: ProjectStatsContext,
): ProjectStats {
	const sourceUids =
		context?.sourceUids ??
		hierarchyService.getSourceUidsForProject(projectPath);

	const now = context?.now ?? new Date();
	const skipHealthPct = context?.skipHealthPct === true;
	let totalCards = 0;
	let due = 0;
	let newCount = 0;
	let learning = 0;
	let retrievabilitySum = 0;
	let reviewCardCount = 0;
	let lastReviewed: string | null = null;

	for (const uid of sourceUids) {
		const cards =
			context?.cardsBySourceUid?.get(uid) ??
			cardStore.getCardsBySourceUid?.(uid) ??
			[];
		for (const card of cards) {
			totalCards++;

			if (card.suspended) continue;
			if (card.buriedUntil && new Date(card.buriedUntil) > now) continue;

			switch (card.state) {
				case State.New:
					newCount++;
					break;
				case State.Learning:
				case State.Relearning:
					learning++;
					break;
				case State.Review:
					if (new Date(card.due) <= now) due++;
					break;
			}

			// Health: avg retrievability of non-new cards (skipped when caller
			// doesn't render it — saves a per-card FSRS call per project row).
			if (!skipHealthPct && card.state !== State.New) {
				const cachedRetrievability = context?.retrievabilityByCardId?.get(
					card.id,
				);
				retrievabilitySum +=
					cachedRetrievability ?? fsrsService.getRetrievability(card, now);
				reviewCardCount++;
			}

			if (
				card.lastReview &&
				(!lastReviewed || card.lastReview > lastReviewed)
			) {
				lastReviewed = card.lastReview;
			}
		}
	}

	const healthPct =
		reviewCardCount > 0
			? Math.round((retrievabilitySum / reviewCardCount) * 100)
			: 0;

	return {
		name: projectName,
		path: projectPath,
		totalCards,
		due,
		newCount,
		learning,
		healthPct,
		childCount,
		lastReviewed,
	};
}

export function healthColor(pct: number): string {
	if (pct >= 80) return `var(${FSRS_COLORS.new.cssVar})`;
	if (pct >= 50) return `var(${FSRS_COLORS.learning.cssVar})`;
	return `var(${FSRS_COLORS.suspended.cssVar})`;
}
