import {
	type Card,
	createEmptyCard,
	FSRS,
	GenSeedStrategyWithCardId,
	type Grade,
	Rating,
	type RecordLogItem,
	State,
	StrategyMode,
} from "ts-fsrs";

import { DEFAULT_FSRS_WEIGHTS } from "../../constants";
import { isLearningState } from "../../helpers/card-state";
import type {
	CardSchedulingMeta,
	FSRSCardData,
	SchedulingPreview,
} from "../../types";
import { formatInterval } from "../../types";
import type { FSRSSettings } from "../../types/settings.types";
import { getTomorrowBoundary } from "../../utils";

export class FSRSService {
	private fsrs: FSRS;
	private readonly fsrsCache = new Map<string, FSRS>();
	private defaultSettingsKey: string;
	private static readonly MAX_CACHE_SIZE = 64;

	constructor(settings: FSRSSettings) {
		this.defaultSettingsKey = this.getSettingsKey(settings);
		this.fsrs = this.getOrCreateFSRS(settings);
	}

	private createFSRS(settings: FSRSSettings): FSRS {
		// Convert minutes to step format (e.g., [1, 10] -> ["1m", "10m"])
		const learningSteps = settings.learningSteps.map((m) => `${m}m` as const);
		const relearningSteps = settings.relearningSteps.map(
			(m) => `${m}m` as const,
		);

		const fsrs = new FSRS({
			request_retention: settings.requestRetention,
			maximum_interval: settings.maximumInterval,
			w: settings.weights ?? DEFAULT_FSRS_WEIGHTS,
			enable_short_term: settings.enableShortTerm,
			learning_steps: learningSteps,
			relearning_steps: relearningSteps,
			enable_fuzz: settings.enableFuzz,
		});
		fsrs.useStrategy(StrategyMode.SEED, GenSeedStrategyWithCardId("cid"));
		return fsrs;
	}

	private getSettingsKey(settings: FSRSSettings): string {
		const weights = settings.weights ? settings.weights.join(",") : "default";
		const learning = settings.learningSteps.join(",");
		const relearning = settings.relearningSteps.join(",");
		return [
			settings.requestRetention,
			settings.maximumInterval,
			weights,
			settings.enableFuzz ? 1 : 0,
			learning,
			relearning,
			settings.enableShortTerm ? 1 : 0,
		].join("|");
	}

	private getOrCreateFSRS(settings: FSRSSettings): FSRS {
		const key = this.getSettingsKey(settings);
		const cached = this.fsrsCache.get(key);
		if (cached) return cached;

		const created = this.createFSRS(settings);
		this.fsrsCache.set(key, created);
		if (this.fsrsCache.size > FSRSService.MAX_CACHE_SIZE) {
			const oldestKey = this.fsrsCache.keys().next().value as
				| string
				| undefined;
			if (oldestKey) this.fsrsCache.delete(oldestKey);
		}
		return created;
	}

	private resolveFSRS(presetSettings?: FSRSSettings): FSRS {
		if (!presetSettings) return this.fsrs;
		return this.getOrCreateFSRS(presetSettings);
	}

	updateSettings(settings: FSRSSettings): void {
		const key = this.getSettingsKey(settings);
		if (key === this.defaultSettingsKey) return;
		this.defaultSettingsKey = key;
		this.fsrs = this.getOrCreateFSRS(settings);
	}

	createNewCard(id: string): FSRSCardData {
		const emptyCard = createEmptyCard();
		return {
			id,
			due: emptyCard.due.toISOString(),
			stability: emptyCard.stability,
			difficulty: emptyCard.difficulty,
			reps: emptyCard.reps,
			lapses: emptyCard.lapses,
			state: emptyCard.state,
			lastReview: emptyCard.last_review?.toISOString() ?? null,
			scheduledDays: emptyCard.scheduled_days,
			learningStep: emptyCard.learning_steps,
		};
	}

	private toCard(data: FSRSCardData): Card {
		return {
			cid: data.id,
			due: new Date(data.due),
			stability: data.stability,
			difficulty: data.difficulty,
			elapsed_days: 0, // Will be calculated by ts-fsrs
			scheduled_days: data.scheduledDays,
			reps: data.reps,
			lapses: data.lapses,
			state: data.state,
			last_review: data.lastReview ? new Date(data.lastReview) : undefined,
			learning_steps: data.learningStep,
		} as Card;
	}

	private fromCard(card: Card, id: string): FSRSCardData {
		return {
			id,
			due: card.due.toISOString(),
			stability: card.stability,
			difficulty: card.difficulty,
			reps: card.reps,
			lapses: card.lapses,
			state: card.state,
			lastReview: card.last_review?.toISOString() ?? null,
			scheduledDays: card.scheduled_days,
			learningStep: card.learning_steps,
		};
	}

	scheduleCard(
		cardData: FSRSCardData,
		rating: Grade,
		reviewTime?: Date,
		presetSettings?: FSRSSettings,
	): FSRSCardData {
		const card = this.toCard(cardData);
		const now = reviewTime ?? new Date();
		const fsrs = this.resolveFSRS(presetSettings);

		const result = fsrs.next(card, now, rating);
		return this.fromCard(result.card, cardData.id);
	}

