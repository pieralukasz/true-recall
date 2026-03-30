import type {
	ToolCall,
	ToolDefinition,
} from "@features/ai/services/openrouter-client";
import type { SqliteStoreService } from "@features/core/persistence/sqlite";
import type { DayBoundaryService } from "@features/core/services/day-boundary.service";
import type { HierarchyService } from "@features/core/services/hierarchy.service";
import type { FSRSHelperService } from "@features/metrics/services/fsrs-tools/fsrs-helper.service";
import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import { formatLocalDate } from "@shared/utils";
import type { RagSearchService, SearchResult } from "./rag-search.service";

export const RAG_CHAT_TOOLS: ToolDefinition[] = [
	{
		type: "function",
		function: {
			name: "search_knowledge",
			description:
				"Semantic search over the user's notes and flashcards. Returns ranked chunks with content and source info. Use to find relevant context before discussing any topic.",
			parameters: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "Search query — topic or concept to find",
					},
				},
				required: ["query"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "get_study_progress",
			description:
				"Get current study status: cards due today, reviews completed, correct rate, time spent, card collection breakdown (new/learning/young/mature/suspended), and answer streaks. Use for questions about today's session, due cards, or collection overview.",
			parameters: { type: "object", properties: {} },
		},
	},
	{
		type: "function",
		function: {
			name: "get_retention_analytics",
			description:
				"Get FSRS analytics: true retention (actual vs target, trend), workload forecast (predicted reviews per day, peak days), and card distributions (interval, stability, difficulty). Use for deep analytics questions.",
			parameters: {
				type: "object",
				properties: {
					days: {
						type: "number",
						description: "Analysis period in days (default 30)",
					},
				},
			},
		},
	},
	{
		type: "function",
		function: {
			name: "get_problem_cards",
			description:
				"Identify leech cards — cards with high lapses (>3), low stability (<2 days), or in relearning state. These are cards the user struggles to remember.",
			parameters: {
				type: "object",
				properties: {
					limit: {
						type: "number",
						description: "Max number of problem cards (default 20)",
					},
				},
			},
		},
	},
	{
		type: "function",
		function: {
			name: "get_study_patterns",
			description:
				"Analyze study patterns over the last 30 days: best days of week, best hours, and a day/hour heatmap of review activity and success rates.",
			parameters: { type: "object", properties: {} },
		},
	},
	{
		type: "function",
		function: {
			name: "get_session_analysis",
			description:
				"Analyze today's study session in detail: every card reviewed with ratings, which notes were studied, cards the user struggled with (rated Again), retention rate, and per-note breakdown.",
			parameters: { type: "object", properties: {} },
		},
	},
];

export interface ToolResult {
	content: string;
	searchResults?: SearchResult[];
}

export class RagToolExecutor {
	constructor(
		private ragSearch: RagSearchService,
		private cardStore: SqliteStoreService,
		private fsrsHelper: FSRSHelperService,
		private flashcardManager: FlashcardManager,
		private dayBoundary: DayBoundaryService,
		private hierarchy: HierarchyService,
	) {}

	async execute(call: ToolCall): Promise<ToolResult> {
		const args = JSON.parse(call.function.arguments || "{}") as Record<
			string,
			unknown
		>;

		switch (call.function.name) {
			case "search_knowledge":
				return this.searchKnowledge(args.query as string);
			case "get_study_progress":
				return { content: this.getStudyProgress() };
			case "get_retention_analytics":
				return {
					content: this.getRetentionAnalytics((args.days as number) || 30),
				};
			case "get_problem_cards":
				return {
					content: this.getProblemCards((args.limit as number) || 20),
				};
			case "get_study_patterns":
				return { content: this.getStudyPatterns() };
			case "get_session_analysis":
				return { content: this.getSessionAnalysis() };
			default:
				return { content: `Unknown tool: ${call.function.name}` };
		}
	}

	private async searchKnowledge(query: string): Promise<ToolResult> {
		const { results, stats } = await this.ragSearch.search(query);
		return {
			content: JSON.stringify(
				{
					stats,
					results: results.map((r, i) => ({
						index: i + 1,
						sourceType: r.sourceType,
						sourceId: r.sourceId,
						headingBreadcrumb: r.headingBreadcrumb,
						content: r.content,
						modifiedAt: r.modifiedAt
							? new Date(r.modifiedAt).toISOString().slice(0, 10)
							: undefined,
						fsrs: r.fsrs,
					})),
				},
				null,
				2,
			),
			searchResults: results,
		};
	}

