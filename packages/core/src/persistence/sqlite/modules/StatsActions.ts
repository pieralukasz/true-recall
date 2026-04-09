import type {
	CardMaturityBreakdown,
	CardReviewLogEntry,
	CardsCreatedVsReviewedEntry,
	CreationSourceStats,
	ExtendedDailyStats,
	NotePerformanceRow,
	ProblemCard,
	StudyPattern,
	TimeToMasteryStats,
} from "../../../types";
import type { SqliteDatabase } from "../SqliteDatabase";
import { AnalyticsActions } from "./stats/analytics-actions";
import { DailyProgressActions } from "./stats/daily-progress-actions";
import { ReviewLogActions } from "./stats/review-log-actions";

export type {
	PresetDailyProgressRow,
	ReviewLogForSync,
} from "./stats/review-log-actions";

export class StatsActions {
	private reviewLog: ReviewLogActions;
	private dailyProgress: DailyProgressActions;
	private analytics: AnalyticsActions;

	constructor(db: SqliteDatabase) {
		this.reviewLog = new ReviewLogActions(db);
		this.dailyProgress = new DailyProgressActions(db);
		this.analytics = new AnalyticsActions(db);
	}

	// ── Review log operations ─────────────────────────────────────

	addReviewLog(
		cardId: string,
		rating: number,
		scheduledDays: number,
		elapsedDays: number,
		state: number,
		timeSpentMs: number,
		presetName?: string,
	): void {
		this.reviewLog.addReviewLog(
			cardId,
			rating,
			scheduledDays,
			elapsedDays,
			state,
			timeSpentMs,
			presetName,
		);
	}

	getCardReviewHistory(cardId: string, limit = 20): CardReviewLogEntry[] {
		return this.reviewLog.getCardReviewHistory(cardId, limit);
	}

	getTotalReviewCount(): number {
		return this.reviewLog.getTotalReviewCount();
	}

	getReviewCountForPreset(presetName: string): number {
		return this.reviewLog.getReviewCountForPreset(presetName);
	}

	getPresetProgressInRange(
		startIso: string,
		endIso: string,
	): { presetName: string; newStudied: number; reviewsCompleted: number }[] {
		return this.reviewLog.getPresetProgressInRange(startIso, endIso);
	}

	updateReviewLogPresetName(oldName: string, newName: string): void {
		this.reviewLog.updateReviewLogPresetName(oldName, newName);
	}

	getAnswerStreakInfo(): {
		current: number;
		todayBest: number;
		allTimeBest: number;
	} {
		return this.reviewLog.getAnswerStreakInfo();
	}

	getModifiedReviewLogSince(timestamp: number): {
		id: string;
		cardId: string;
		reviewedAt: string;
		rating: number;
		scheduledDays: number;
		elapsedDays: number;
		state: number;
		timeSpentMs: number;
		updatedAt: number;
		deletedAt: number | null;
		presetName: string | null;
	}[] {
		return this.reviewLog.getModifiedReviewLogSince(timestamp);
	}

	upsertReviewLogFromRemote(data: {
		id: string;
		cardId: string;
		reviewedAt: string;
		rating: number;
		scheduledDays: number;
		elapsedDays: number;
		state: number;
		timeSpentMs: number;
		updatedAt: number;
		deletedAt: number | null;
		presetName: string | null;
	}): boolean {
		return this.reviewLog.upsertReviewLogFromRemote(data);
	}

	getReviewLogForSync(id: string): {
		id: string;
		cardId: string;
		reviewedAt: string;
		rating: number;
		scheduledDays: number;
		elapsedDays: number;
		state: number;
		timeSpentMs: number;
		updatedAt: number;
		deletedAt: number | null;
		presetName: string | null;
	} | null {
		return this.reviewLog.getReviewLogForSync(id);
	}

	deleteAllReviewLogForSync(): void {
		this.reviewLog.deleteAllReviewLogForSync();
	}

	getReviewDataForOptimization(presetName?: string): {
		cardId: string;
		reviewedAt: number;
		rating: number;
		scheduledDays: number;
		elapsedDays: number;
		state: number;
		stability: number;
		difficulty: number;
	}[] {
		return this.reviewLog.getReviewDataForOptimization(presetName);
	}

