import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import { useComputed } from "@preact/signals";
import { allCardsArray, cards } from "@true-recall/obsidian/services/reactive-card-store";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useMemo } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";
const ACHIEVEMENT_DEFS = [
    {
        id: "streak-7",
        name: "Week Warrior",
        category: "streak",
        threshold: 7,
        icon: "\uD83D\uDD25",
    },
    {
        id: "streak-30",
        name: "Monthly Master",
        category: "streak",
        threshold: 30,
        icon: "\uD83D\uDD25",
    },
    {
        id: "streak-100",
        name: "Century Streak",
        category: "streak",
        threshold: 100,
        icon: "\uD83D\uDD25",
    },
    {
        id: "streak-365",
        name: "Year of Learning",
        category: "streak",
        threshold: 365,
        icon: "\uD83D\uDD25",
    },
    {
        id: "rev-100",
        name: "Getting Started",
        category: "reviews",
        threshold: 100,
        icon: "\uD83D\uDCDA",
    },
    {
        id: "rev-500",
        name: "Dedicated Learner",
        category: "reviews",
        threshold: 500,
        icon: "\uD83D\uDCDA",
    },
    {
        id: "rev-1000",
        name: "Knowledge Seeker",
        category: "reviews",
        threshold: 1000,
        icon: "\uD83D\uDCDA",
    },
    {
        id: "rev-5000",
        name: "Review Machine",
        category: "reviews",
        threshold: 5000,
        icon: "\uD83D\uDCDA",
    },
    {
        id: "rev-10000",
        name: "Grand Master",
        category: "reviews",
        threshold: 10000,
        icon: "\uD83D\uDCDA",
    },
    {
        id: "ret-80",
        name: "Solid Foundation",
        category: "retention",
        threshold: 80,
        icon: "\uD83E\uDDE0",
    },
    {
        id: "ret-85",
        name: "Sharp Mind",
        category: "retention",
        threshold: 85,
        icon: "\uD83E\uDDE0",
    },
    {
        id: "ret-90",
        name: "Memory Palace",
        category: "retention",
        threshold: 90,
        icon: "\uD83E\uDDE0",
    },
    {
        id: "ret-95",
        name: "Total Recall",
        category: "retention",
        threshold: 95,
        icon: "\uD83E\uDDE0",
    },
    {
        id: "col-50",
        name: "Card Collector",
        category: "collection",
        threshold: 50,
        icon: "\uD83C\uDCCF",
    },
    {
        id: "col-100",
        name: "Deck Builder",
        category: "collection",
        threshold: 100,
        icon: "\uD83C\uDCCF",
    },
    {
        id: "col-500",
        name: "Library Builder",
        category: "collection",
        threshold: 500,
        icon: "\uD83C\uDCCF",
    },
    {
        id: "col-1000",
        name: "Knowledge Archive",
        category: "collection",
        threshold: 1000,
        icon: "\uD83C\uDCCF",
    },
];
function computeAchievements(statsCalc, totalCards) {
    const longestStreak = statsCalc.getStreakInfo().longest;
    const allStats = statsCalc.getAllDailyStats();
    const totalReviews = Object.values(allStats).reduce((sum, s) => sum + s.reviewsCompleted, 0);
    const retention = statsCalc.getCollectionHealthSnapshot().averageRetention;
    return ACHIEVEMENT_DEFS.map((def) => {
        let current;
        switch (def.category) {
            case "streak":
                current = longestStreak;
                break;
            case "reviews":
                current = totalReviews;
                break;
            case "retention":
                current = retention;
                break;
            case "collection":
                current = totalCards;
                break;
        }
        return Object.assign(Object.assign({}, def), { current, unlocked: current >= def.threshold, progress: Math.min(current / def.threshold, 1) });
    });
}
function sortAchievements(achievements) {
    return [...achievements].sort((a, b) => {
        if (a.unlocked !== b.unlocked)
            return a.unlocked ? -1 : 1;
        if (a.unlocked && b.unlocked)
            return b.threshold - a.threshold;
        return b.progress - a.progress;
    });
}
export function AchievementsWidget({ source }) {
    const plugin = usePlugin();
    const config = useMemo(() => parseCodeblockConfig(source), [source]);
    const achievements = useComputed(() => {
        void cards.value;
        if (!plugin.sessionPersistence)
            return null;
        const statsCalc = new StatsCalculatorService(plugin.fsrsService, plugin.flashcardManager, plugin.sessionPersistence);
        const totalCards = allCardsArray.value.length;
        const all = computeAchievements(statsCalc, totalCards);
        const category = configValue(config, "category", "all");
        const filtered = category === "all" ? all : all.filter((a) => a.category === category);
        const showLocked = configValue(config, "showLocked", true);
        const visible = showLocked ? filtered : filtered.filter((a) => a.unlocked);
        const limit = configValue(config, "limit", 6);
        return sortAchievements(visible).slice(0, limit);
    }).value;
    if (!achievements) {
        return _jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: "Loading..." });
    }
    if (achievements.length === 0) {
        return (_jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: "Start reviewing to earn achievements!" }));
    }
    return (_jsx("div", { class: "ep:grid ep:grid-cols-2 ep:gap-2 ep:p-3", children: achievements.map((a) => (_jsxs("div", { class: `ep:flex ep:gap-2 ep:p-2 ep:rounded ep:text-xs ${a.unlocked ? "ep:bg-obs-green/5" : "ep:opacity-60"}`, title: a.unlocked ? `${a.name} - Earned!` : `${a.current}/${a.threshold}`, children: [_jsx("span", { class: "ep:text-base ep:leading-none", children: a.icon }), _jsxs("div", { class: "ep:flex ep:flex-col ep:flex-1 ep:min-w-0", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between ep:gap-1", children: [_jsx("span", { class: "ep:truncate ep:font-medium", children: a.name }), a.unlocked ? (_jsx("span", { class: "ep:text-obs-green ep:shrink-0", children: "\u2713" })) : (_jsxs("span", { class: "ep:text-obs-muted ep:shrink-0", children: [Math.round(a.progress * 100), "%"] }))] }), !a.unlocked && (_jsxs(_Fragment, { children: [_jsx("div", { class: "ep:h-1.5 ep:rounded-full ep:bg-obs-modifier-border ep:mt-1", children: _jsx("div", { class: "ep:h-full ep:rounded-full", style: {
                                            width: `${a.progress * 100}%`,
                                            backgroundColor: "var(--color-blue)",
                                        } }) }), _jsxs("span", { class: "ep:text-obs-muted ep:mt-0.5", children: [a.current, "/", a.threshold] })] }))] })] }, a.id))) }));
}