	private getStudyProgress(): string {
		const today = formatLocalDate(new Date());
		const dailyStats = this.cardStore.stats.getDailyStats(today);
		const maturity = this.cardStore.stats.getCardMaturityBreakdown();
		const streaks = this.cardStore.stats.getAnswerStreakInfo();
		const totalReviews = this.cardStore.stats.getTotalReviewCount();

		const archivedUids = this.hierarchy.getArchivedSourceUids();
		let allCards = this.flashcardManager.getAllFSRSCards();
		if (archivedUids.size > 0) {
			allCards = allCards.filter(
				(c) => !c.sourceUid || !archivedUids.has(c.sourceUid),
			);
		}
		const dueCount = this.dayBoundary.getDueCards(allCards).length;

		return JSON.stringify(
			{
				date: today,
				totalCards: allCards.length,
				dueCount,
				totalReviews,
				today: dailyStats
					? {
							reviewsCompleted: dailyStats.reviewsCompleted,
							newCardsStudied: dailyStats.newCardsStudied,
							totalTimeMs: dailyStats.totalTimeMs,
							again: dailyStats.again,
							hard: dailyStats.hard,
							good: dailyStats.good,
							easy: dailyStats.easy,
						}
					: null,
				maturity,
				streaks,
			},
			null,
			2,
		);
	}

	private getRetentionAnalytics(days: number): string {
		const snapshot = this.fsrsHelper.getTrueRetentionSnapshot(days);
		const workload = this.fsrsHelper.getWorkloadForecastSummary(days);
		const byDay = this.fsrsHelper.getWorkloadByDayOfWeek(days);
		const distributions = this.fsrsHelper.getDistributions();

		return JSON.stringify(
			{
				trueRetention: {
					current: snapshot.summary.current,
					target: snapshot.summary.target,
					average: snapshot.summary.average,
					trend: snapshot.summary.trend,
					totalReviews: snapshot.summary.totalReviews,
					recentHistory: snapshot.history.slice(-7),
				},
				workloadForecast: {
					avgDaily: workload.avgDaily,
					peakDay: workload.peakDay,
					needsBalancing: workload.needsBalancing,
					daysAboveTarget: workload.daysAboveTarget,
				},
				workloadByDay: byDay,
				distributions: {
					interval: distributions.interval.stats,
					stability: distributions.stability.stats,
					difficulty: distributions.difficulty.stats,
				},
			},
			null,
			2,
		);
	}

	private getProblemCards(limit: number): string {
		const problems = this.cardStore.stats.getProblemCards(limit);
		return JSON.stringify({ count: problems.length, cards: problems }, null, 2);
	}

	private getStudyPatterns(): string {
		const patterns = this.cardStore.stats.getStudyPatterns();
		return JSON.stringify(patterns, null, 2);
	}

	private getSessionAnalysis(): string {
		const today = formatLocalDate(new Date());
		const dailyStats = this.cardStore.stats.getDailyStats(today);

		if (!dailyStats || dailyStats.reviewsCompleted === 0) {
			return JSON.stringify({
				date: today,
				hasData: false,
				message: "No reviews completed today yet.",
			});
		}

		const reviewedCardIds = dailyStats.reviewedCardIds ?? [];
		const cards = reviewedCardIds
			.map((id) => {
				const card = this.cardStore.cards.get(id);
				if (!card) return null;
				const history = this.cardStore.stats.getCardReviewHistory(id, 5);
				const todayReviews = history.filter(
					(h) => formatLocalDate(new Date(h.t)) === today,
				);
				return {
					question: card.question ?? "",
					state: card.state,
					stability: card.stability,
					difficulty: card.difficulty,
					lapses: card.lapses,
					sourceNoteName: card.sourceNoteName ?? "",
					todayRatings: todayReviews.map((r) => r.r),
				};
			})
			.filter(Boolean);

		const retentionRate =
			dailyStats.reviewsCompleted > 0
				? Math.round(
						((dailyStats.reviewsCompleted - dailyStats.again) /
							dailyStats.reviewsCompleted) *
							100,
					)
				: 0;

		return JSON.stringify(
			{
				date: today,
				hasData: true,
				summary: {
					reviewsCompleted: dailyStats.reviewsCompleted,
					newCardsStudied: dailyStats.newCardsStudied,
					totalTimeMs: dailyStats.totalTimeMs,
					ratings: {
						again: dailyStats.again,
						hard: dailyStats.hard,
						good: dailyStats.good,
						easy: dailyStats.easy,
					},
					retentionRate,
				},
				reviewedCards: cards,
			},
			null,
			2,
		);
	}
}
