import type { StreakInfo, TodaySummary } from "@true-recall/core";
interface TodayHeroProps {
    today: TodaySummary;
    streak: StreakInfo;
    dueTomorrow: number;
    dailyLoad: number;
    totalCards: number;
}
export declare function TodayHero({ today, streak, dueTomorrow, totalCards, }: TodayHeroProps): import("preact").JSX.Element;
export {};
