import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { FSRS_COLORS } from "@true-recall/obsidian/helpers/fsrs-colors";
import { h, render } from "preact";
const SPARKLINE_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
function sparkline(values) {
    const max = Math.max(1, ...values);
    return values
        .map((v) => {
        var _a;
        const idx = Math.round((v / max) * (SPARKLINE_CHARS.length - 1));
        return (_a = SPARKLINE_CHARS[idx]) !== null && _a !== void 0 ? _a : "▁";
    })
        .join("");
}
function NoteStatsTooltipContent({ stats }) {
    const retention = stats.retentionRate !== null
        ? `${Math.round(stats.retentionRate * 100)}%`
        : "—";
    const difficulty = stats.avgDifficulty.toFixed(1);
    const lapses = stats.avgLapses.toFixed(1);
    const lastDate = stats.lastReviewed
        ? new Date(stats.lastReviewed).toLocaleDateString()
        : "Never";
    const spark = sparkline(stats.futureDue);
    const hasUpcoming = stats.futureDue.some((v) => v > 0);
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-1.5 ep:text-xs ep:min-w-[180px]", children: [_jsxs("div", { class: "ep:grid ep:grid-cols-2 ep:gap-x-4 ep:gap-y-0.5", children: [_jsxs("span", { children: ["Retention:", " ", _jsx("strong", { style: { color: `var(${FSRS_COLORS.new.cssVar})` }, children: retention })] }), _jsxs("span", { children: ["Reviews: ", stats.reviewCount] }), _jsxs("span", { children: ["Last: ", lastDate] }), _jsxs("span", { children: ["Lapses: ", lapses] }), _jsxs("span", { children: ["Difficulty: ", difficulty] })] }), hasUpcoming && (_jsxs("div", { class: "ep:pt-1 ep:border-t ep:border-obs-modifier-border", children: [_jsx("span", { class: "ep:text-obs-muted", children: "Next 7d: " }), _jsx("span", { style: {
                            color: `var(${FSRS_COLORS.review.cssVar})`,
                            letterSpacing: "1px",
                        }, children: spark })] }))] }));
}
// ── Tooltip DOM management ──────────────────────────────────
let activeTooltip = null;
let hoverTimeout = null;
export function attachTooltipListeners(element, getStats) {
    element.addEventListener("mouseenter", () => {
        hoverTimeout = setTimeout(() => {
            void getStats().then((stats) => {
                if (!stats)
                    return;
                showTooltip(element, stats);
            });
        }, 300);
    });
    element.addEventListener("mouseleave", () => {
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            hoverTimeout = null;
        }
        hideTooltip();
    });
}
function showTooltip(anchor, stats) {
    hideTooltip();
    const tooltip = document.createElement("div");
    tooltip.className = "true-recall-note-tooltip";
    tooltip.style.cssText = `
		position: fixed;
		z-index: var(--layer-popover, 1000);
		padding: 8px 10px;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m, 6px);
		box-shadow: var(--shadow-s, 0 2px 8px rgba(0,0,0,0.15));
		pointer-events: none;
	`;
    render(h(NoteStatsTooltipContent, { stats }), tooltip);
    document.body.appendChild(tooltip);
    activeTooltip = tooltip;
    // Position above anchor
    const rect = anchor.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    let top = rect.top - tooltipRect.height - 6;
    let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
    // Keep within viewport
    if (top < 4)
        top = rect.bottom + 6;
    if (left < 4)
        left = 4;
    if (left + tooltipRect.width > window.innerWidth - 4) {
        left = window.innerWidth - tooltipRect.width - 4;
    }
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
}
function hideTooltip() {
    if (activeTooltip) {
        render(null, activeTooltip);
        activeTooltip.remove();
        activeTooltip = null;
    }
}
