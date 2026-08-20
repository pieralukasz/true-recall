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
import { AnalyticsCardActions } from "./stats/analytics-card-actions";
import { AnalyticsPerformanceActions } from "./stats/analytics-performance-actions";
import { DailyProgressActions } from "./stats/daily-progress-actions";
import { DailyProgressQueryActions } from "./stats/daily-progress-query-actions";
import {
	type ReviewKind,
	ReviewLogActions,
	type ReviewLogForSync,
} from "./stats/review-log-actions";
import {
	type ReviewLogReplayRow,
	ReviewLogSyncActions,
} from "./stats/review-log-sync-actions";

export type { ReviewKind, ReviewLogForSync } from "./stats/review-log-actions";
export type { ReviewLogReplayRow } from "./stats/review-log-sync-actions";

export class StatsActions {
	private reviewLog: ReviewLogActions;
	private reviewLogSync: ReviewLogSyncActions;
	private dailyProgress: DailyProgressActions;
	private dailyProgressQuery: DailyProgressQueryActions;
	private analyticsCard: AnalyticsCardActions;
	private analyticsPerformance: AnalyticsPerformanceActions;

	constructor(db: SqliteDatabase) {
		this.reviewLog = new ReviewLogActions(db);
		this.reviewLogSync = new ReviewLogSyncActions(db);
		this.dailyProgress = new DailyProgressActions(db);
		this.dailyProgressQuery = new DailyProgressQueryActions(db);
		this.analyticsCard = new AnalyticsCardActions(db);
		this.analyticsPerformance = new AnalyticsPerformanceActions(db);
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
		kind?: ReviewKind,
	): string {
		return this.reviewLog.addReviewLog(
			cardId,
			rating,
			scheduledDays,
			elapsedDays,
			state,
			timeSpentMs,
			presetName,
			kind,
		);
	}

	markReviewLogDeleted(id: string): void {
		this.reviewLog.markReviewLogDeleted(id);
	}

	getCardReviewHistory(cardId: string, limit = 20): CardReviewLogEntry[] {
		return this.reviewLog.getCardReviewHistory(cardId, limit);
	}

	getCardIdsRatedInRange(
		rating: number,
		startIso: string,
		endIso: string,
	): string[] {
		return this.reviewLog.getCardIdsRatedInRange(rating, startIso, endIso);
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

	getModifiedReviewLogSince(timestamp: number): ReviewLogForSync[] {
		return this.reviewLogSync.getModifiedReviewLogSince(timestamp);
	}

	upsertReviewLogFromRemote(data: ReviewLogForSync): boolean {
		return this.reviewLogSync.upsertReviewLogFromRemote(data);
	}

	getReviewLogForSync(id: string): ReviewLogForSync | null {
		return this.reviewLogSync.getReviewLogForSync(id);
	}

	getReplayLogsForCard(cardId: string): ReviewLogReplayRow[] {
		return this.reviewLogSync.getReplayLogsForCard(cardId);
	}

	getReviewedCardIdsSince(timestamp: number): string[] {
		return this.reviewLogSync.getReviewedCardIdsSince(timestamp);
	}

	reassignCardReviews(fromCardId: string, toCardId: string): void {
		this.reviewLogSync.reassignCardReviews(fromCardId, toCardId);
	}

	deleteAllReviewLogForSync(): void {
		this.reviewLogSync.deleteAllReviewLogForSync();
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
		return this.reviewLogSync.getReviewDataForOptimization(presetName);
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

	rebuildDailyStatsFromReviewLog(dayStartHour?: number): void {
		this.dailyProgress.rebuildDailyStatsFromReviewLog(dayStartHour);
	}

	getAllDailyStats(): Record<string, ExtendedDailyStats> {
		return this.dailyProgressQuery.getAllDailyStats();
	}

	getAllDailyStatsSummary(): Record<string, ExtendedDailyStats> {
		return this.dailyProgressQuery.getAllDailyStatsSummary();
	}

	getDailyStatsFromReviewLog(
		startDate: string,
		endDate: string,
		opts?: {
			presetNames?: string[];
			excludeSourceUids?: string[];
		},
	): ExtendedDailyStats[] {
		return this.dailyProgressQuery.getDailyStatsFromReviewLog(
			startDate,
			endDate,
			opts,
		);
	}

	// ── Analytics operations ──────────────────────────────────────

	getCardMaturityBreakdown(): CardMaturityBreakdown {
		return this.analyticsCard.getCardMaturityBreakdown();
	}

	getDueCardsByDate(
		startDate: string,
		endDate: string,
	): { date: string; count: number }[] {
		return this.analyticsCard.getDueCardsByDate(startDate, endDate);
	}

	getProblemCards(limit = 20): ProblemCard[] {
		return this.analyticsCard.getProblemCards(limit);
	}

	getStudyPatterns(): StudyPattern {
		return this.analyticsCard.getStudyPatterns();
	}

	getCardsCreatedByDate(
		startDate: string,
		endDate: string,
	): { date: string; count: number }[] {
		return this.analyticsPerformance.getCardsCreatedByDate(startDate, endDate);
	}

	getCardsCreatedOnDate(date: string): string[] {
		return this.analyticsPerformance.getCardsCreatedOnDate(date);
	}

	getCardsCreatedVsReviewed(
		startDate: string,
		endDate: string,
	): CardsCreatedVsReviewedEntry[] {
		return this.analyticsPerformance.getCardsCreatedVsReviewed(
			startDate,
			endDate,
		);
	}

	getTimeToMastery(): TimeToMasteryStats[] {
		return this.analyticsPerformance.getTimeToMastery();
	}

	getReviewsForRetention(
		startDate: string,
		endDate: string,
		presetNames?: string[],
	): { date: string; rating: number }[] {
		return this.analyticsPerformance.getReviewsForRetention(
			startDate,
			endDate,
			presetNames,
		);
	}

	getTrueRetention(startDate: string, endDate: string): number {
		return this.analyticsPerformance.getTrueRetention(startDate, endDate);
	}

	getForecastDueByDay(days: number): { date: string; count: number }[] {
		return this.analyticsPerformance.getForecastDueByDay(days);
	}

	getSiblingCards(sourceUid: string): {
		id: string;
		due: string;
		scheduledDays: number;
	}[] {
		return this.analyticsPerformance.getSiblingCards(sourceUid);
	}

	getNotePerformance(): NotePerformanceRow[] {
		return this.analyticsPerformance.getNotePerformance();
	}

	getCreationSourcePerformance(): CreationSourceStats[] {
		return this.analyticsPerformance.getCreationSourcePerformance();
	}

	getNotePerformanceFiltered(
		excludeSourceUids: string[],
		includeSourceUids?: string[],
	): NotePerformanceRow[] {
		return this.analyticsPerformance.getNotePerformanceFiltered(
			excludeSourceUids,
			includeSourceUids,
		);
	}
}