	// ── Daily progress operations ─────────────────────────────────

	getDailyStats(date: string): ExtendedDailyStats | null {
		return this.dailyProgress.getDailyStats(date);
	}

	updateDailyStats(date: string, stats: Partial<ExtendedDailyStats>): void {
		this.dailyProgress.updateDailyStats(date, stats);
	}

	decrementDailyStats(date: string, stats: Partial<ExtendedDailyStats>): void {
		this.dailyProgress.decrementDailyStats(date, stats);
	}

	recordReviewedCard(date: string, cardId: string): void {
		this.dailyProgress.recordReviewedCard(date, cardId);
	}

	getReviewedCardIds(date: string): string[] {
		return this.dailyProgress.getReviewedCardIds(date);
	}

	removeReviewedCard(date: string, cardId: string): void {
		this.dailyProgress.removeReviewedCard(date, cardId);
	}

	rebuildDailyStatsFromReviewLog(): void {
		this.dailyProgress.rebuildDailyStatsFromReviewLog();
	}

	getAllDailyStats(): Record<string, ExtendedDailyStats> {
		return this.dailyProgress.getAllDailyStats();
	}

	getAllDailyStatsSummary(): Record<string, ExtendedDailyStats> {
		return this.dailyProgress.getAllDailyStatsSummary();
	}

	getDailyStatsFromReviewLog(
		startDate: string,
		endDate: string,
		opts?: {
			presetNames?: string[];
			excludeSourceUids?: string[];
		},
	): ExtendedDailyStats[] {
		return this.dailyProgress.getDailyStatsFromReviewLog(
			startDate,
			endDate,
			opts,
		);
	}

	// ── Analytics operations ──────────────────────────────────────

	getCardMaturityBreakdown(): CardMaturityBreakdown {
		return this.analytics.getCardMaturityBreakdown();
	}

	getDueCardsByDate(
		startDate: string,
		endDate: string,
	): { date: string; count: number }[] {
		return this.analytics.getDueCardsByDate(startDate, endDate);
	}

	getProblemCards(limit = 20): ProblemCard[] {
		return this.analytics.getProblemCards(limit);
	}

	getStudyPatterns(): StudyPattern {
		return this.analytics.getStudyPatterns();
	}

	getCardsCreatedByDate(
		startDate: string,
		endDate: string,
	): { date: string; count: number }[] {
		return this.analytics.getCardsCreatedByDate(startDate, endDate);
	}

	getCardsCreatedOnDate(date: string): string[] {
		return this.analytics.getCardsCreatedOnDate(date);
	}

	getCardsCreatedVsReviewed(
		startDate: string,
		endDate: string,
	): CardsCreatedVsReviewedEntry[] {
		return this.analytics.getCardsCreatedVsReviewed(startDate, endDate);
	}

	getTimeToMastery(): TimeToMasteryStats[] {
		return this.analytics.getTimeToMastery();
	}

	getReviewsForRetention(
		startDate: string,
		endDate: string,
		presetNames?: string[],
	): { date: string; rating: number }[] {
		return this.analytics.getReviewsForRetention(
			startDate,
			endDate,
			presetNames,
		);
	}

	getTrueRetention(startDate: string, endDate: string): number {
		return this.analytics.getTrueRetention(startDate, endDate);
	}

	getForecastDueByDay(days: number): { date: string; count: number }[] {
		return this.analytics.getForecastDueByDay(days);
	}

	getSiblingCards(sourceUid: string): {
		id: string;
		due: string;
		scheduledDays: number;
	}[] {
		return this.analytics.getSiblingCards(sourceUid);
	}

	getNotePerformance(): NotePerformanceRow[] {
		return this.analytics.getNotePerformance();
	}

	getCreationSourcePerformance(): CreationSourceStats[] {
		return this.analytics.getCreationSourcePerformance();
	}

	getNotePerformanceFiltered(
		excludeSourceUids: string[],
		includeSourceUids?: string[],
	): NotePerformanceRow[] {
		return this.analytics.getNotePerformanceFiltered(
			excludeSourceUids,
			includeSourceUids,
		);
	}
}
