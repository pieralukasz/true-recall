import { State } from "ts-fsrs";
import { MS_PER_DAY } from "@true-recall/core/constants";
import { computePriority } from "@true-recall/core/helpers/note-priority";
import { estimateStudyMinutes } from "@true-recall/core/helpers/time-estimate";
export function aggregateDashboardData(deps) {
    var _a, _b;
    const { allCards, streakCurrent, todaySummary, newCardsCap, reviewsCap, archivedSourceUids, } = deps;
    const now = new Date();
    let totalDue = 0;
    let totalNew = 0;
    let totalLearning = 0;
    let totalOverdue = 0;
    let totalCards = 0;
    const orphaned = { total: 0, new: 0, learning: 0, due: 0 };
    const noteMap = new Map();
    for (const card of allCards) {
        const fsrs = card.fsrs;
        if (archivedSourceUids === null || archivedSourceUids === void 0 ? void 0 : archivedSourceUids.has((_a = card.sourceUid) !== null && _a !== void 0 ? _a : ""))
            continue;
        if (fsrs.suspended ||
            (fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now))
            continue;
        totalCards++;
        const noteName = card.sourceNoteName;
        switch (fsrs.state) {
            case State.New:
                totalNew++;
                break;
            case State.Learning:
            case State.Relearning:
                totalLearning++;
                break;
            case State.Review:
                if (new Date(fsrs.due) <= now)
                    totalDue++;
                break;
        }
        if (!noteName) {
            orphaned.total++;
            switch (fsrs.state) {
                case State.New:
                    orphaned.new++;
                    break;
                case State.Learning:
                case State.Relearning:
                    orphaned.learning++;
                    break;
                case State.Review:
                    if (new Date(fsrs.due) <= now)
                        orphaned.due++;
                    break;
            }
            continue;
        }
        let entry = noteMap.get(noteName);
        if (!entry) {
            entry = {
                name: noteName,
                path: (_b = card.sourceNotePath) !== null && _b !== void 0 ? _b : null,
                due: 0,
                newCount: 0,
                learning: 0,
                total: 0,
                lastReview: null,
                overdueDays: 0,
                overdueCount: 0,
                projects: [],
            };
            noteMap.set(noteName, entry);
        }
        entry.total++;
        switch (fsrs.state) {
            case State.New:
                entry.newCount++;
                break;
            case State.Learning:
            case State.Relearning:
                entry.learning++;
                break;
            case State.Review: {
                const dueDate = new Date(fsrs.due);
                if (dueDate <= now) {
                    entry.due++;
                    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / MS_PER_DAY);
                    if (daysOverdue > 0) {
                        entry.overdueCount++;
                        entry.overdueDays = Math.max(entry.overdueDays, daysOverdue);
                    }
                    totalOverdue += daysOverdue > 0 ? 1 : 0;
                }
                break;
            }
        }
        if (fsrs.lastReview &&
            (!entry.lastReview || fsrs.lastReview > entry.lastReview)) {
            entry.lastReview = fsrs.lastReview;
        }
    }
    const notes = Array.from(noteMap.values()).map((partial) => {
        const estimatedMinutes = estimateStudyMinutes(partial.due, partial.newCount, partial.learning);
        const priority = computePriority(partial);
        return Object.assign(Object.assign({}, partial), { estimatedMinutes, priority, projects: [] });
    });
    const estimatedTotalMinutes = estimateStudyMinutes(totalDue, totalNew, totalLearning);
    return {
        notes,
        totalDue,
        totalNew,
        totalLearning,
        totalOverdue,
        totalCards,
        streak: streakCurrent,
        estimatedTotalMinutes,
        noteCount: noteMap.size,
        todayProgress: {
            studied: todaySummary.studied,
            minutes: todaySummary.minutes,
            newCards: todaySummary.newCards,
            newCardsCap: newCardsCap,
            reviewCards: todaySummary.reviewCards,
            reviewsCap: reviewsCap,
        },
        orphanedCards: orphaned,
    };
}
