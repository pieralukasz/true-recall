import type { SessionFilters } from "../../types/review-session.types";
import type { SessionConfig } from "../../types/session-config.types";
import { getTodayBoundary } from "../../utils/date.utils";
import {
	ReviewSessionEngine,
	type ReviewSessionEngineDeps,
} from "./review-session.engine";

export interface SessionValidation {
	valid: boolean;
	message?: string;
	filters: SessionFilters;
}

export interface SessionServiceSettings {
	ignoreDailyLimitsForNoteStudy: boolean;
	dayStartHour?: number;
	rModeEnabled?: boolean;
}

export type SessionValidationDeps = ReviewSessionEngineDeps;

export class SessionService {
	private readonly engine = new ReviewSessionEngine();

	resolveFilters(
		config: SessionConfig,
		settings: SessionServiceSettings,
	): SessionFilters {
		const supportsRMode =
			config.mode === "all_due" ||
			config.mode === "note" ||
			(config.mode === "notes" && !config.dueOnly) ||
			config.mode === "project";
		const base: Partial<SessionFilters> = {
			customReviewOrder: config.reviewOrder,
			cardLimit: config.cardLimit,
			dayStartHour: settings.dayStartHour,
			rModeTargetCount: config.rModeTargetCount,
			schedulingMode:
				settings.rModeEnabled && supportsRMode ? "retrievability" : "due",
		};

		switch (config.mode) {
			case "all_due":
				return { ...base };

			case "note":
				return {
					...base,
					sourceUidFilter: config.sourceUid,
					ignoreDailyLimits: true,
				};

			case "notes":
				return {
					...base,
					sourceNoteFilters: config.noteNames,
					projectPath: config.projectPath,
					ignoreDailyLimits: settings.ignoreDailyLimitsForNoteStudy,
					stateFilter: config.dueOnly ? "due" : undefined,
				};

			case "project":
				return { ...base, projectPath: config.projectPath };

			case "created_today":
				return { ...base, createdTodayOnly: true, ignoreDailyLimits: true };

			case "weak_cards":
				return {
					...base,
					weakCardsOnly: true,
					ignoreDailyLimits: true,
					bypassScheduling: true,
					sourceNoteFilter: config.sourceNoteFilter,
				};

			case "overdue":
				return { ...base, overdueOnly: true, ignoreDailyLimits: true };

			case "study_ahead":
				return {
					...base,
					studyAheadDays: config.days,
					ignoreDailyLimits: true,
				};

			case "custom": {
				// Session plumbing fields are already consumed by `base`; everything
				// else in the custom config is a filter.
				const filters: Partial<Extract<SessionConfig, { mode: "custom" }>> = {
					...config,
				};
				delete filters.mode;
				delete filters.reviewOrder;
				delete filters.cardLimit;
				delete filters.rModeTargetCount;
				const resolved = { ...base, ...filters };
				if (!config.customStudy) return resolved;

				const preview =
					config.customStudy.kind === "forgotten" ||
					config.customStudy.kind === "preview-new" ||
					(config.customStudy.kind === "state-or-tag" &&
						config.customStudy.cardState === "all");

				return {
					...resolved,
					ignoreDailyLimits: true,
					bypassScheduling: true,
					crammingMode: preview,
				};
			}
		}
	}

	validate(
		config: SessionConfig,
		deps: SessionValidationDeps,
		settings: SessionServiceSettings,
	): SessionValidation {
		const filters = this.resolveFilters(config, settings);
		const active = this.engine.getActiveCards(
			deps.allCards,
			filters,
			deps.archivedSourceUids,
		);

		switch (config.mode) {
			case "note": {
				const noteCards = active.filter(
					(c) => c.sourceUid === config.sourceUid,
				);
				if (noteCards.length === 0) {
					return {
						valid: false,
						message: "No flashcards found for this note.",
						filters,
					};
				}
				const snapshot = this.engine.bootstrap(deps, filters);
				if (snapshot.queueLength === 0) {
					return {
						valid: false,
						message: `No cards available for review for this note right now (${noteCards.length} cards exist; all are scheduled or filtered out).`,
						filters,
					};
				}
				break;
			}

			case "created_today": {
				const todayMs = getTodayBoundary(settings.dayStartHour ?? 4).getTime();
				const todayCards = active.filter(
					(c) => (c.fsrs.createdAt ?? 0) >= todayMs,
				);
				if (todayCards.length === 0) {
					return {
						valid: false,
						message: "No new cards created today.",
						filters,
					};
				}
				break;
			}
		}

		return { valid: true, filters };
	}
}
