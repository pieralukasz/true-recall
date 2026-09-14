import { SessionService } from "@true-recall/core/services/review/session.service";
import type {
	CardSchedulingMeta,
	SessionResult,
	TemporaryCustomStudyDeck,
} from "@true-recall/core/types";
import type { SessionConfig } from "@true-recall/core/types/session-config.types";

import { ObsidianNoteResolver } from "@true-recall/obsidian/adapters/ObsidianNoteResolver";
import { Q } from "@true-recall/obsidian/data/queries";
import type TrueRecallPlugin from "@true-recall/obsidian/main";
import {
	CustomStudyModal,
	type CustomStudyModalScope,
} from "@true-recall/obsidian/modals/study/CustomStudyModal";
import { notify } from "@true-recall/obsidian/services/notification.service";

export class TemporaryStudyDeckService {
	private sessionService = new SessionService();
	constructor(private plugin: TrueRecallPlugin) {}

	private getCustomStudySessionConfig(
		result: SessionResult,
		temporaryDeckId?: string,
	): Extract<SessionConfig, { mode: "custom" }> {
		return {
			mode: "custom",
			projectPath: result.projectPath,
			sourceNoteFilter: result.sourceNoteFilter,
			sourceNoteFilters: result.sourceNoteFilters,
			filePathFilter: result.filePathFilter,
			createdTodayOnly: result.createdTodayOnly,
			stateFilter: result.stateFilter,
			ignoreDailyLimits: result.ignoreDailyLimits,
			bypassScheduling: result.bypassScheduling,
			difficultyRange: result.difficultyRange,
			lapsesRange: result.lapsesRange,
			stabilityRange: result.stabilityRange,
			overdueOnly: result.overdueOnly,
			recentlyFailed: result.recentlyFailed,
			cardLimit: result.cardLimit,
			studyAheadDays: result.studyAheadDays,
			reviewOrder: result.reviewOrder,
			crammingMode: result.crammingMode,
			customStudy: result.customStudy,
			temporaryDeckId,
		};
	}

	private getCustomStudyDeckName(
		deck: Pick<TemporaryCustomStudyDeck, "customStudy">,
		scopeLabel?: string,
	): string {
		const requestName = (() => {
			switch (deck.customStudy.kind) {
				case "increase-new":
					return "Extra new cards";
				case "increase-review":
					return "Extra review cards";
				case "forgotten":
					return "Forgotten cards";
				case "actual-learning":
					return "Actual Learning";
				case "review-ahead":
					return "Review ahead";
				case "preview-new":
					return "Preview new cards";
				case "state-or-tag":
					return "Cards by state or tag";
			}
		})();

		return scopeLabel ? `${requestName} — ${scopeLabel}` : requestName;
	}

	private resolveLegacyCustomStudyProjectPath(
		deck: TemporaryCustomStudyDeck,
	): string | undefined {
		if (deck.projectPath) return deck.projectPath;
		if (!deck.scopeLabel || (deck.sourceNoteFilters?.length ?? 0) <= 1) {
			return undefined;
		}

		const file = this.plugin.app.metadataCache.getFirstLinkpathDest(
			deck.scopeLabel,
			"",
		);
		if (!file) return undefined;
		const isProject =
			this.plugin.hierarchyService.isExplicitProject(file.path) ||
			this.plugin.hierarchyService.getDescendantPaths(file.path).length > 0;
		return isProject ? file.path : undefined;
	}

	private getSessionValidationDeps() {
		return {
			allCards: this.plugin.flashcardManager.getAllFSRSCards(),
			archivedSourceUids: this.plugin.hierarchyService.getArchivedSourceUids(),
			settings: this.plugin.settings,
			sessionPersistence: this.plugin.sessionPersistence,
			presetService: this.plugin.presetService,
			noteResolver: new ObsidianNoteResolver(this.plugin.app),
			hierarchyService: this.plugin.hierarchyService,
			fsrsService: this.plugin.fsrsService,
		};
	}

	private async materializeTemporaryCustomStudyDeck(
		result: SessionResult,
		options: {
			scopeLabel?: string;
			deckId?: string;
			deckName?: string;
			preserveCreatedAt?: number;
		} = {},
	): Promise<void> {
		if (!result.customStudy) return;
		if (!this.plugin.isStoreReady()) {
			notify().error(
				"Database not ready. Please wait for plugin to fully load.",
			);
			return;
		}

		const validation = this.sessionService.validate(
			this.getCustomStudySessionConfig(result, options.deckId),
			this.getSessionValidationDeps(),
			{
				ignoreDailyLimitsForNoteStudy:
					this.plugin.settings.ignoreDailyLimitsForNoteStudy,
				dayStartHour: this.plugin.settings.dayStartHour,
				rModeEnabled: this.plugin.settings.rMode.enabled,
			},
		);
		const now = Date.now();
		const { queue } = this.plugin.reviewController.buildSession(
			validation.filters,
		);
		const deck: TemporaryCustomStudyDeck = {
			id: options.deckId ?? crypto.randomUUID(),
			name:
				options.deckName ??
				this.getCustomStudyDeckName(
					{ customStudy: result.customStudy },
					options.scopeLabel,
				),
			customStudy: result.customStudy,
			cardIds: queue.map((card) => card.id),
			sourceNoteFilters: result.sourceNoteFilters,
			projectPath: result.projectPath,
			scopeLabel: options.scopeLabel,
			createdAt: options.preserveCreatedAt ?? now,
			rebuiltAt: now,
		};

		const existingDecks = this.plugin.settings.temporaryCustomStudyDecks;
		const nextDecks = options.deckId
			? existingDecks.map((existing) =>
					existing.id === options.deckId ? deck : existing,
				)
			: [...existingDecks, deck];
		await this.plugin.saveSettings({ temporaryCustomStudyDecks: nextDecks });
		await this.plugin.openDashboard();

		const action = options.deckId ? "rebuilt" : "created";
		if (deck.cardIds.length === 0) {
			notify().info(`Custom Study Session ${action}, but no cards matched.`);
		} else {
			notify().success(
				`Custom Study Session ${action} with ${deck.cardIds.length} card${deck.cardIds.length === 1 ? "" : "s"}.`,
			);
		}
	}

