import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { FSRS_COLORS } from "@true-recall/obsidian/helpers/fsrs-colors";
const CIRCUMFERENCE = 100;
const RADIUS = 15.91549430918954;
const STROKE_WIDTH = 5;
export function MiniDonut({ due, newCount, learning, total }) {
    const segments = [];
    let offset = 0;
    if (total > 0) {
        const duePercent = (due / total) * CIRCUMFERENCE;
        const newPercent = (newCount / total) * CIRCUMFERENCE;
        const learningPercent = (learning / total) * CIRCUMFERENCE;
        if (duePercent > 0) {
            segments.push({
                length: duePercent,
                offset,
                stroke: `var(${FSRS_COLORS.review.cssVar})`,
            });
            offset += duePercent;
        }
        if (newPercent > 0) {
            segments.push({
                length: newPercent,
                offset,
                stroke: `var(${FSRS_COLORS.new.cssVar})`,
            });
            offset += newPercent;
        }
        if (learningPercent > 0) {
            segments.push({
                length: learningPercent,
                offset,
                stroke: `var(${FSRS_COLORS.learning.cssVar})`,
            });
        }
    }
    return (_jsxs("svg", { viewBox: "0 0 36 36", width: "14", height: "14", class: "ep:shrink-0 ep:block", role: "img", "aria-label": "Progress", children: [_jsx("circle", { cx: 18, cy: 18, r: RADIUS, fill: "none", "stroke-width": STROKE_WIDTH, class: "true-recall-donut-bg" }), segments.map((seg, _i) => (_jsx("circle", { cx: 18, cy: 18, r: RADIUS, fill: "none", "stroke-width": STROKE_WIDTH, class: "true-recall-donut-segment", stroke: seg.stroke, "stroke-dasharray": `${seg.length} ${CIRCUMFERENCE - seg.length}`, "stroke-dashoffset": 25 - seg.offset }, seg.stroke)))] }));
}
