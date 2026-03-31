/**
 * True Retention Calculator
 *
 * Calculates actual retention rate based on review history,
 * focusing only on mature cards (Review state) for accuracy.
 */
import { formatLocalDate } from "../../../utils";
/**
 * True Retention Calculator
 *
 * Unlike simple retention (all cards), true retention only counts
 * reviews on mature cards (state = Review, interval >= 21 days).
 * This gives a more accurate picture of long-term memory retention.
 */
export class TrueRetentionCalculator {
    constructor(cardStore) {
        this.cardStore = cardStore;
    }
    /**
     * Calculate true retention for a date range
     */
    calculate(startDate, endDate, presetNames) {
        var _a;
        const reviews = this.cardStore.getReviewsForRetention(startDate, endDate, presetNames);
        // Group by date
        const byDate = new Map();
        for (const review of reviews) {
            const dateStr = review.date;
            const existing = (_a = byDate.get(dateStr)) !== null && _a !== void 0 ? _a : { success: 0, total: 0 };
            existing.total++;
            if (review.rating >= 3) {
                // Good or Easy = success
                existing.success++;
            }
            byDate.set(dateStr, existing);
        }
        // Convert to entries
        const entries = [];
        for (const [date, stats] of byDate) {
            entries.push({
                date,
                retention: stats.total > 0 ? stats.success / stats.total : 0,
                reviewCount: stats.total,
            });
        }
        return entries.sort((a, b) => a.date.localeCompare(b.date));
    }
    /**
     * Get summary statistics
     */
    getSummary(targetRetention, days = 30, presetNames) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const entries = this.calculate(formatLocalDate(startDate), formatLocalDate(endDate), presetNames);
        return this.buildSummary(entries, targetRetention);
    }
    getSummaryAndRolling(targetRetention, days = 30, window = 7, presetNames) {
        const endDate = new Date();
        const summaryStartDate = new Date(endDate);
        summaryStartDate.setDate(summaryStartDate.getDate() - days);
        const rollingStartDate = new Date(endDate);
        rollingStartDate.setDate(rollingStartDate.getDate() - days - window);
        const combinedEntries = this.calculate(formatLocalDate(rollingStartDate), formatLocalDate(endDate), presetNames);
        const summaryStartKey = formatLocalDate(summaryStartDate);
        const summaryEntries = combinedEntries.filter((entry) => entry.date >= summaryStartKey);
        return {
            summary: this.buildSummary(summaryEntries, targetRetention),
            history: this.buildRollingAverage(combinedEntries, window),
        };
    }
    buildSummary(entries, targetRetention) {
        if (entries.length === 0) {
            return {
                current: 0,
                target: targetRetention,
                trend: 0,
                average: 0,
                totalReviews: 0,
            };
        }
        // Calculate average
        let totalRetention = 0;
        let totalReviews = 0;
        for (const entry of entries) {
            totalRetention += entry.retention * entry.reviewCount;
            totalReviews += entry.reviewCount;
        }
        const average = totalReviews > 0 ? totalRetention / totalReviews : 0;
        const recentEntries = entries.slice(-7);
        let recentTotal = 0;
        let recentSuccess = 0;
        for (const entry of recentEntries) {
            recentTotal += entry.reviewCount;
            recentSuccess += entry.retention * entry.reviewCount;
        }
        const current = recentTotal > 0 ? recentSuccess / recentTotal : 0;
        // Calculate trend (compare first half vs second half)
        const midpoint = Math.floor(entries.length / 2);
        const firstHalf = entries.slice(0, midpoint);
        const secondHalf = entries.slice(midpoint);
        let firstHalfAvg = 0;
        let firstHalfTotal = 0;
        for (const entry of firstHalf) {
            firstHalfAvg += entry.retention * entry.reviewCount;
            firstHalfTotal += entry.reviewCount;
        }
        firstHalfAvg = firstHalfTotal > 0 ? firstHalfAvg / firstHalfTotal : 0;
        let secondHalfAvg = 0;
        let secondHalfTotal = 0;
        for (const entry of secondHalf) {
            secondHalfAvg += entry.retention * entry.reviewCount;
            secondHalfTotal += entry.reviewCount;
        }
        secondHalfAvg = secondHalfTotal > 0 ? secondHalfAvg / secondHalfTotal : 0;
        let trend = 0;
        const diff = secondHalfAvg - firstHalfAvg;
        if (diff > 0.02)
            trend = 1; // Improving
        if (diff < -0.02)
            trend = -1; // Declining
        return {
            current,
            target: targetRetention,
            trend,
            average,
            totalReviews,
        };
    }
    /**
     * Get rolling average retention
     */
    getRollingAverage(days = 30, window = 7, presetNames) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days - window);
        const entries = this.calculate(formatLocalDate(startDate), formatLocalDate(endDate), presetNames);
        return this.buildRollingAverage(entries, window);
    }
    buildRollingAverage(entries, window) {
        var _a, _b;
        if (entries.length < window)
            return entries;
        // Calculate rolling average
        const result = [];
        for (let i = window - 1; i < entries.length; i++) {
            const windowEntries = entries.slice(i - window + 1, i + 1);
            let totalRetention = 0;
            let totalReviews = 0;
            for (const entry of windowEntries) {
                totalRetention += entry.retention * entry.reviewCount;
                totalReviews += entry.reviewCount;
            }
            result.push({
                date: (_b = (_a = entries[i]) === null || _a === void 0 ? void 0 : _a.date) !== null && _b !== void 0 ? _b : "",
                retention: totalReviews > 0 ? totalRetention / totalReviews : 0,
                reviewCount: totalReviews,
            });
        }
        return result;
    }
}
