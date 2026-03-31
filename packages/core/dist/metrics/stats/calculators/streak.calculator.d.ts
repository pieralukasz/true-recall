/**
 * Streak Calculator
 * Calculates current and longest study streaks
 */
import type { ExtendedDailyStats } from "../../../types";
export interface StreakInfo {
    current: number;
    longest: number;
}
/**
 * Calculator for study streak statistics
 */
export declare class StreakCalculator {
    /**
     * Calculate streak information from daily stats
     */
    calculate(allStats: Record<string, ExtendedDailyStats>, dayStartHour?: number): StreakInfo;
    private calculateCurrentStreak;
    private calculateLongestStreak;
}
