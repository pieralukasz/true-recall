import { createEmptyCard, FSRS, Rating, State, } from "ts-fsrs";
import { DEFAULT_FSRS_WEIGHTS } from "../../constants";
import { isLearningState } from "../../helpers/card-state";
import { formatInterval } from "../../types";
import { getTomorrowBoundary } from "../../utils";
export class FSRSService {
    constructor(settings) {
        this.fsrsCache = new Map();
        this.defaultSettingsKey = this.getSettingsKey(settings);
        this.fsrs = this.getOrCreateFSRS(settings);
    }
    createFSRS(settings) {
        var _a;
        // Convert minutes to step format (e.g., [1, 10] -> ["1m", "10m"])
        const learningSteps = settings.learningSteps.map((m) => `${m}m`);
        const relearningSteps = settings.relearningSteps.map((m) => `${m}m`);
        return new FSRS({
            request_retention: settings.requestRetention,
            maximum_interval: settings.maximumInterval,
            w: (_a = settings.weights) !== null && _a !== void 0 ? _a : DEFAULT_FSRS_WEIGHTS,
            enable_short_term: settings.enableShortTerm,
            learning_steps: learningSteps,
            relearning_steps: relearningSteps,
            enable_fuzz: true, // Randomize intervals ±2.5% to prevent review bunching
        });
    }
    getSettingsKey(settings) {
        const weights = settings.weights ? settings.weights.join(",") : "default";
        const learning = settings.learningSteps.join(",");
        const relearning = settings.relearningSteps.join(",");
        return [
            settings.requestRetention,
            settings.maximumInterval,
            weights,
            learning,
            relearning,
            settings.enableShortTerm ? 1 : 0,
        ].join("|");
    }
    getOrCreateFSRS(settings) {
        const key = this.getSettingsKey(settings);
        const cached = this.fsrsCache.get(key);
        if (cached)
            return cached;
        const created = this.createFSRS(settings);
        this.fsrsCache.set(key, created);
        if (this.fsrsCache.size > FSRSService.MAX_CACHE_SIZE) {
            const oldestKey = this.fsrsCache.keys().next().value;
            if (oldestKey)
                this.fsrsCache.delete(oldestKey);
        }
        return created;
    }
    resolveFSRS(presetSettings) {
        if (!presetSettings)
            return this.fsrs;
        return this.getOrCreateFSRS(presetSettings);
    }
    updateSettings(settings) {
        const key = this.getSettingsKey(settings);
        if (key === this.defaultSettingsKey)
            return;
        this.defaultSettingsKey = key;
        this.fsrs = this.getOrCreateFSRS(settings);
    }
    createNewCard(id) {
        var _a, _b;
        const emptyCard = createEmptyCard();
        return {
            id,
            due: emptyCard.due.toISOString(),
            stability: emptyCard.stability,
            difficulty: emptyCard.difficulty,
            reps: emptyCard.reps,
            lapses: emptyCard.lapses,
            state: emptyCard.state,
            lastReview: (_b = (_a = emptyCard.last_review) === null || _a === void 0 ? void 0 : _a.toISOString()) !== null && _b !== void 0 ? _b : null,
            scheduledDays: emptyCard.scheduled_days,
            learningStep: emptyCard.learning_steps,
        };
    }
    toCard(data) {
        return {
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
        };
    }
    fromCard(card, id) {
        var _a, _b;
        return {
            id,
            due: card.due.toISOString(),
            stability: card.stability,
            difficulty: card.difficulty,
            reps: card.reps,
            lapses: card.lapses,
            state: card.state,
            lastReview: (_b = (_a = card.last_review) === null || _a === void 0 ? void 0 : _a.toISOString()) !== null && _b !== void 0 ? _b : null,
            scheduledDays: card.scheduled_days,
            learningStep: card.learning_steps,
        };
    }
    scheduleCard(cardData, rating, reviewTime, presetSettings) {
        const card = this.toCard(cardData);
        const now = reviewTime !== null && reviewTime !== void 0 ? reviewTime : new Date();
        const fsrs = this.resolveFSRS(presetSettings);
        const result = fsrs.next(card, now, rating);
        return this.fromCard(result.card, cardData.id);
    }
    getSchedulingPreview(cardData, presetSettings) {
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
    formatScheduleInterval(recordLogItem) {
        const card = recordLogItem.card;
        const now = new Date();
        const diffMs = card.due.getTime() - now.getTime();
        const diffMinutes = diffMs / (1000 * 60);
        return formatInterval(diffMinutes);
    }
    isDue(cardData, now) {
        const dueDate = new Date(cardData.due);
        const currentTime = now !== null && now !== void 0 ? now : new Date();
        return dueDate <= currentTime;
    }
    getDueCards(cards, now) {
        const currentTimestamp = (now !== null && now !== void 0 ? now : new Date()).getTime();
        return cards.filter((card) => new Date(card.fsrs.due).getTime() <= currentTimestamp);
    }
    getNewCards(cards, limit) {
        const newCards = cards.filter((card) => card.fsrs.state === State.New);
        return limit !== undefined ? newCards.slice(0, limit) : newCards;
    }
    getLearningCards(cards) {
        return cards.filter((card) => isLearningState(card.fsrs.state));
    }
    /**
     * Uses day-based scheduling like Anki: all review cards due "today" are available
     * after the dayStartHour cutoff, regardless of exact time
     */
    getReviewCards(cards, now, dayStartHour = 4) {
        const tomorrowBoundary = getTomorrowBoundary(dayStartHour, now);
        return cards.filter((card) => {
            if (card.fsrs.state !== State.Review)
                return false;
            const dueDate = new Date(card.fsrs.due);
            return dueDate < tomorrowBoundary;
        });
    }
    sortByDue(cards) {
        return [...cards].sort((a, b) => {
            const dateA = new Date(a.fsrs.due);
            const dateB = new Date(b.fsrs.due);
            return dateA.getTime() - dateB.getTime();
        });
    }
    /** Sort cards by retrievability (lowest R first - most at risk of forgetting) */
    sortByRetrievability(cards, now, presetSettings) {
        const currentTime = now !== null && now !== void 0 ? now : new Date();
        // Single pass: compute R for all cards
        const retrievabilityMap = new Map();
        for (const card of cards) {
            const r = this.getRetrievability(card.fsrs, currentTime, presetSettings);
            retrievabilityMap.set(card.id, r);
        }
        return [...cards].sort((a, b) => {
            var _a, _b;
            const rA = (_a = retrievabilityMap.get(a.id)) !== null && _a !== void 0 ? _a : 0;
            const rB = (_b = retrievabilityMap.get(b.id)) !== null && _b !== void 0 ? _b : 0;
            return rA - rB; // Lowest R first
        });
    }
    /** Returns probability of recall (0-1) */
    getRetrievability(cardData, now, presetSettings) {
        var _a;
        if (cardData.state === State.New) {
            return 0;
        }
        const card = this.toCard(cardData);
        const currentTime = now !== null && now !== void 0 ? now : new Date();
        const fsrs = this.resolveFSRS(presetSettings);
        return (_a = fsrs.get_retrievability(card, currentTime, false)) !== null && _a !== void 0 ? _a : 0;
    }
    getStats(cards, dayStartHour = 4) {
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
                if (dueTime <= nowTime)
                    stats.dueToday++;
            }
            else if (c.fsrs.state === State.Review) {
                if (dueTime < tomorrowBoundary.getTime())
                    stats.dueToday++;
            }
        }
        return stats;
    }
}
FSRSService.MAX_CACHE_SIZE = 64;