	async startTemporaryCustomStudyDeck(deckId: string): Promise<void> {
		const deck = this.plugin.settings.temporaryCustomStudyDecks.find(
			(candidate) => candidate.id === deckId,
		);
		if (!deck) return;
		if (deck.cardIds.length === 0) {
			notify().info("This Custom Study Session is empty. Rebuild it first.");
			return;
		}

		await this.plugin.startReview({
			mode: "custom",
			projectPath: deck.projectPath,
			sourceNoteFilters: deck.sourceNoteFilters,
			customStudy: deck.customStudy,
			materializedCardIds: [...deck.cardIds],
			temporaryDeckId: deck.id,
		});
	}

	async rebuildTemporaryCustomStudyDeck(deckId: string): Promise<void> {
		const deck = this.plugin.settings.temporaryCustomStudyDecks.find(
			(candidate) => candidate.id === deckId,
		);
		if (!deck) return;
		const projectPath = this.resolveLegacyCustomStudyProjectPath(deck);

		await this.materializeTemporaryCustomStudyDeck(
			{
				cancelled: false,
				sessionType: "custom-study",
				ignoreDailyLimits: true,
				sourceNoteFilters: projectPath ? undefined : deck.sourceNoteFilters,
				projectPath,
				customStudy: deck.customStudy,
			},
			{
				scopeLabel: deck.scopeLabel,
				deckId: deck.id,
				deckName: deck.name,
				preserveCreatedAt: deck.createdAt,
			},
		);
	}

	async emptyTemporaryCustomStudyDeck(deckId: string): Promise<void> {
		const deck = this.plugin.settings.temporaryCustomStudyDecks.find(
			(candidate) => candidate.id === deckId,
		);
		if (!deck || deck.cardIds.length === 0) return;

		await this.plugin.saveSettings({
			temporaryCustomStudyDecks:
				this.plugin.settings.temporaryCustomStudyDecks.map((candidate) =>
					candidate.id === deckId ? { ...candidate, cardIds: [] } : candidate,
				),
		});
		notify().success("Custom Study Session emptied.");
	}

	async deleteTemporaryCustomStudyDeck(deckId: string): Promise<void> {
		if (
			!this.plugin.settings.temporaryCustomStudyDecks.some(
				(candidate) => candidate.id === deckId,
			)
		) {
			return;
		}
		await this.plugin.saveSettings({
			temporaryCustomStudyDecks:
				this.plugin.settings.temporaryCustomStudyDecks.filter(
					(candidate) => candidate.id !== deckId,
				),
		});
		notify().success("Custom Study Session deleted.");
	}

	removeCardsFromTemporaryDeck(
		deckId: string | undefined,
		cardIds: readonly string[],
	): void {
		if (!deckId) return;
		const deck = this.plugin.settings.temporaryCustomStudyDecks.find(
			(candidate) => candidate.id === deckId,
		);
		if (!deck) return;
		const removedIds = new Set(cardIds);
		if (!deck.cardIds.some((id) => removedIds.has(id))) return;

		const temporaryCustomStudyDecks =
			this.plugin.settings.temporaryCustomStudyDecks.map((candidate) =>
				candidate.id === deckId
					? {
							...candidate,
							cardIds: candidate.cardIds.filter((id) => !removedIds.has(id)),
						}
					: candidate,
			);
		void this.plugin
			.saveSettings({ temporaryCustomStudyDecks })
			.catch((error) => {
				notify().operationFailed("update Custom Study Session", error);
			});
	}

	async openCustomStudyModal(scope?: CustomStudyModalScope): Promise<void> {
		const scopedNoteNames = scope?.sourceNoteFilters
			? new Set(scope.sourceNoteFilters)
			: null;
		const scopedProjectSourceUids = scope?.projectPath
			? this.plugin.hierarchyService.getSourceUidsForProject(scope.projectPath)
			: null;
		const allMeta = this.plugin.dataLayer?.get<Map<string, CardSchedulingMeta>>(
			Q.ALL_META,
		);
		const availableTags = [
			...new Set(
				[...(allMeta?.values() ?? [])]
					.filter(
						(card) =>
							(!scopedNoteNames ||
								scopedNoteNames.has(card.sourceNoteName ?? "")) &&
							(!scopedProjectSourceUids ||
								scopedProjectSourceUids.has(card.sourceUid ?? "")),
					)
					.flatMap((card) => card.tags ?? []),
			),
		].sort((a, b) => a.localeCompare(b));
		const modal = new CustomStudyModal(
			this.plugin.app,
			{
				title: scope?.scopeLabel
					? `Custom study — ${scope.scopeLabel}`
					: "Custom study",
				width: "480px",
			},
			{ ...scope, availableTags },
		);
		const result = await modal.openAndWait();
		if (result.cancelled || !result.sessionResult) return;

		await this.materializeTemporaryCustomStudyDeck(result.sessionResult, {
			scopeLabel: scope?.scopeLabel,
		});
	}
}
