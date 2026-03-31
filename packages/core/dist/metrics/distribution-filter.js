import { State } from "ts-fsrs";
const INTERVAL_BUCKETS = [
    [0, 7, "0-7d"],
    [7, 14, "1-2w"],
    [14, 30, "2-4w"],
    [30, 60, "1-2m"],
    [60, 90, "2-3m"],
    [90, 180, "3-6m"],
    [180, 365, "6-12m"],
    [365, Infinity, "1y+"],
];
const STABILITY_BUCKETS = [
    [0, 1, "<1d"],
    [1, 3, "1-3d"],
    [3, 7, "3-7d"],
    [7, 14, "1-2w"],
    [14, 30, "2-4w"],
    [30, 60, "1-2m"],
    [60, 180, "2-6m"],
    [180, Infinity, "6m+"],
];
const DIFFICULTY_BUCKETS = [
    [1, 2, "1 (Easy)"],
    [2, 3, "2"],
    [3, 4, "3"],
    [4, 5, "4"],
    [5, 6, "5 (Medium)"],
    [6, 7, "6"],
    [7, 8, "7"],
    [8, 9, "8"],
    [9, 10, "9"],
    [10, 11, "10 (Hard)"],
];
function buildHistogram(values, buckets) {
    var _a;
    const total = values.length;
    const counts = new Map();
    for (const [, , label] of buckets) {
        counts.set(label, 0);
    }
    for (const value of values) {
        for (const [min, max, label] of buckets) {
            if (value >= min && value < max) {
                counts.set(label, ((_a = counts.get(label)) !== null && _a !== void 0 ? _a : 0) + 1);
                break;
            }
        }
    }
    return buckets.map(([min, max, label]) => {
        var _a;
        const count = (_a = counts.get(label)) !== null && _a !== void 0 ? _a : 0;
        return {
            label,
            min,
            max,
            count,
            percentage: total > 0 ? (count / total) * 100 : 0,
        };
    });
}
function calculateStats(values) {
    var _a, _b, _c, _d, _e;
    if (values.length === 0) {
        return { min: 0, max: 0, mean: 0, median: 0, stdDev: 0, count: 0 };
    }
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const min = (_a = sorted[0]) !== null && _a !== void 0 ? _a : 0;
    const max = (_b = sorted[n - 1]) !== null && _b !== void 0 ? _b : 0;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const median = n % 2 === 0
        ? (((_c = sorted[n / 2 - 1]) !== null && _c !== void 0 ? _c : 0) + ((_d = sorted[n / 2]) !== null && _d !== void 0 ? _d : 0)) / 2
        : ((_e = sorted[Math.floor(n / 2)]) !== null && _e !== void 0 ? _e : 0);
    const variance = sorted.map((v) => Math.pow((v - mean), 2)).reduce((a, b) => a + b, 0) / n;
    const stdDev = Math.sqrt(variance);
    return {
        min,
        max,
        mean: Math.round(mean * 100) / 100,
        median: Math.round(median * 100) / 100,
        stdDev: Math.round(stdDev * 100) / 100,
        count: n,
    };
}
function computeDistribution(values, buckets) {
    if (values.length === 0) {
        return {
            histogram: [],
            stats: { min: 0, max: 0, mean: 0, median: 0, stdDev: 0, count: 0 },
        };
    }
    return {
        histogram: buildHistogram(values, buckets),
        stats: calculateStats(values),
    };
}
export function getFilteredDistributions(cards) {
    const nonSuspended = cards.filter((c) => !c.fsrs.suspended);
    const intervalValues = nonSuspended
        .filter((c) => c.fsrs.state === State.Review)
        .map((c) => c.fsrs.scheduledDays);
    const stabilityValues = nonSuspended
        .filter((c) => c.fsrs.state !== State.New)
        .map((c) => c.fsrs.stability);
    const difficultyValues = nonSuspended
        .filter((c) => c.fsrs.state !== State.New)
        .map((c) => c.fsrs.difficulty);
    return {
        interval: computeDistribution(intervalValues, INTERVAL_BUCKETS),
        stability: computeDistribution(stabilityValues, STABILITY_BUCKETS),
        difficulty: computeDistribution(difficultyValues, DIFFICULTY_BUCKETS),
    };
}
