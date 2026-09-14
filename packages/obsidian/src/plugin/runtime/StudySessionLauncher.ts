import type { TFile } from "obsidian";

import { VIEW_TYPE_REVIEW } from "@true-recall/core/constants";
import { SessionService } from "@true-recall/core/services/review/session.service";
import type { SessionConfig } from "@true-recall/core/types/session-config.types";

import { ObsidianNoteResolver } from "@true-recall/obsidian/adapters/ObsidianNoteResolver";
import {
	createReviewSessionKey,
	createReviewSessionLabel,
} from "@true-recall/obsidian/features/study/services/review-session-key";
import {
	filtersToViewState,
	normalizeSessionFilters,
	type SessionFilters,
} from "@true-recall/obsidian/features/study/ui/review/review.types";
import type TrueRecallPlugin from "@true-recall/obsidian/main";
import {
	activateReviewView,
	revealReviewView,
} from "@true-recall/obsidian/plugin/ViewActivator";
import { notify } from "@true-recall/obsidian/services/notification.service";

export class StudySessionLauncher {
	private sessionService = new SessionService();
	constructor(private plugin: TrueRecallPlugin) {}

	async startReview(config: SessionConfig): Promise<void> {
		if (!this.plugin.isStoreReady()) {
			notify().error(
				"Database not ready. Please wait for plugin to fully load.",
			);
			return;
		}

		const allCards = this.plugin.flashcardManager.getAllFSRSCards();
		const archivedSourceUids =
			this.plugin.hierarchyService.getArchivedSourceUids();
		const sessionKey = createReviewSessionKey(config, allCards);
		const customDeckName =
			config.mode === "custom" && config.temporaryDeckId
				? this.plugin.settings.temporaryCustomStudyDecks.find(
						(deck) => deck.id === config.temporaryDeckId,
					)?.name
				: undefined;
		const sessionLabel = createReviewSessionLabel(config, allCards, {
			customDeckName,
		});
		const sessionSettings = {
			ignoreDailyLimitsForNoteStudy:
				this.plugin.settings.ignoreDailyLimitsForNoteStudy,
			dayStartHour: this.plugin.settings.dayStartHour,
			rModeEnabled: this.plugin.settings.rMode.enabled,
		};
		const requestedFilters = normalizeSessionFilters(
			this.sessionService.resolveFilters(config, sessionSettings),
		);
		const existingLeaf = revealReviewView(this.plugin.app, VIEW_TYPE_REVIEW, {
			...filtersToViewState(requestedFilters),
			sessionKey,
			sessionLabel,
		});
		if (existingLeaf) return;

		const result = this.sessionService.validate(
			config,
			{
				allCards,
				archivedSourceUids,
				settings: this.plugin.settings,
				sessionPersistence: this.plugin.sessionPersistence,
				presetService: this.plugin.presetService,
				noteResolver: new ObsidianNoteResolver(this.plugin.app),
				hierarchyService: this.plugin.hierarchyService,
				fsrsService: this.plugin.fsrsService,
			},
			sessionSettings,
		);

		if (!result.valid) {
			if (result.message) notify().info(result.message);
			return;
		}

		await this.openReviewViewWithFilters(result.filters, {
			sessionKey,
			sessionLabel,
		});
	}

	async reviewCurrentNote(): Promise<void> {
		if (!this.plugin.isStoreReady()) {
			notify().error(
				"Database not ready. Please wait for plugin to fully load.",
			);
			return;
		}
		const file = this.plugin.app.workspace.getActiveFile();
		if (!file) {
			notify().noActiveFile();
			return;
		}
		await this.reviewNoteFlashcards(file);
	}

	async reviewNoteFlashcards(
		file: TFile,
		rModeTargetCount?: number,
	): Promise<void> {
		const sourceUid = await this.plugin.flashcardManager
			.getFrontmatterService()
			.getSourceNoteUid(file.path);
		if (!sourceUid) {
			notify().info(`No flashcards found for "${file.basename}"`);
			return;
		}
		await this.startReview({ mode: "note", sourceUid, rModeTargetCount });
	}

	async reviewTodaysCards(): Promise<void> {
		await this.startReview({ mode: "created_today" });
	}

	async openReviewViewWithFilters(
		rawFilters: SessionFilters,
		session: { sessionKey?: string; sessionLabel?: string } = {},
	): Promise<void> {
		const filters = normalizeSessionFilters(rawFilters);
		const state = { ...filtersToViewState(filters), ...session };

		await activateReviewView(
			this.plugin.app,
			VIEW_TYPE_REVIEW,
			this.plugin.settings.reviewMode,
			state,
		);
	}
}
