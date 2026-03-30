import { type Grade } from "ts-fsrs";
import type { CardSchedulingMeta, FSRSCardData, SchedulingPreview } from "../../types";
import type { FSRSSettings } from "../../types/settings.types";
export declare class FSRSService {
    private fsrs;
    private readonly fsrsCache;
    private defaultSettingsKey;
    private static readonly MAX_CACHE_SIZE;
    constructor(settings: FSRSSettings);
    private createFSRS;
    private getSettingsKey;
    private getOrCreateFSRS;
    private resolveFSRS;
    updateSettings(settings: FSRSSettings): void;
    createNewCard(id: string): FSRSCardData;
    private toCard;
    private fromCard;
    scheduleCard(cardData: FSRSCardData, rating: Grade, reviewTime?: Date, presetSettings?: FSRSSettings): FSRSCardData;
    getSchedulingPreview(cardData: FSRSCardData, presetSettings?: FSRSSettings): SchedulingPreview;
    private formatScheduleInterval;
    isDue(cardData: FSRSCardData, now?: Date): boolean;
    getDueCards(cards: CardSchedulingMeta[], now?: Date): CardSchedulingMeta[];
    getNewCards(cards: CardSchedulingMeta[], limit?: number): CardSchedulingMeta[];
    getLearningCards(cards: CardSchedulingMeta[]): CardSchedulingMeta[];
    /**
     * Uses day-based scheduling like Anki: all review cards due "today" are available
     * after the dayStartHour cutoff, regardless of exact time
     */
    getReviewCards(cards: CardSchedulingMeta[], now?: Date, dayStartHour?: number): CardSchedulingMeta[];
    sortByDue(cards: CardSchedulingMeta[]): CardSchedulingMeta[];
    /** Sort cards by retrievability (lowest R first - most at risk of forgetting) */
    sortByRetrievability(cards: CardSchedulingMeta[], now?: Date, presetSettings?: FSRSSettings): CardSchedulingMeta[];
    /** Returns probability of recall (0-1) */
    getRetrievability(cardData: FSRSCardData, now?: Date, presetSettings?: FSRSSettings): number;
    getStats(cards: CardSchedulingMeta[], dayStartHour?: number): {
        total: number;
        new: number;
        learning: number;
        review: number;
        relearning: number;
        dueToday: number;
    };
}
