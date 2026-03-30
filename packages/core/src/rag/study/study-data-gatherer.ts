import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite";
import type { DayBoundaryService } from "@true-recall/core/services/review/day-boundary.service";
import type { HierarchyService } from "@true-recall/core/services/notes/hierarchy.service";
import type { FSRSHelperService } from "@true-recall/core/metrics/fsrs-tools/fsrs-helper.service";
import type { FlashcardManager } from "@true-recall/core/flashcard/flashcard.service";
import { formatLocalDate } from "@true-recall/core/utils";

interface TopicMatch {
	topic: string;
	gather: () => string | null;
}

const DAY_NAMES = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

export class StudyDataGatherer {
	constructor(
		private cardStore: SqliteStoreService,
		private fsrsHelper: FSRSHelperService,
		private flashcardManager: FlashcardManager,
		private dayBoundary: DayBoundaryService,
		private hierarchy: HierarchyService,
	) {}

	gather(query: string): string | null {
		const q = query.toLowerCase();
		const topics = this.getMatchingTopics(q);

		if (topics.length === 0) topics.push(this.overviewTopic());

		const sections: string[] = [];
		for (const t of topics) {
			const section = t.gather();
			if (section) sections.push(section);
		}

		return sections.length > 0
			? `=== Study Progress Data ===\n\n${sections.join("\n\n")}`
			: null;
	}

	private getMatchingTopics(q: string): TopicMatch[] {
		const matched: TopicMatch[] = [];

		const checks: [RegExp, () => TopicMatch][] = [
			[/today|session|current|dzisi|tera[zź]/, () => this.todayTopic()],
			[/streak|consisten|habit|passa|seri/, () => this.streakTopic()],
			[
				/retention|success rate|correct|accura|skuteczno/,
				() => this.retentionTopic(),
			],
			[
				/matur|new card|learning|breakdown|distribut|rozk[lł]ad/,
				() => this.maturityTopic(),
			],
			[
				/workload|forecast|schedule|busy|obci[aą][zż]/,
				() => this.workloadTopic(),
			],
			[
				/problem|leech|difficul|struggl|lapse|trudne|k[lł]opot/,
				() => this.problemsTopic(),
			],
			[
				/pattern|best (time|day|hour)|when should|kiedy (najlep|ucz)/,
				() => this.patternsTopic(),
			],
			[
				/overview|summary|progress|how am i doing|jak mi idzie|post[eę]p/,
				() => this.overviewTopic(),
			],
		];

		for (const [pattern, factory] of checks) {
			if (pattern.test(q)) matched.push(factory());
		}

		return matched;
	}

	private todayTopic(): TopicMatch {
		return {
			topic: "today",
			gather: () => {
				const today = formatLocalDate(new Date());
				const daily = this.cardStore.stats.getDailyStats(today);
				const streaks = this.cardStore.stats.getAnswerStreakInfo();
				const dueCount = this.getDueCount();

				const reviewed = daily?.reviewsCompleted ?? 0;
				const timeMin = daily ? Math.round(daily.totalTimeMs / 60000) : 0;
				const correctRate =
					daily && daily.reviewsCompleted > 0
						? Math.round(
								((daily.good + daily.easy) / daily.reviewsCompleted) * 100,
							)
						: 0;

				return `## Today's Session (${today})
- Reviews completed: ${reviewed}
- Correct rate (Good+Easy): ${correctRate}%
- Time spent: ${timeMin} minutes
- New cards studied: ${daily?.newCardsStudied ?? 0}
- Rating breakdown: Again ${daily?.again ?? 0}, Hard ${daily?.hard ?? 0}, Good ${daily?.good ?? 0}, Easy ${daily?.easy ?? 0}
- Cards still due: ${dueCount}
- Current answer streak: ${streaks.current}`;
			},
		};
	}

	private streakTopic(): TopicMatch {
		return {
			topic: "streaks",
			gather: () => {
				const s = this.cardStore.stats.getAnswerStreakInfo();
				return `## Streaks
- Current answer streak (consecutive Good/Easy): ${s.current}
- Today's best streak: ${s.todayBest}
- All-time best streak: ${s.allTimeBest}`;
			},
		};
	}

