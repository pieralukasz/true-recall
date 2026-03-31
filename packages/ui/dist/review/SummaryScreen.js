import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { Clickable } from "../shared/Clickable";
import { useEffect } from "preact/hooks";
function StatItem({ label, value, colorCls, }) {
    return (_jsxs("div", { class: "ep:p-3 ep:bg-obs-secondary ep:rounded-lg", children: [_jsx("div", { class: "ep:text-ui-smaller ep:text-obs-muted ep:mb-1", children: label }), _jsx("div", { class: `ep:text-xl ep:font-semibold ep:text-obs-normal ${colorCls !== null && colorCls !== void 0 ? colorCls : ""}`, children: value })] }));
}
export function SummaryScreen({ review, isCustomSession, continuousCustomReviews, onClose, onNextSession, }) {
    const stats = review.getStats();
    const durationMin = Math.floor(stats.duration / 60000);
    const durationSec = Math.floor((stats.duration % 60000) / 1000);
    // End session to capture final stats (once on mount)
    useEffect(() => {
        if (review.isActive) {
            review.endSession();
        }
    }, []); // intentionally fire once on mount
    return (_jsx("div", { class: "true-recall-review ep:flex ep:flex-col ep:h-full ep:p-0", children: _jsx("div", { class: "true-recall-review-card-container ep:flex-1 ep:min-h-0 ep:flex ep:items-start ep:justify-center ep:pt-4 ep:px-6 ep:pb-2 ep:overflow-y-auto", children: _jsxs("div", { class: "ep:text-center ep:py-8 ep:px-6 ep:max-w-md ep:mx-auto", children: [_jsx("h2", { class: "ep:text-2xl ep:m-0 ep:mb-6 ep:text-obs-normal", children: "Session complete!" }), _jsxs("div", { class: "ep:grid ep:grid-cols-2 ep:gap-3 ep:mb-6", children: [_jsx(StatItem, { label: "Total reviewed", value: stats.reviewed.toString() }), _jsx(StatItem, { label: "Again", value: stats.again.toString(), colorCls: "ep:text-obs-red" }), _jsx(StatItem, { label: "Hard", value: stats.hard.toString(), colorCls: "ep:text-obs-orange" }), _jsx(StatItem, { label: "Good", value: stats.good.toString(), colorCls: "ep:text-obs-green" }), _jsx(StatItem, { label: "Easy", value: stats.easy.toString(), colorCls: "ep:text-obs-cyan" }), _jsx(StatItem, { label: "Duration", value: `${durationMin}m ${durationSec}s` })] }), _jsx("div", { class: "ep:flex ep:gap-3 ep:py-4 ep:justify-center", children: isCustomSession && continuousCustomReviews ? (_jsxs(_Fragment, { children: [_jsx(Clickable, { stopPropagation: false, class: "ep-btn mod-cta", onClick: onNextSession, children: "Next session" }), _jsx(Clickable, { stopPropagation: false, class: "ep-btn ep-btn-outline", onClick: onClose, children: "Finish" })] })) : (_jsx(Clickable, { stopPropagation: false, class: "ep-btn mod-cta", onClick: onClose, children: "Close" })) })] }) }) }));
}
