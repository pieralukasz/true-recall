import type { App } from "obsidian";

import type { FlashcardManager } from "@true-recall/core/flashcard/flashcard.service";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite";
import type { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import type { ReviewService } from "@true-recall/core/services/review/review.service";
import type { TrueRecallSettings } from "@true-recall/core/types";

import type { CommandService } from "@true-recall/obsidian/commands";
import type TrueRecallPlugin from "@true-recall/obsidian/main";
import type { ReviewApi } from "@true-recall/obsidian/store";

export interface CardActionsHandlerDeps {
	app: App;
	getReview: () => ReviewApi;
	flashcardManager: FlashcardManager;
	fsrsService: FSRSService;
	reviewService: ReviewService;
	cardStore: SqliteStoreService;
	settings: TrueRecallSettings;
	plugin: TrueRecallPlugin;
	commandService?: CommandService | null;
}

export interface CardActionsCallbacks {
	onUpdateSchedulingPreview: () => void;
}

export class CardActionContext {
	constructor(
		readonly deps: CardActionsHandlerDeps,
		private callbacks: CardActionsCallbacks,
	) {}

	get commandService(): CommandService | null {
		return this.deps.commandService ?? this.deps.plugin.commandService ?? null;
	}

	// ── Private helpers ─────────────────────────────────

	refreshIfActive(): void {
		if (!this.deps.getReview().isComplete()) {
			this.callbacks.onUpdateSchedulingPreview();
		}
	}

	removeFromTemporaryDeck(cardIds: readonly string[]): void {
		if (typeof this.deps.plugin.removeCardsFromTemporaryDeck !== "function") {
			return;
		}
		const review = this.deps.getReview();
		const deckId =
			typeof review.getSessionFilters === "function"
				? review.getSessionFilters().temporaryDeckId
				: review.sessionFilters?.temporaryDeckId;
		this.deps.plugin.removeCardsFromTemporaryDeck(deckId, cardIds);
	}
}