	private retentionTopic(): TopicMatch {
		return {
			topic: "retention",
			gather: () => {
				try {
					const snap = this.fsrsHelper.getTrueRetentionSnapshot();
					const s = snap.summary;
					const trendLabel =
						s.trend === 1
							? "improving"
							: s.trend === -1
								? "declining"
								: "stable";
					return `## True Retention (last 30 days)
- Current retention: ${(s.current * 100).toFixed(1)}%
- Target retention: ${(s.target * 100).toFixed(1)}%
- 30-day average: ${(s.average * 100).toFixed(1)}%
- Trend: ${trendLabel}
- Reviews analyzed: ${s.totalReviews}`;
				} catch {
					return null;
				}
			},
		};
	}

	private maturityTopic(): TopicMatch {
		return {
			topic: "maturity",
			gather: () => {
				const m = this.cardStore.stats.getCardMaturityBreakdown();
				const total =
					m.new + m.learning + m.young + m.mature + m.suspended + m.buried;
				return `## Card Collection (${total} total)
- New: ${m.new}
- Learning: ${m.learning}
- Young (interval < 21d): ${m.young}
- Mature (interval >= 21d): ${m.mature}
- Suspended: ${m.suspended}
- Buried: ${m.buried}`;
			},
		};
	}

	private workloadTopic(): TopicMatch {
		return {
			topic: "workload",
			gather: () => {
				try {
					const w = this.fsrsHelper.getWorkloadForecastSummary();
					return `## Workload Forecast (next 30 days)
- Average daily reviews: ${Math.round(w.avgDaily)}
- Peak day: ${w.peakDay.date} (${w.peakDay.count} cards)
- Lightest day: ${w.minDay.date} (${w.minDay.count} cards)
- Days above target: ${w.daysAboveTarget}
- Needs balancing: ${w.needsBalancing ? "yes" : "no"}`;
				} catch {
					return null;
				}
			},
		};
	}

	private problemsTopic(): TopicMatch {
		return {
			topic: "problems",
			gather: () => {
				const cards = this.cardStore.stats.getProblemCards(10);
				if (cards.length === 0)
					return "## Problem Cards\nNo problem cards found.";

				const lines = cards.map(
					(c) =>
						`- "${c.question}" — ${c.problemType.replace("_", " ")}, lapses: ${c.lapses}, stability: ${c.stability.toFixed(1)}, difficulty: ${c.difficulty.toFixed(1)}`,
				);
				return `## Problem Cards (${cards.length} found)\n${lines.join("\n")}`;
			},
		};
	}

	private patternsTopic(): TopicMatch {
		return {
			topic: "patterns",
			gather: () => {
				const p = this.cardStore.stats.getStudyPatterns();
				if (p.bestDays.length === 0 && p.bestHours.length === 0) {
					return "## Study Patterns\nNot enough review data to determine patterns.";
				}

				const bestDays = p.bestDays
					.slice(0, 3)
					.map(
						(d) =>
							`${DAY_NAMES[d.day]}: ${(d.successRate * 100).toFixed(0)}% success`,
					)
					.join(", ");
				const bestHours = p.bestHours
					.slice(0, 3)
					.map(
						(h) => `${h.hour}:00: ${(h.successRate * 100).toFixed(0)}% success`,
					)
					.join(", ");

				return `## Study Patterns (last 30 days)
- Best days: ${bestDays}
- Best hours: ${bestHours}`;
			},
		};
	}

	private overviewTopic(): TopicMatch {
		return {
			topic: "overview",
			gather: () => {
				const parts = [
					this.todayTopic().gather(),
					this.streakTopic().gather(),
					this.retentionTopic().gather(),
					this.maturityTopic().gather(),
				].filter(Boolean);
				return parts.join("\n\n");
			},
		};
	}

	private getDueCount(): number {
		const archivedUids = this.hierarchy.getArchivedSourceUids();
		let allCards = this.flashcardManager.getAllFSRSCards();
		if (archivedUids.size > 0) {
			allCards = allCards.filter(
				(c) => !c.sourceUid || !archivedUids.has(c.sourceUid),
			);
		}
		return this.dayBoundary.getDueCards(allCards).length;
	}
}
