import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { IOCardRenderer } from "@true-recall/obsidian/features/image-occlusion/IOCardRenderer";
import { LivePreviewField } from "@true-recall/obsidian/features/study/ui/review/components/LivePreviewField";
import { Clickable } from "@true-recall/obsidian/components";
import { FSRS_COLORS, MUTED_STATES } from "@true-recall/obsidian/helpers/fsrs-colors";
import { useApp } from "@true-recall/obsidian/preact/ObsidianContext";
import { State } from "ts-fsrs";
const STATE_LABELS = {
    [State.New]: "New",
    [State.Learning]: "Learning",
    [State.Review]: "Review",
    [State.Relearning]: "Relearning",
};
export function CardPreview({ card, onClose, onContentChange, }) {
    var _a, _b, _c, _d, _e;
    const app = useApp();
    const isImageOcclusion = card.cardType === "image-occlusion" &&
        !!card.ioImagePath &&
        !!card.ioRegionsJson;
    const stateLabel = card.suspended
        ? "Suspended"
        : card.buriedUntil && new Date(card.buriedUntil) > new Date()
            ? "Buried"
            : ((_a = STATE_LABELS[card.state]) !== null && _a !== void 0 ? _a : "Unknown");
    const stateColors = card.suspended
        ? FSRS_COLORS.suspended
        : card.buriedUntil && new Date(card.buriedUntil) > new Date()
            ? null
            : (() => {
                var _a;
                const key = (_a = STATE_LABELS[card.state]) === null || _a === void 0 ? void 0 : _a.toLowerCase();
                return key ? FSRS_COLORS[key] : null;
            })();
    const badgeCls = (_b = stateColors === null || stateColors === void 0 ? void 0 : stateColors.badgeCls) !== null && _b !== void 0 ? _b : MUTED_STATES.buried.badgeCls;
    return (_jsxs("div", { class: "ep:w-[320px] ep:border-l ep:border-obs-border ep:flex ep:flex-col ep:shrink-0 ep:overflow-y-auto ep:bg-obs-primary", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between ep:px-4 ep:py-3 ep:border-b ep:border-obs-border", children: [_jsx("span", { class: `ep:px-2 ep:py-0.5 ep:rounded-full ep:text-[11px] ep:font-medium ${badgeCls}`, children: stateLabel }), _jsx(Clickable, { class: "ep:p-1 ep:rounded hover:ep:bg-obs-modifier-hover ep:text-obs-muted", onClick: onClose, children: _jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "aria-hidden": "true", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }), _jsxs("div", { class: "ep:px-4 ep:py-3 ep:border-b ep:border-obs-border/50", children: [_jsx("div", { class: "ep:text-[10px] ep:uppercase ep:tracking-wider ep:text-obs-muted ep:mb-1.5", children: "Question" }), isImageOcclusion ? (_jsx(IOCardRenderer, { imagePath: card.ioImagePath, regionsJson: card.ioRegionsJson, templateOrd: card.templateOrd, revealed: false })) : card.question ? (_jsx(LivePreviewField, { content: card.question, field: "question", sourcePath: (_c = card.sourceNotePath) !== null && _c !== void 0 ? _c : "", cls: "true-recall-card-preview-markdown", onContentChange: onContentChange })) : (_jsx("div", { class: "ep:text-sm ep:text-obs-muted ep:italic", children: "No question" }))] }), _jsxs("div", { class: "ep:px-4 ep:py-3 ep:border-b ep:border-obs-border/50", children: [_jsx("div", { class: "ep:text-[10px] ep:uppercase ep:tracking-wider ep:text-obs-muted ep:mb-1.5", children: "Answer" }), isImageOcclusion ? (_jsx(IOCardRenderer, { imagePath: card.ioImagePath, regionsJson: card.ioRegionsJson, templateOrd: card.templateOrd, revealed: true })) : card.answer ? (_jsx(LivePreviewField, { content: card.answer, field: "answer", sourcePath: (_d = card.sourceNotePath) !== null && _d !== void 0 ? _d : "", cls: "true-recall-card-preview-markdown", onContentChange: onContentChange })) : (_jsx("div", { class: "ep:text-sm ep:text-obs-muted ep:italic", children: "No answer" }))] }), _jsxs("div", { class: "ep:px-4 ep:py-3 ep:border-b ep:border-obs-border/50", children: [_jsx("div", { class: "ep:text-[10px] ep:uppercase ep:tracking-wider ep:text-obs-muted ep:mb-2", children: "FSRS Statistics" }), _jsxs("div", { class: "ep:grid ep:grid-cols-2 ep:gap-x-4 ep:gap-y-1.5 ep:text-sm", children: [_jsx(StatRow, { label: "Stability", value: formatStability(card.stability) }), _jsx(StatRow, { label: "Difficulty", value: card.difficulty.toFixed(2) }), _jsx(StatRow, { label: "Reviews", value: String(card.reps) }), _jsx(StatRow, { label: "Lapses", value: String(card.lapses) }), _jsx(StatRow, { label: "Interval", value: `${card.scheduledDays}d` }), _jsx(StatRow, { label: "Last Review", value: card.lastReview
                                    ? new Date(card.lastReview).toLocaleDateString()
                                    : "Never" })] })] }), _jsxs("div", { class: "ep:px-4 ep:py-3", children: [_jsx("div", { class: "ep:text-[10px] ep:uppercase ep:tracking-wider ep:text-obs-muted ep:mb-2", children: "Card Info" }), _jsxs("div", { class: "ep:flex ep:flex-col ep:gap-1.5 ep:text-sm", children: [card.sourceNoteName && (_jsxs("div", { class: "ep:flex ep:justify-between ep:items-center", children: [_jsx("span", { class: "ep:text-obs-muted", children: "Source" }), _jsx(Clickable, { class: "ep:text-obs-accent ep:truncate ep:max-w-[180px] hover:ep:underline", onClick: () => {
                                            var _a, _b;
                                            return void app.workspace.openLinkText((_b = (_a = card.sourceNotePath) !== null && _a !== void 0 ? _a : card.sourceNoteName) !== null && _b !== void 0 ? _b : "", "", false);
                                        }, children: card.sourceNoteName })] })), _jsx(MetaRow, { label: "Type", value: card.cardType }), _jsx(MetaRow, { label: "Created", value: (_e = card.createdVia) !== null && _e !== void 0 ? _e : "manual" }), card.presetName && (_jsx(MetaRow, { label: "Preset", value: card.presetName })), card.projects.length > 0 && (_jsx(MetaRow, { label: "Projects", value: card.projects.join(", ") }))] })] })] }));
}
function StatRow({ label, value }) {
    return (_jsxs(_Fragment, { children: [_jsx("span", { class: "ep:text-obs-muted", children: label }), _jsx("span", { class: "ep:text-obs-normal ep:text-right", children: value })] }));
}
function MetaRow({ label, value }) {
    return (_jsxs("div", { class: "ep:flex ep:justify-between ep:items-center", children: [_jsx("span", { class: "ep:text-obs-muted", children: label }), _jsx("span", { class: "ep:text-obs-normal", children: value })] }));
}
function formatStability(days) {
    if (days === 0)
        return "0";
    if (days < 1)
        return `${Math.round(days * 24)}h`;
    if (days < 30)
        return `${Math.round(days)}d`;
    if (days < 365)
        return `${(days / 30).toFixed(1)} months`;
    return `${(days / 365).toFixed(1)} years`;
}