	getSchedulingPreview(
		cardData: FSRSCardData,
		presetSettings?: FSRSSettings,
	): SchedulingPreview {
		const card = this.toCard(cardData);
		const now = new Date();
		const fsrs = this.resolveFSRS(presetSettings);

		const result = fsrs.repeat(card, now);

		return {
			again: {
				due: result[Rating.Again].card.due,
				interval: this.formatScheduleInterval(result[Rating.Again]),
			},
			hard: {
				due: result[Rating.Hard].card.due,
				interval: this.formatScheduleInterval(result[Rating.Hard]),
			},
			good: {
				due: result[Rating.Good].card.due,
				interval: this.formatScheduleInterval(result[Rating.Good]),
			},
			easy: {
				due: result[Rating.Easy].card.due,
				interval: this.formatScheduleInterval(result[Rating.Easy]),
			},
		};
	}

	private formatScheduleInterval(recordLogItem: RecordLogItem): string {
		const card = recordLogItem.card;
		const now = new Date();
		const diffMs = card.due.getTime() - now.getTime();
		const diffMinutes = diffMs / (1000 * 60);
		return formatInterval(diffMinutes);
	}

	isDue(cardData: FSRSCardData, now?: Date): boolean {
		const dueDate = new Date(cardData.due);
		const currentTime = now ?? new Date();
		return dueDate <= currentTime;
	}

	getDueCards(cards: CardSchedulingMeta[], now?: Date): CardSchedulingMeta[] {
		const currentTimestamp = (now ?? new Date()).getTime();
		return cards.filter(
			(card) => new Date(card.fsrs.due).getTime() <= currentTimestamp,
		);
	}

	getNewCards(
		cards: CardSchedulingMeta[],
		limit?: number,
	): CardSchedulingMeta[] {
		const newCards = cards.filter((card) => card.fsrs.state === State.New);
		return limit !== undefined ? newCards.slice(0, limit) : newCards;
	}

	getLearningCards(cards: CardSchedulingMeta[]): CardSchedulingMeta[] {
		return cards.filter((card) => isLearningState(card.fsrs.state));
	}

	/**
	 * Uses day-based scheduling like Anki: all review cards due "today" are available
	 * after the dayStartHour cutoff, regardless of exact time
	 */
	getReviewCards(
		cards: CardSchedulingMeta[],
		now?: Date,
		dayStartHour = 4,
	): CardSchedulingMeta[] {
		const tomorrowBoundary = getTomorrowBoundary(dayStartHour, now);

		return cards.filter((card) => {
			if (card.fsrs.state !== State.Review) return false;
			const dueDate = new Date(card.fsrs.due);
			return dueDate < tomorrowBoundary;
		});
	}

	sortByDue(cards: CardSchedulingMeta[]): CardSchedulingMeta[] {
		return [...cards].sort((a, b) => {
			const dateA = new Date(a.fsrs.due);
			const dateB = new Date(b.fsrs.due);
			return dateA.getTime() - dateB.getTime();
		});
	}

	/** Sort cards by retrievability (lowest R first - most at risk of forgetting) */
	sortByRetrievability(
		cards: CardSchedulingMeta[],
		now?: Date,
		presetSettings?: FSRSSettings,
	): CardSchedulingMeta[] {
		const currentTime = now ?? new Date();

		// Single pass: compute R for all cards
		const retrievabilityMap = new Map<string, number>();
		for (const card of cards) {
			const r = this.getRetrievability(card.fsrs, currentTime, presetSettings);
			retrievabilityMap.set(card.id, r);
		}

		return [...cards].sort((a, b) => {
			const rA = retrievabilityMap.get(a.id) ?? 0;
			const rB = retrievabilityMap.get(b.id) ?? 0;
			return rA - rB; // Lowest R first
		});
	}

	/** Returns probability of recall (0-1) */
	getRetrievability(
		cardData: FSRSCardData,
		now?: Date,
		presetSettings?: FSRSSettings,
	): number {
		if (cardData.state === State.New) {
			return 0;
		}

		const card = this.toCard(cardData);
		const currentTime = now ?? new Date();
		const fsrs = this.resolveFSRS(presetSettings);
		return fsrs.get_retrievability(card, currentTime, false) ?? 0;
	}

	getStats(
		cards: CardSchedulingMeta[],
		dayStartHour = 4,
	): {
		total: number;
		new: number;
		learning: number;
		review: number;
		relearning: number;
		dueToday: number;
	} {
		const now = new Date();
		const tomorrowBoundary = getTomorrowBoundary(dayStartHour, now);
		const nowTime = now.getTime();

		const stats = {
			total: cards.length,
			new: 0,
			learning: 0,
			review: 0,
			relearning: 0,
			dueToday: 0,
		};

		for (const c of cards) {
			switch (c.fsrs.state) {
				case State.New:
					stats.new++;
					break;
				case State.Learning:
					stats.learning++;
					break;
				case State.Review:
					stats.review++;
					break;
				case State.Relearning:
					stats.relearning++;
					break;
			}

			// Learning/Relearning: exact timestamp; Review: day-based boundary
			const dueTime = new Date(c.fsrs.due).getTime();
			if (isLearningState(c.fsrs.state)) {
				if (dueTime <= nowTime) stats.dueToday++;
			} else if (c.fsrs.state === State.Review) {
				if (dueTime < tomorrowBoundary.getTime()) stats.dueToday++;
			}
		}

		return stats;
	}
}
