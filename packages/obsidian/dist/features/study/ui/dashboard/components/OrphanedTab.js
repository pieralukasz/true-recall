import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { CardCountDisplay } from "@true-recall/obsidian/components/CardCountDisplay";
import { Clickable } from "@true-recall/obsidian/components/Clickable";
import { usePlugin } from "@true-recall/obsidian/preact";
export function OrphanedTab({ stats }) {
    const plugin = usePlugin();
    const handleViewInBrowser = () => {
        void plugin.openCardBrowser({ orphaned: true });
    };
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:items-center ep:justify-center ep:gap-4 ep:py-10 ep:text-center", children: [_jsx("div", { class: "ep:text-4xl ep:font-bold ep:text-obs-normal ep:tabular-nums", children: stats.total }), _jsxs("div", { class: "ep:text-sm ep:text-obs-muted", children: ["orphaned card", stats.total !== 1 ? "s" : "", " with no matching source note"] }), _jsx(CardCountDisplay, { newCount: stats.new, learningCount: stats.learning, dueCount: stats.due, size: "small" }), _jsx(Clickable, { class: "ep:mt-2 ep:px-4 ep:py-2 ep:rounded-md ep:text-sm ep:font-medium ep:bg-obs-interactive/15 ep:text-obs-interactive ep:hover:bg-obs-interactive/25 ep:transition-colors", onClick: handleViewInBrowser, children: "View in Card Browser" })] }));
}
