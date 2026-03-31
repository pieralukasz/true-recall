import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components/Clickable";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useCallback } from "preact/hooks";
import { MiniDonut } from "./MiniDonut";
export function RecentlyStudiedBar({ notes }) {
    const plugin = usePlugin();
    const handleClick = useCallback((note) => {
        if (note.priority === "done" && note.path) {
            void plugin.app.workspace.openLinkText(note.name, "");
        }
        else {
            void plugin.openReviewViewWithFilters({
                sourceNoteFilter: note.name,
                ignoreDailyLimits: true,
            });
        }
    }, [plugin]);
    if (notes.length === 0)
        return null;
    return (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:px-1 ep:overflow-hidden", children: [_jsx("span", { class: "ep:text-sm ep:text-obs-muted ep:shrink-0 ep:py-1", children: "Recently Studied" }), _jsx("div", { class: "ep:flex ep:items-center ep:gap-1.5 ep:overflow-x-auto ep:min-w-0", children: notes.map((note) => (_jsxs(Clickable, { class: "ep:shrink-0 ep:inline-flex ep:items-center ep:gap-1.5 ep:pl-1.5 ep:pr-2.5 ep:py-0.5 ep:text-xs ep:text-obs-muted ep:rounded-full ep:bg-obs-modifier-hover/50 ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:transition-colors ep:max-w-[200px]", onClick: () => handleClick(note), title: `${note.due} due, ${note.newCount} new, ${note.learning} learning / ${note.total} total`, children: [_jsx(MiniDonut, { due: note.due, newCount: note.newCount, learning: note.learning, total: note.total }), _jsx("span", { class: "ep:truncate", children: note.name })] }, note.name))) })] }));
}
