import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { QuickNoteEditorModal } from "@true-recall/obsidian/modals/study/quick-note-editor/QuickNoteEditorModal";
import { Clickable } from "@true-recall/obsidian/components/Clickable";
import { useApp, useIcon, usePlugin } from "@true-recall/obsidian/preact";
import { cn } from "@true-recall/obsidian/utils";
import { useCallback, useState } from "preact/hooks";
const NAV_ITEMS = [
    { id: "dashboard", label: "Dashboard", icon: "layout-dashboard" },
    { id: "add", label: "Add", icon: "plus" },
    { id: "stats", label: "Stats", icon: "bar-chart-3" },
    { id: "browse", label: "Browse", icon: "list" },
];
export function AppNavBar({ activeItem, collapsible = false }) {
    const plugin = usePlugin();
    const app = useApp();
    const [collapsed, setCollapsed] = useState(false);
    const chevronRef = useIcon(collapsed ? "chevron-down" : "chevron-up");
    const handleClick = useCallback((id) => __awaiter(this, void 0, void 0, function* () {
        if (id === activeItem)
            return;
        switch (id) {
            case "dashboard":
                yield plugin.openDashboard();
                break;
            case "add": {
                const modal = new QuickNoteEditorModal(app, plugin, { mode: "add" });
                yield modal.openAndWait();
                break;
            }
            case "stats":
                yield plugin.openStats();
                break;
            case "browse":
                yield plugin.openCardBrowser();
                break;
        }
    }), [app, plugin, activeItem]);
    return (_jsxs("nav", { class: "ep:shrink-0 ep:mt-2 ep:bg-obs-primary", children: [_jsx("div", { class: cn("ep:grid ep:transition-[grid-template-rows] ep:duration-300 ep:ease-in-out", collapsed ? "ep:grid-rows-[0fr]" : "ep:grid-rows-[1fr]"), children: _jsx("div", { class: "ep:overflow-hidden ep:min-h-0", children: _jsx("div", { class: "ep:flex ep:justify-center ep:gap-1 ep:px-2 ep:py-1.5", children: NAV_ITEMS.map((item) => (_jsx(NavBarItem, { item: item, isActive: item.id === activeItem, onClick: () => void handleClick(item.id) }, item.id))) }) }) }), collapsible && (_jsx(Clickable, { class: cn("ep:flex ep:items-center ep:justify-center ep:w-full ep:py-0.5", "ep:text-obs-faint ep:hover:text-obs-muted ep:transition-colors ep:duration-150", "ep:cursor-pointer"), onClick: () => setCollapsed((v) => !v), "aria-label": collapsed ? "Show navigation" : "Hide navigation", children: _jsx("span", { ref: chevronRef, class: cn("[&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5", "ep:transition-transform ep:duration-300") }) }))] }));
}
function NavBarItem({ item, isActive, onClick, }) {
    const iconRef = useIcon(item.icon);
    return (_jsxs(Clickable, { role: "tab", "aria-selected": isActive, class: cn("ep:flex ep:items-center ep:gap-1.5 ep:px-3 ep:py-1.5 ep:rounded-md ep:text-sm ep:transition-colors ep:duration-150", isActive
            ? "ep:bg-obs-interactive/15 ep:text-obs-interactive ep:font-semibold"
            : "ep:text-obs-muted ep:hover:text-obs-normal ep:hover:bg-obs-modifier-hover"), onClick: onClick, children: [_jsx("span", { ref: iconRef, class: "[&_svg]:ep:w-4 [&_svg]:ep:h-4" }), _jsx("span", { children: item.label })] }));
}
