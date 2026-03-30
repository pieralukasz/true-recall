import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { groupSources, stripMarkdown, } from "@true-recall/core/rag/retrieval/rag-source-grouper";
import { Clickable } from "@true-recall/obsidian/components";
import { useIcon } from "@true-recall/obsidian/preact";
import { useState } from "preact/hooks";
const FSRS_STATE_LABELS = {
    0: "new",
    1: "learning",
    2: "review",
    3: "relearning",
};
const INITIAL_VISIBLE = 8;
export function SourcePanel({ sources, navigation }) {
    const [expanded, setExpanded] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const grouped = groupSources(sources);
    const chevronRef = useIcon(expanded ? "chevron-down" : "chevron-right");
    const visible = showAll ? grouped : grouped.slice(0, INITIAL_VISIBLE);
    const hasMore = grouped.length > INITIAL_VISIBLE;
    return (_jsxs("div", { class: "ep:w-full", children: [_jsxs(Clickable, { class: "ep:flex ep:items-center ep:gap-1 ep:text-[11px] ep:text-obs-muted ep:hover:text-obs-normal ep:transition-colors ep:py-0.5", onClick: () => setExpanded((v) => !v), children: [_jsx("span", { ref: chevronRef, class: "ep:shrink-0 ep:flex ep:items-center [&_svg]:ep:w-3 [&_svg]:ep:h-3" }), _jsxs("span", { children: ["Sources (", grouped.length, ")"] })] }), expanded && (_jsxs("div", { class: "ep:mt-0.5 ep:flex ep:flex-col", children: [visible.map((g) => (_jsx(SourceRow, { group: g, navigation: navigation }, g.sourceId))), hasMore && !showAll && (_jsxs(Clickable, { class: "ep:text-[10px] ep:text-obs-muted ep:hover:text-obs-normal ep:pl-6 ep:py-1", onClick: () => setShowAll(true), children: ["Show ", grouped.length - INITIAL_VISIBLE, " more..."] }))] }))] }));
}
function SourceRow({ group, navigation }) {
    var _a, _b, _c, _d;
    const iconRef = useIcon(group.sourceType === "note" ? "file-text" : "brain");
    const heading = group.headings[0] ? stripMarkdown(group.headings[0]) : "";
    const snippet = ((_a = group.chunks[0]) === null || _a === void 0 ? void 0 : _a.content)
        ? stripMarkdown(group.chunks[0].content).slice(0, 80)
        : "";
    const fsrsState = group.sourceType === "flashcard" ? (_c = (_b = group.chunks[0]) === null || _b === void 0 ? void 0 : _b.fsrs) === null || _c === void 0 ? void 0 : _c.state : undefined;
    return (_jsxs(Clickable, { class: "ep:flex ep:items-start ep:gap-1.5 ep:px-2 ep:py-1.5 ep:rounded ep:hover:bg-obs-modifier-hover ep:transition-colors ep:cursor-pointer", onClick: () => {
            var _a;
            if (group.sourceType === "note") {
                navigation.onNavigateToNote(group.sourceId, (_a = group.headings[0]) !== null && _a !== void 0 ? _a : "");
            }
            else {
                navigation.onNavigateToCard(group.sourceId);
            }
        }, children: [_jsx("span", { ref: iconRef, class: "ep:shrink-0 ep:flex ep:items-center ep:mt-px ep:text-obs-muted [&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5" }), _jsxs("div", { class: "ep:flex ep:flex-col ep:min-w-0", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:gap-1 ep:min-w-0", children: [_jsx("span", { class: "ep:text-[11px] ep:font-medium ep:text-obs-normal ep:truncate ep:min-w-0 ep:shrink", children: group.displayName || "Untitled" }), heading && (_jsx("span", { class: "ep:text-[10px] ep:text-obs-faint ep:truncate ep:min-w-0 ep:shrink", children: heading })), fsrsState !== undefined && (_jsx("span", { class: "ep:text-[9px] ep:px-1 ep:rounded ep:bg-obs-modifier-hover ep:text-obs-muted ep:shrink-0", children: (_d = FSRS_STATE_LABELS[fsrsState]) !== null && _d !== void 0 ? _d : "unknown" }))] }), snippet && (_jsx("span", { class: "ep:text-[10px] ep:text-obs-faint ep:line-clamp-1", children: snippet }))] })] }));
}
