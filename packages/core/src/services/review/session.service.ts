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
}

export type SessionValidationDeps = ReviewSessionEngineDeps;

export class SessionService {
	private readonly engine = new ReviewSessionEngine();

	resolveFilters(
		config: SessionConfig,
		settings: SessionServiceSettings,
	): SessionFilters {
		const base: Partial<SessionFilters> = {
			customReviewOrder: config.reviewOrder,
			cardLimit: config.cardLimit,
			dayStartHour: settings.dayStartHour,
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
				// eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructuring to exclude these keys from ...rest
				const { mode: _, reviewOrder: __, cardLimit: ___, ...rest } = config;
				return { ...base, ...rest };
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
