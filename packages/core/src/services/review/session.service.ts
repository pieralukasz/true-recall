import { State } from "ts-fsrs";
import type { CardSchedulingMeta } from "../../types";
import type { SessionFilters } from "../../types/review-session.types";
import type { SessionConfig } from "../../types/session-config.types";
import { filterActiveCards } from "./session-helpers";

export interface SessionValidation {
	valid: boolean;
	message?: string;
	filters: SessionFilters;
}

export interface SessionServiceSettings {
	ignoreDailyLimitsForNoteStudy: boolean;
}

export class SessionService {
	resolveFilters(
		config: SessionConfig,
		settings: SessionServiceSettings,
	): SessionFilters {
		const base: Partial<SessionFilters> = {
			customReviewOrder: config.reviewOrder,
			cardLimit: config.cardLimit,
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
				const { mode: _, reviewOrder: __, cardLimit: ___, ...rest } = config;
				return { ...base, ...rest };
			}
		}
	}

	validate(
		config: SessionConfig,
		allCards: CardSchedulingMeta[],
		archivedSourceUids: ReadonlySet<string>,
		settings: SessionServiceSettings,
	): SessionValidation {
		const filters = this.resolveFilters(config, settings);
		const active = filterActiveCards(allCards, {
			archivedSourceUids: new Set(archivedSourceUids),
		});

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
				const now = new Date();
				const anyDue = noteCards.some(
					(c) =>
						c.fsrs.state === State.New ||
						c.fsrs.state === State.Learning ||
						c.fsrs.state === State.Relearning ||
						new Date(c.fsrs.due) <= now,
				);
				if (!anyDue) {
					return {
						valid: false,
						message: `No cards due for this note. All ${noteCards.length} cards are scheduled for later.`,
						filters,
					};
				}
				break;
			}

			case "created_today": {
				const today = new Date();
				today.setHours(0, 0, 0, 0);
				const todayMs = today.getTime();
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
