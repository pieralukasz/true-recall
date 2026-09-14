import type { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import {
	type CardSchedulingMeta,
	extractFSRSSettings,
	type FSRSFlashcardItem,
	type ReviewSessionTopUp,
	type ReviewSessionTopUpAvailability,
} from "@true-recall/core/types";

import type { CommandService } from "@true-recall/obsidian/commands";
import { Q } from "@true-recall/obsidian/data";
import type { ReviewSessionController } from "@true-recall/obsidian/features/study/services/ReviewSessionController";
import { getEmptyQueueMessage } from "@true-recall/obsidian/features/study/ui/review/helpers";
import type { SessionFilters } from "@true-recall/obsidian/features/study/ui/review/review.types";
import { notify } from "@true-recall/obsidian/services/notification.service";
import type { ReviewApi } from "@true-recall/obsidian/store";

import type TrueRecallPlugin from "../../main";

export interface ReviewSessionOrchestratorDeps {
	plugin: TrueRecallPlugin;
	controller: ReviewSessionController;
	fsrsService: FSRSService;
	commandService: CommandService;
	getReview: () => ReviewApi;
	getFilters: () => SessionFilters;
	setFilters: (filters: SessionFilters) => void;
	cachePresets: (queue: FSRSFlashcardItem[]) => void;
	onSessionStarted: () => void;
	onCardChanged: () => void;
}
export type PreparedReviewSession = {
	queue: FSRSFlashcardItem[];
	message?: string;
};
export class ReviewSessionOrchestrator {
	constructor(private deps: ReviewSessionOrchestratorDeps) {}
	private get filters() {
		return this.deps.getFilters();
	}
	private set filters(filters: SessionFilters) {
		this.deps.setFilters(filters);
	}
	private get review() {
		return this.deps.getReview();
	}

	prepare(): PreparedReviewSession {
		const { plugin, controller, fsrsService } = this.deps;
		fsrsService.updateSettings(extractFSRSSettings(plugin.settings));
		const { queue } = controller.buildSession(this.filters);
		const meta = plugin.dataLayer?.get<Map<string, CardSchedulingMeta>>(
			Q.ALL_META,
		);
		const allCards = meta
			? [...meta.values()]
			: plugin.cardStore.getAllSchedulingMeta();
		if (queue.length === 0 && allCards.length === 0)
			return {
				queue,
				message: "No flashcards found. Generate some flashcards first!",
			};
		const now = new Date();
		const hasAnyActive = allCards.some(
			(card) =>
				!(
					card.fsrs.suspended ||
					(card.fsrs.buriedUntil && new Date(card.fsrs.buriedUntil) > now)
				),
		);
		if (!hasAnyActive && queue.length === 0)
			return {
				queue,
				message:
					this.filters.stateFilter === "buried"
						? "No buried cards found."
						: "All cards are suspended or buried. Unsuspend/unbury some cards to start reviewing.",
			};
		if (queue.length === 0)
			return {
				queue,
				message: getEmptyQueueMessage(
					this.filters.stateFilter,
					this.filters.schedulingMode === "retrievability",
				),
			};
		return { queue };
	}

	start(queue: FSRSFlashcardItem[]): void {
		this.deps.cachePresets(queue);
		this.review.setSessionFilters(this.filters);
		this.review.startSession(queue);
		this.deps.onSessionStarted();
		this.deps.onCardChanged();
	}

	async finish(): Promise<void> {
		this.deps.commandService.clearByType(
			"review:answer",
			"review:bury",
			"review:suspend",
			"review:forget",
		);
		await this.deps.plugin.cardStore?.flush();
	}

	getTopUpAvailability(): ReviewSessionTopUpAvailability {
		if (this.filters.schedulingMode !== "retrievability") {
			return { review: 0, new: 0 };
		}
		return this.deps.controller.getTopUpAvailability(this.filters);
	}

	async handleTopUp(topUp: ReviewSessionTopUp): Promise<boolean> {
		if (this.filters.schedulingMode !== "retrievability") return false;
		if (!Number.isFinite(topUp.count)) return false;

		try {
			const normalizedTopUp: ReviewSessionTopUp = {
				...topUp,
				count: Math.max(0, Math.floor(topUp.count)),
			};
			if (normalizedTopUp.count === 0) return false;

			const { queue } = this.deps.controller.buildTopUpSession(
				this.filters,
				normalizedTopUp,
			);
			if (queue.length === 0) {
				notify().info(
					`No ${normalizedTopUp.kind} cards are available for Top Up.`,
				);
				return false;
			}

			this.deps.cachePresets(queue);

			if (this.review.getPhase().type === "waiting") {
				const addedCount = this.review.addCardsToCurrentSession(queue);
				if (addedCount === 0) {
					notify().info("Those cards are already in the current session.");
					return false;
				}
			} else {
				this.filters = { ...this.filters, topUp: normalizedTopUp };
				this.review.setSessionFilters(this.filters);
				this.review.startSession(queue);
			}

			this.deps.commandService.clearByType(
				"review:answer",
				"review:bury",
				"review:suspend",
				"review:forget",
			);

			this.deps.onCardChanged();
			return true;
		} catch (error) {
			notify().operationFailed("start Top Up", error);
			return false;
		}
	}
}
