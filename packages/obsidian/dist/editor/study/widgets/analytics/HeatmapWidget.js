import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import { useComputed } from "@preact/signals";
import { cards } from "@true-recall/obsidian/services/reactive-card-store";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useMemo, useRef, useState } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";
const MONTH_NAMES = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];
const CELL_SIZE = 11;
const CELL_GAP = 2;
const CELL_TOTAL = CELL_SIZE + CELL_GAP;
const LEVEL_COLORS = [
    "var(--background-modifier-hover)",
    "var(--color-green)",
    "var(--color-green)",
    "var(--color-green)",
    "var(--color-green)",
];
const LEVEL_OPACITIES = [1, 0.3, 0.5, 0.7, 1];
export function HeatmapWidget({ source }) {
    const plugin = usePlugin();
    const [tooltip, setTooltip] = useState(null);
    const containerRef = useRef(null);
    const config = useMemo(() => parseCodeblockConfig(source), [source]);
    const data = useComputed(() => {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        void cards.value;
        if (!plugin.sessionPersistence)
            return null;
        const statsCalculator = new StatsCalculatorService(plugin.fsrsService, plugin.flashcardManager, plugin.sessionPersistence);
        const months = configValue(config, "months", 12);
        const allStats = statsCalculator.getAllDailyStats();
        const today = new Date();
        const startDate = new Date(today);
        if (months <= 0) {
            const dateKeys = Object.keys(allStats).sort();
            if (dateKeys.length > 0) {
                const firstKey = dateKeys[0];
                if (firstKey)
                    startDate.setTime(new Date(firstKey).getTime());
            }
        }
        else {
            startDate.setMonth(startDate.getMonth() - months);
        }
        // Align to Monday
        const startDay = startDate.getDay();
        const startMonday = startDay === 0 ? 6 : startDay - 1;
        startDate.setDate(startDate.getDate() - startMonday);
        const cells = [];
        let daysActive = 0;
        let totalReviews = 0;
        const counts = [];
        const cursor = new Date(startDate);
        while (cursor <= today) {
            const key = (_a = cursor.toISOString().split("T")[0]) !== null && _a !== void 0 ? _a : "";
            const stats = allStats[key];
            const count = (_b = stats === null || stats === void 0 ? void 0 : stats.reviewsCompleted) !== null && _b !== void 0 ? _b : 0;
            counts.push(count);
            if (count > 0)
                daysActive++;
            totalReviews += count;
            cursor.setDate(cursor.getDate() + 1);
        }
        // Calculate intensity levels using percentiles
        const nonZeroCounts = counts.filter((c) => c > 0).sort((a, b) => a - b);
        const p25 = (_c = nonZeroCounts[Math.floor(nonZeroCounts.length * 0.25)]) !== null && _c !== void 0 ? _c : 1;
        const p50 = (_d = nonZeroCounts[Math.floor(nonZeroCounts.length * 0.5)]) !== null && _d !== void 0 ? _d : 2;
        const p75 = (_e = nonZeroCounts[Math.floor(nonZeroCounts.length * 0.75)]) !== null && _e !== void 0 ? _e : 5;
        function getLevel(count) {
            if (count === 0)
                return 0;
            if (count <= p25)
                return 1;
            if (count <= p50)
                return 2;
            if (count <= p75)
                return 3;
            return 4;
        }
        // Build cells
        const resetCursor = new Date(startDate);
        let col = 0;
        const monthLabels = [];
        let lastMonth = -1;
        while (resetCursor <= today) {
            const key = (_f = resetCursor.toISOString().split("T")[0]) !== null && _f !== void 0 ? _f : "";
            const dayOfWeek = resetCursor.getDay();
            const row = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Mon=0 ... Sun=6
            const stats = allStats[key];
            const count = (_g = stats === null || stats === void 0 ? void 0 : stats.reviewsCompleted) !== null && _g !== void 0 ? _g : 0;
            // Track month labels
            const month = resetCursor.getMonth();
            if (month !== lastMonth && row === 0) {
                monthLabels.push({ label: (_h = MONTH_NAMES[month]) !== null && _h !== void 0 ? _h : "", col });
                lastMonth = month;
            }
            cells.push({ date: key, count, level: getLevel(count), row, col });
            // Advance to next day; increment col on Mondays
            resetCursor.setDate(resetCursor.getDate() + 1);
            if (resetCursor.getDay() === 1 ||
                (resetCursor.getDay() === 0 && row === 6)) {
                // Moved from Sunday to Monday -> new week
            }
            // Recalculate col from next day
            const nextDow = resetCursor.getDay();
            const nextRow = nextDow === 0 ? 6 : nextDow - 1;
            if (nextRow === 0 && resetCursor <= today) {
                col++;
            }
        }
        return { cells, monthLabels, daysActive, totalReviews, maxWeeks: col + 1 };
    }).value;
    if (!data) {
        return _jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: "Loading..." });
    }
    const showLegend = configValue(config, "showLegend", true);
    const showTotal = configValue(config, "showTotal", true);
    const svgWidth = data.maxWeeks * CELL_TOTAL + 30;
    const svgHeight = 7 * CELL_TOTAL + 20;
    const handleCellHover = (cell, e) => {
        var _a;
        const rect = (_a = containerRef.current) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect();
        if (!rect)
            return;
        setTooltip({
            cell,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top - 30,
        });
    };
    const handleCellLeave = () => {
        setTooltip(null);
    };
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm", ref: containerRef, style: { position: "relative" }, children: [_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between ep:text-xs", children: [_jsxs("span", { class: "ep:font-semibold", children: ["Activity (last ", configValue(config, "months", 12), " months)"] }), _jsxs("span", { class: "ep:text-obs-muted", children: [data.daysActive, " days active"] })] }), _jsx("div", { class: "ep:overflow-x-auto", children: _jsxs("svg", { width: svgWidth, height: svgHeight, style: { display: "block" }, role: "img", "aria-label": "Review activity heatmap", children: [data.monthLabels.map((ml) => (_jsx("text", { x: ml.col * CELL_TOTAL + 30, y: 10, fill: "var(--text-muted)", "font-size": "9", children: ml.label }, `${ml.label}-${ml.col}`))), data.cells.map((cell) => (
                        // biome-ignore lint/a11y/noStaticElementInteractions: SVG rects are decorative with hover tooltip only
                        _jsx("rect", { x: cell.col * CELL_TOTAL + 30, y: cell.row * CELL_TOTAL + 16, width: CELL_SIZE, height: CELL_SIZE, rx: 2, fill: LEVEL_COLORS[cell.level], opacity: LEVEL_OPACITIES[cell.level], onMouseEnter: (e) => handleCellHover(cell, e), onMouseLeave: handleCellLeave, style: { cursor: "pointer" } }, cell.date)))] }) }), _jsxs("div", { class: "ep:flex ep:items-center ep:justify-between ep:text-xs ep:text-obs-muted", children: [showLegend && (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-1", children: [_jsx("span", { children: "Less" }), [0, 1, 2, 3, 4].map((level) => (_jsx("div", { style: {
                                    width: `${CELL_SIZE}px`,
                                    height: `${CELL_SIZE}px`,
                                    borderRadius: "2px",
                                    backgroundColor: LEVEL_COLORS[level],
                                    opacity: LEVEL_OPACITIES[level],
                                } }, level))), _jsx("span", { children: "More" })] })), showTotal && _jsxs("span", { children: ["Total: ", data.totalReviews.toLocaleString()] })] }), tooltip && (_jsxs("div", { class: "ep:absolute ep:bg-obs-bg-secondary ep:border ep:border-obs-modifier-border ep:rounded ep:px-2 ep:py-1 ep:text-xs ep:shadow-md ep:z-10 ep:pointer-events-none", style: {
                    left: `${tooltip.x}px`,
                    top: `${tooltip.y}px`,
                    transform: "translateX(-50%)",
                }, children: [_jsxs("div", { class: "ep:font-semibold", children: [tooltip.cell.count, " reviews"] }), _jsx("div", { class: "ep:text-obs-muted", children: tooltip.cell.date })] }))] }));
}
