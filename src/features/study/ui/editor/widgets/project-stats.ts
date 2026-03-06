import type { FSRSService } from "@features/core/services/fsrs.service";
import type { HierarchyService } from "@features/core/services/hierarchy.service";
import type { CardStore } from "@shared/types/fsrs/store.types";
import { FSRS_COLORS } from "@shared/ui/helpers/fsrs-colors";
import { State } from "ts-fsrs";

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

export function computeProjectStats(
	projectPath: string,
	projectName: string,
	childCount: number,
	hierarchyService: HierarchyService,
	cardStore: CardStore,
	fsrsService: FSRSService,
): ProjectStats {
	const sourceUids = hierarchyService.getSourceUidsForProject(projectPath);

	const now = new Date();
	let totalCards = 0;
	let due = 0;
	let newCount = 0;
	let learning = 0;
	let retrievabilitySum = 0;
	let reviewCardCount = 0;
	let lastReviewed: string | null = null;

	for (const uid of sourceUids) {
		const cards = cardStore.getCardsBySourceUid?.(uid) ?? [];
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

			// Health: avg retrievability of non-new cards
			if (card.state !== State.New) {
				retrievabilitySum += fsrsService.getRetrievability(card, now);
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
