import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { useSignal } from "@preact/signals";
import { Clickable, SearchInput } from "@true-recall/obsidian/components";
import { FSRS_COLORS } from "@true-recall/obsidian/helpers/fsrs-colors";
import { useMemo } from "preact/hooks";
const STATE_ITEMS = [
    { key: "new", label: "New", dotCls: FSRS_COLORS.new.textCls },
    {
        key: "learning",
        label: "Learning",
        dotCls: FSRS_COLORS.learning.textCls,
    },
    { key: "review", label: "Review", dotCls: FSRS_COLORS.review.textCls },
    {
        key: "relearning",
        label: "Relearning",
        dotCls: FSRS_COLORS.relearning.textCls,
    },
    {
        key: "suspended",
        label: "Suspended",
        dotCls: FSRS_COLORS.suspended.textCls,
    },
    { key: "buried", label: "Buried", dotCls: "ep:text-obs-muted" },
];
const TYPE_LABELS = {
    basic: "Basic",
    cloze: "Cloze",
    reversed: "Reversed",
    "image-occlusion": "Image Occ.",
};
const VIA_LABELS = {
    manual: "Manual",
    ai: "AI",
    anki_import: "Anki Import",
};
export function BrowserSidebar({ facetCounts, activeFilter, onFilterChange, orphanedCount, onRemoveOrphanedCards, }) {
    return (_jsxs("div", { class: "ep:w-[200px] ep:shrink-0 ep:border-r ep:border-obs-border ep:overflow-y-auto ep:text-sm", children: [_jsx(SidebarSection, { title: "Card States", defaultOpen: true, children: STATE_ITEMS.map((item) => {
                    var _a;
                    const count = (_a = facetCounts.states[item.key]) !== null && _a !== void 0 ? _a : 0;
                    if (count === 0)
                        return null;
                    const active = activeFilter.states.includes(item.key);
                    return (_jsx(SidebarRow, { label: item.label, count: count, active: active, dotCls: item.dotCls, onClick: () => {
                            const states = active
                                ? activeFilter.states.filter((s) => s !== item.key)
                                : [
                                    ...activeFilter.states,
                                    item.key,
                                ];
                            onFilterChange({ states });
                        } }, item.key));
                }) }), _jsx(SourceNotesSection, { sourceNotes: facetCounts.sourceNotes, activeFilter: activeFilter, onFilterChange: onFilterChange, orphanedCount: orphanedCount, onRemoveOrphanedCards: onRemoveOrphanedCards }), _jsx(SidebarSection, { title: "Card Type", children: Object.entries(facetCounts.cardTypes).map(([type, count]) => {
                    var _a;
                    const active = activeFilter.cardTypes.includes(type);
                    return (_jsx(SidebarRow, { label: (_a = TYPE_LABELS[type]) !== null && _a !== void 0 ? _a : type, count: count, active: active, onClick: () => {
                            const cardTypes = active
                                ? activeFilter.cardTypes.filter((t) => t !== type)
                                : [
                                    ...activeFilter.cardTypes,
                                    type,
                                ];
                            onFilterChange({ cardTypes });
                        } }, type));
                }) }), _jsx(SidebarSection, { title: "Created Via", children: Object.entries(facetCounts.createdVia).map(([via, count]) => {
                    var _a;
                    const active = activeFilter.createdVia.includes(via);
                    return (_jsx(SidebarRow, { label: (_a = VIA_LABELS[via]) !== null && _a !== void 0 ? _a : via, count: count, active: active, onClick: () => {
                            const createdVia = active
                                ? activeFilter.createdVia.filter((v) => v !== via)
                                : [...activeFilter.createdVia, via];
                            onFilterChange({ createdVia });
                        } }, via));
                }) }), hasAnyFilter(activeFilter) && (_jsx("div", { class: "ep:px-3 ep:py-2 ep:border-t ep:border-obs-border", children: _jsx(Clickable, { class: "ep:text-[11px] ep:text-obs-interactive ep:underline", onClick: () => onFilterChange({
                        states: [],
                        sourceUids: [],
                        cardTypes: [],
                        createdVia: [],
                    }), children: "Clear all filters" }) }))] }));
}
function hasAnyFilter(f) {
    return (f.states.length > 0 ||
        f.sourceUids.length > 0 ||
        f.cardTypes.length > 0 ||
        f.createdVia.length > 0);
}
const PAGE_SIZE = 50;
function SourceNotesSection({ sourceNotes, activeFilter, onFilterChange, orphanedCount, onRemoveOrphanedCards, }) {
    const open = useSignal(true);
    const searchQuery = useSignal("");
    const visibleCount = useSignal(PAGE_SIZE);
    const filteredNotes = useMemo(() => {
        const query = searchQuery.value.toLowerCase().trim();
        if (!query)
            return sourceNotes;
        return sourceNotes.filter((note) => note.name.toLowerCase().includes(query));
    }, [sourceNotes, searchQuery.value]);
    const visibleNotes = filteredNotes.slice(0, visibleCount.value);
    const hasMore = visibleNotes.length < filteredNotes.length;
    const remainingCount = filteredNotes.length - visibleCount.value;
    const selectedCount = activeFilter.sourceUids.length;
    const handleSearchChange = (value) => {
        searchQuery.value = value;
        visibleCount.value = PAGE_SIZE;
    };
    const handleShowMore = () => {
        visibleCount.value += PAGE_SIZE;
    };
    return (_jsxs("div", { class: "ep:border-b ep:border-obs-border/50", children: [_jsxs(Clickable, { class: "ep:flex ep:items-center ep:justify-between ep:px-3 ep:py-2 hover:ep:bg-obs-modifier-hover ep:w-full", onClick: () => {
                    open.value = !open.value;
                }, children: [_jsx("span", { class: "ep:text-[11px] ep:font-medium ep:uppercase ep:tracking-wider ep:text-obs-muted", children: selectedCount > 0
                            ? `Source Notes (${selectedCount} selected)`
                            : "Source Notes" }), _jsx("span", { class: "ep:text-[10px] ep:text-obs-muted", children: open.value ? "\u25BE" : "\u25B8" })] }), open.value && (_jsxs("div", { class: "ep:pb-1.5", children: [_jsx("div", { class: "ep:px-2 ep:pb-1.5 ep:pt-1", children: _jsx(SearchInput, { size: "sm", placeholder: "Search notes...", ariaLabel: "Search source notes", value: searchQuery.value, onChange: handleSearchChange }) }), orphanedCount > 0 && (_jsx("div", { class: "ep:px-2 ep:pb-1.5", children: _jsxs(Clickable, { class: "ep:w-full ep:px-2 ep:py-1 ep:text-[11px] ep:rounded ep:border ep:border-obs-error/30 ep:text-obs-error hover:ep:bg-obs-error/10", onClick: onRemoveOrphanedCards, children: ["Remove orphaned cards (", orphanedCount, ")"] }) })), visibleNotes.length === 0 ? (_jsx("div", { class: "ep:px-3 ep:py-2 ep:text-[11px] ep:text-obs-muted ep:text-center", children: searchQuery.value.trim()
                            ? `No results for "${searchQuery.value.trim()}"`
                            : "No notes" })) : (_jsxs(_Fragment, { children: [visibleNotes.map((note) => {
                                const active = activeFilter.sourceUids.includes(note.uid);
                                return (_jsx(SidebarRow, { label: note.name, count: note.count, active: active, onClick: () => {
                                        const sourceUids = active
                                            ? activeFilter.sourceUids.filter((u) => u !== note.uid)
                                            : [...activeFilter.sourceUids, note.uid];
                                        onFilterChange({ sourceUids });
                                    } }, note.uid));
                            }), hasMore && (_jsxs(Clickable, { class: "ep:w-full ep:px-3 ep:py-1.5 ep:text-[11px] ep:text-obs-interactive ep:text-center hover:ep:bg-obs-modifier-hover", onClick: handleShowMore, children: ["Show more (", remainingCount, ")"] }))] }))] }))] }));
}
function SidebarSection({ title, defaultOpen = false, children, }) {
    const open = useSignal(defaultOpen);
    return (_jsxs("div", { class: "ep:border-b ep:border-obs-border/50", children: [_jsxs(Clickable, { class: "ep:flex ep:items-center ep:justify-between ep:px-3 ep:py-2 hover:ep:bg-obs-modifier-hover ep:w-full", onClick: () => {
                    open.value = !open.value;
                }, children: [_jsx("span", { class: "ep:text-[11px] ep:font-medium ep:uppercase ep:tracking-wider ep:text-obs-muted", children: title }), _jsx("span", { class: "ep:text-[10px] ep:text-obs-muted", children: open.value ? "\u25BE" : "\u25B8" })] }), open.value && _jsx("div", { class: "ep:pb-1.5", children: children })] }));
}
function SidebarRow({ label, count, active, dotCls, onClick, }) {
    return (_jsxs(Clickable, { class: `ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-1 ep:cursor-pointer hover:ep:bg-obs-modifier-hover ep:w-full ${active ? "ep:bg-obs-interactive/10" : ""}`, onClick: onClick, children: [dotCls && _jsx("span", { class: `ep:text-[8px] ${dotCls}`, children: "\u25CF" }), _jsx("span", { class: `ep:flex-1 ep:truncate ep:text-[12px] ${active ? "ep:text-obs-normal ep:font-medium" : "ep:text-obs-muted"}`, children: label }), _jsx("span", { class: "ep:text-[11px] ep:text-obs-faint ep:tabular-nums", children: count })] }));
}
