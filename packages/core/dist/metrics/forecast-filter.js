import { State } from "ts-fsrs";
/**
 * Build forecast entries from a pre-filtered card list.
 * Mirrors WorkloadForecastCalculator.getForecast() logic
 * but works on any card subset (e.g. filtered by preset).
 */
export function buildFilteredForecast(cards, days = 30) {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);
    const eligible = cards.filter((c) => !c.suspended &&
        (!c.buriedUntil || new Date(c.buriedUntil) <= today) &&
        new Date(c.due) >= today &&
        new Date(c.due) <= endDate);
    const forecast = new Map();
    const current = new Date(today);
    while (current <= endDate) {
        forecast.set(formatDate(current), { review: 0, learning: 0 });
        current.setDate(current.getDate() + 1);
    }
    for (const card of eligible) {
        const dateStr = formatDate(new Date(card.due));
        const bucket = forecast.get(dateStr);
        if (!bucket)
            continue;
        if (card.state === State.Review) {
            bucket.review++;
        }
        else if (card.state === State.Learning ||
            card.state === State.Relearning) {
            bucket.learning++;
        }
    }
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
export function buildForecastSummary(forecast, targetPerDay) {
    if (forecast.length === 0) {
        return {
            avgDaily: 0,
            peakDay: { date: "", count: 0 },
            minDay: { date: "", count: 0 },
            daysAboveTarget: 0,
            needsBalancing: false,
        };
    }
    let total = 0;
    const first = forecast[0];
    if (!first)
        return {
            avgDaily: 0,
            peakDay: { date: "", count: 0 },
            minDay: { date: "", count: 0 },
            daysAboveTarget: 0,
            needsBalancing: false,
        };
    let peakDay = first;
    let minDay = first;
    let daysAboveTarget = 0;
    for (const entry of forecast) {
        total += entry.dueCount;
        if (entry.dueCount > peakDay.dueCount)
            peakDay = entry;
        if (entry.dueCount < minDay.dueCount)
            minDay = entry;
        if (entry.dueCount > targetPerDay)
            daysAboveTarget++;
    }
    const avgDaily = total / forecast.length;
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
export function buildDayOfWeekStats(forecast) {
    var _a;
    const byDay = new Map();
    for (let i = 0; i < 7; i++)
        byDay.set(i, []);
    for (const entry of forecast) {
        const dow = new Date(entry.date).getDay();
        (_a = byDay.get(dow)) === null || _a === void 0 ? void 0 : _a.push(entry.dueCount);
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
function formatDate(date) {
    var _a;
    return (_a = date.toISOString().split("T")[0]) !== null && _a !== void 0 ? _a : "";
}
