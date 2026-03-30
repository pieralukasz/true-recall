import { formatLocalDate } from "@true-recall/core/utils";
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
    constructor(cardStore, fsrsHelper, flashcardManager, dayBoundary, hierarchy) {
        this.cardStore = cardStore;
        this.fsrsHelper = fsrsHelper;
        this.flashcardManager = flashcardManager;
        this.dayBoundary = dayBoundary;
        this.hierarchy = hierarchy;
    }
    gather(query) {
        const q = query.toLowerCase();
        const topics = this.getMatchingTopics(q);
        if (topics.length === 0)
            topics.push(this.overviewTopic());
        const sections = [];
        for (const t of topics) {
            const section = t.gather();
            if (section)
                sections.push(section);
        }
        return sections.length > 0
            ? `=== Study Progress Data ===\n\n${sections.join("\n\n")}`
            : null;
    }
    getMatchingTopics(q) {
        const matched = [];
        const checks = [
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
            if (pattern.test(q))
                matched.push(factory());
        }
        return matched;
    }
    todayTopic() {
        return {
            topic: "today",
            gather: () => {
                var _a, _b, _c, _d, _e, _f;
                const today = formatLocalDate(new Date());
                const daily = this.cardStore.stats.getDailyStats(today);
                const streaks = this.cardStore.stats.getAnswerStreakInfo();
                const dueCount = this.getDueCount();
                const reviewed = (_a = daily === null || daily === void 0 ? void 0 : daily.reviewsCompleted) !== null && _a !== void 0 ? _a : 0;
                const timeMin = daily ? Math.round(daily.totalTimeMs / 60000) : 0;
                const correctRate = daily && daily.reviewsCompleted > 0
                    ? Math.round(((daily.good + daily.easy) / daily.reviewsCompleted) * 100)
                    : 0;
                return `## Today's Session (${today})
- Reviews completed: ${reviewed}
- Correct rate (Good+Easy): ${correctRate}%
- Time spent: ${timeMin} minutes
- New cards studied: ${(_b = daily === null || daily === void 0 ? void 0 : daily.newCardsStudied) !== null && _b !== void 0 ? _b : 0}
- Rating breakdown: Again ${(_c = daily === null || daily === void 0 ? void 0 : daily.again) !== null && _c !== void 0 ? _c : 0}, Hard ${(_d = daily === null || daily === void 0 ? void 0 : daily.hard) !== null && _d !== void 0 ? _d : 0}, Good ${(_e = daily === null || daily === void 0 ? void 0 : daily.good) !== null && _e !== void 0 ? _e : 0}, Easy ${(_f = daily === null || daily === void 0 ? void 0 : daily.easy) !== null && _f !== void 0 ? _f : 0}
- Cards still due: ${dueCount}
- Current answer streak: ${streaks.current}`;
            },
        };
    }
    streakTopic() {
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
    retentionTopic() {
        return {
            topic: "retention",
            gather: () => {
                try {
                    const snap = this.fsrsHelper.getTrueRetentionSnapshot();
                    const s = snap.summary;
                    const trendLabel = s.trend === 1
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
                }
                catch (_a) {
                    return null;
                }
            },
        };
    }
    maturityTopic() {
        return {
            topic: "maturity",
            gather: () => {
                const m = this.cardStore.stats.getCardMaturityBreakdown();
                const total = m.new + m.learning + m.young + m.mature + m.suspended + m.buried;
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
    workloadTopic() {
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
                }
                catch (_a) {
                    return null;
                }
            },
        };
    }
    problemsTopic() {
        return {
            topic: "problems",
            gather: () => {
                const cards = this.cardStore.stats.getProblemCards(10);
                if (cards.length === 0)
                    return "## Problem Cards\nNo problem cards found.";
                const lines = cards.map((c) => `- "${c.question}" — ${c.problemType.replace("_", " ")}, lapses: ${c.lapses}, stability: ${c.stability.toFixed(1)}, difficulty: ${c.difficulty.toFixed(1)}`);
                return `## Problem Cards (${cards.length} found)\n${lines.join("\n")}`;
            },
        };
    }
    patternsTopic() {
        return {
            topic: "patterns",
            gather: () => {
                const p = this.cardStore.stats.getStudyPatterns();
                if (p.bestDays.length === 0 && p.bestHours.length === 0) {
                    return "## Study Patterns\nNot enough review data to determine patterns.";
                }
                const bestDays = p.bestDays
                    .slice(0, 3)
                    .map((d) => `${DAY_NAMES[d.day]}: ${(d.successRate * 100).toFixed(0)}% success`)
                    .join(", ");
                const bestHours = p.bestHours
                    .slice(0, 3)
                    .map((h) => `${h.hour}:00: ${(h.successRate * 100).toFixed(0)}% success`)
                    .join(", ");
                return `## Study Patterns (last 30 days)
- Best days: ${bestDays}
- Best hours: ${bestHours}`;
            },
        };
    }
    overviewTopic() {
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
    getDueCount() {
        const archivedUids = this.hierarchy.getArchivedSourceUids();
        let allCards = this.flashcardManager.getAllFSRSCards();
        if (archivedUids.size > 0) {
            allCards = allCards.filter((c) => !c.sourceUid || !archivedUids.has(c.sourceUid));
        }
        return this.dayBoundary.getDueCards(allCards).length;
    }
}
