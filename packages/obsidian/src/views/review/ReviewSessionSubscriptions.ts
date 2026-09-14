import { effect } from "@preact/signals";

import { applyMutation } from "@true-recall/obsidian/features/study/ui/review/helpers";
import type { SessionFilters } from "@true-recall/obsidian/features/study/ui/review/review.types";
import {
	lastMutation,
	reviewSessionCardGraded,
} from "@true-recall/obsidian/services/signals";
import type { ReviewApi } from "@true-recall/obsidian/store";

import type TrueRecallPlugin from "../../main";

export class ReviewSessionSubscriptions {
	private sessionSignalDisposer: (() => void) | null = null;
	private reviewSyncDisposer: (() => void) | null = null;
	constructor(
		private plugin: TrueRecallPlugin,
		private getReview: () => ReviewApi,
		private getFilters: () => SessionFilters,
		private sessionId: string,
	) {}
	private get review() {
		return this.getReview();
	}
	private get filters() {
		return this.getFilters();
	}

	// ─── Signal-based mutation handling ──────────────────────────────────

	subscribeToSessionEvents(): void {
		this.unsubscribeFromSessionEvents();

		// preact-signals runs the effect callback immediately on creation, and
		// lastMutation is never cleared — without this guard every new session
		// would re-apply the last pre-session mutation to the fresh queue
		// (e.g. force-adding a card past the daily new limit).
		let isSubscribing = true;
		this.sessionSignalDisposer = effect(() => {
			const m = lastMutation.value;
			if (isSubscribing) {
				isSubscribing = false;
				return;
			}
			if (!m) return;
			// Targeted mutation handling instead of full session rebuild.
			// rebuildActiveSession() recomputes cachedBadgeCounts from scratch,
			// which can drift from the incremental counts maintained by
			// recordAnswerAndNext() (e.g. New count appearing to increase
			// when a Learning card is graded).
			const resolvedProjectUids = this.filters.projectPath
				? this.plugin.hierarchyService.getSourceUidsForProject(
						this.filters.projectPath,
					)
				: undefined;
			applyMutation(
				m,
				this.review,
				this.plugin.flashcardManager,
				this.plugin.cardStore,
				this.filters,
				resolvedProjectUids,
			);
		});

		let isReviewSyncSubscribing = true;
		this.reviewSyncDisposer = effect(() => {
			const event = reviewSessionCardGraded.value;
			if (isReviewSyncSubscribing) {
				isReviewSyncSubscribing = false;
				return;
			}
			if (!event || event.sourceSessionId === this.sessionId) return;
			this.review.removeCardsByIds([event.cardId]);
		});
	}

	unsubscribeFromSessionEvents(): void {
		this.sessionSignalDisposer?.();
		this.sessionSignalDisposer = null;
		this.reviewSyncDisposer?.();
		this.reviewSyncDisposer = null;
	}
}
