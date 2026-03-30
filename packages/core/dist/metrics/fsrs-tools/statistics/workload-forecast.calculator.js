/**
 * Workload Forecast Calculator
 *
 * Predicts future review workload based on current card scheduling.
 */
import { formatLocalDate } from "../../../utils";
import { State } from "ts-fsrs";
/**
 * Workload Forecast Calculator
 *
 * Analyzes scheduled cards to predict future workload,
 * helping users plan their study time.
 */
export class WorkloadForecastCalculator {
    constructor(cardStore) {
        this.cardStore = cardStore;
    }
    /**
     * Get workload forecast for the next N days
     */
    getForecast(days = 30) {
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + days);
        const cards = this.cardStore
            .getCards()
            .filter((c) => !c.suspended &&
            (!c.buriedUntil || new Date(c.buriedUntil) <= today) &&
            new Date(c.due) >= today &&
            new Date(c.due) <= endDate);
        // Build forecast by date
        const forecast = new Map();
        const currentDate = new Date(today);
        while (currentDate <= endDate) {
            forecast.set(formatLocalDate(currentDate), { review: 0, learning: 0 });
            currentDate.setDate(currentDate.getDate() + 1);
        }
        // Count cards by date and state
        for (const card of cards) {
            const dateStr = formatLocalDate(new Date(card.due));
            const existing = forecast.get(dateStr);
            if (existing) {
                // State.New = 0 (not counted in forecast)
                // State.Learning = 1, State.Relearning = 3
                // State.Review = 2
                if (card.state === State.Review) {
                    existing.review++;
                }
                else if (card.state === State.Learning ||
                    card.state === State.Relearning) {
                    existing.learning++;
                }
            }
        }
        // Convert to entries
        const entries = [];
        for (const [date, breakdown] of forecast) {
            entries.push({
                date,
                dueCount: breakdown.review + breakdown.learning,
                breakdown,
            });
        }
        return entries.sort((a, b) => a.date.localeCompare(b.date));
    }
    /**
     * Get summary statistics for the forecast
     */
    getSummary(targetPerDay, days = 30) {
        var _a, _b;
        const forecast = this.getForecast(days);
        if (forecast.length === 0) {
            return {
                avgDaily: 0,
                peakDay: { date: "", count: 0 },
                minDay: { date: "", count: 0 },
                daysAboveTarget: 0,
                needsBalancing: false,
            };
        }
        // Calculate statistics
        let total = 0;
        let peakDay = (_a = forecast[0]) !== null && _a !== void 0 ? _a : {
            date: "",
            dueCount: 0,
            breakdown: { review: 0, learning: 0 },
        };
        let minDay = (_b = forecast[0]) !== null && _b !== void 0 ? _b : {
            date: "",
            dueCount: 0,
            breakdown: { review: 0, learning: 0 },
        };
        let daysAboveTarget = 0;
        for (const entry of forecast) {
            total += entry.dueCount;
            if (entry.dueCount > peakDay.dueCount) {
                peakDay = entry;
            }
            if (entry.dueCount < minDay.dueCount) {
                minDay = entry;
            }
            if (entry.dueCount > targetPerDay) {
                daysAboveTarget++;
            }
        }
        const avgDaily = total / forecast.length;
        // Determine if balancing is recommended
        // (if peak is more than 50% above average, or more than 20% of days exceed target)
        const needsBalancing = peakDay.dueCount > avgDaily * 1.5 ||
            daysAboveTarget > forecast.length * 0.2;
        return {
            avgDaily: Math.round(avgDaily),
            peakDay: { date: peakDay.date, count: peakDay.dueCount },
            minDay: { date: minDay.date, count: minDay.dueCount },
            daysAboveTarget,
            needsBalancing,
        };
    }
    /**
     * Get cumulative workload (total reviews needed by each date)
     */
    getCumulativeForecast(days = 30) {
        const forecast = this.getForecast(days);
        let cumulative = 0;
        return forecast.map((entry) => {
            cumulative += entry.dueCount;
            return {
                date: entry.date,
                cumulative,
            };
        });
    }
    /**
     * Get workload by day of week
     */
    getWorkloadByDayOfWeek(days = 30) {
        var _a;
        const forecast = this.getForecast(days);
        // Group by day of week
        const byDay = new Map();
        for (let i = 0; i < 7; i++) {
            byDay.set(i, []);
        }
        for (const entry of forecast) {
            const dayOfWeek = new Date(entry.date).getDay();
            (_a = byDay.get(dayOfWeek)) === null || _a === void 0 ? void 0 : _a.push(entry.dueCount);
        }
        const dayNames = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
        ];
        return Array.from(byDay.entries())
            .map(([day, counts]) => {
            var _a;
            return ({
                day,
                dayName: (_a = dayNames[day]) !== null && _a !== void 0 ? _a : "Unknown",
                avgCount: counts.length > 0
                    ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)
                    : 0,
            });
        })
            .sort((a, b) => a.day - b.day);
    }
}
