import type {
	ToolCall,
	ToolDefinition,
} from "@true-recall/core/ai/clients/openrouter-client";
import type { FlashcardManager } from "@true-recall/core/flashcard/flashcard.service";
import type { FSRSHelperService } from "@true-recall/core/metrics/fsrs-tools/fsrs-helper.service";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite";
import type { HierarchyService } from "@true-recall/core/services/notes/hierarchy.service";
import type { DayBoundaryService } from "@true-recall/core/services/review/day-boundary.service";
import { formatLocalDate } from "@true-recall/core/utils";
import type {
	RagSearchService,
	SearchResult,
} from "../retrieval/rag-search.service";

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
				"Analyze a study session in detail: every card reviewed with ratings, which notes were studied, cards the user struggled with (rated Again), retention rate, and per-note breakdown. Works for today or any past date.",
			parameters: {
				type: "object",
				properties: {
					date: {
						type: "string",
						description:
							"Date in YYYY-MM-DD format. Defaults to today if omitted.",
					},
				},
			},
		},
	},
	{
		type: "function",
		function: {
			name: "get_daily_stats",
			description:
				"Get daily statistics for a date range. Returns reviews completed, new cards studied, time spent, and rating breakdown (again/hard/good/easy) for each day. Use for questions about past days, yesterday, last week, specific dates, or historical trends.",
			parameters: {
				type: "object",
				properties: {
					start_date: {
						type: "string",
						description: "Start date in YYYY-MM-DD format",
					},
					end_date: {
						type: "string",
						description: "End date in YYYY-MM-DD format",
					},
				},
				required: ["start_date", "end_date"],
			},
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
				return {
					content: this.getSessionAnalysis(args.date as string | undefined),
				};
			case "get_daily_stats":
				return {
					content: this.getDailyStats(
						args.start_date as string,
						args.end_date as string,
					),
				};
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
		const archivedUids = this.hierarchy.getArchivedSourceUids();
		const snapshot = this.fsrsHelper.getTrueRetentionSnapshot(days);
		const workload = this.fsrsHelper.getWorkloadForecastSummary(days, archivedUids);
		const byDay = this.fsrsHelper.getWorkloadByDayOfWeek(days, archivedUids);
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

	private getSessionAnalysis(date?: string): string {
		const targetDate = date || formatLocalDate(new Date());
		const dailyStats = this.cardStore.stats.getDailyStats(targetDate);

		if (!dailyStats || dailyStats.reviewsCompleted === 0) {
			return JSON.stringify({
				date: targetDate,
				hasData: false,
				message: `No reviews completed on ${targetDate}.`,
			});
		}

		const reviewedCardIds = dailyStats.reviewedCardIds ?? [];
		const cards = reviewedCardIds
			.map((id) => {
				const card = this.cardStore.cards.get(id);
				if (!card) return null;
				const history = this.cardStore.stats.getCardReviewHistory(id, 5);
				const dateReviews = history.filter(
					(h) => formatLocalDate(new Date(h.t)) === targetDate,
				);
				return {
					question: card.question ?? "",
					state: card.state,
					stability: card.stability,
					difficulty: card.difficulty,
					lapses: card.lapses,
					sourceNoteName: card.sourceNoteName ?? "",
					ratings: dateReviews.map((r) => r.r),
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
				date: targetDate,
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

	private getDailyStats(startDate: string, endDate: string): string {
		const days: Array<{
			date: string;
			reviewsCompleted: number;
			newCardsStudied: number;
			totalTimeMs: number;
			again: number;
			hard: number;
			good: number;
			easy: number;
		}> = [];

		const current = new Date(startDate);
		const end = new Date(endDate);
		while (current <= end) {
			const dateStr = formatLocalDate(current);
			const stats = this.cardStore.stats.getDailyStats(dateStr);
			if (stats) {
				days.push({
					date: stats.date,
					reviewsCompleted: stats.reviewsCompleted,
					newCardsStudied: stats.newCardsStudied,
					totalTimeMs: stats.totalTimeMs,
					again: stats.again,
					hard: stats.hard,
					good: stats.good,
					easy: stats.easy,
				});
			}
			current.setDate(current.getDate() + 1);
		}

		return JSON.stringify({ days }, null, 2);
	}
}
