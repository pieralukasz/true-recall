import { jsx as _jsx } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
import { cn } from "@true-recall/ui/utils/cn";
const TABS = [
    { id: "front", label: "Front Template" },
    { id: "back", label: "Back Template" },
    { id: "styling", label: "Styling" },
];
export function EditorTabs({ activeTab, onTabChange }) {
    return (_jsx("div", { class: "ep:flex ep:gap-1 ep:pt-3", role: "tablist", children: TABS.map(({ id, label }) => (_jsx(Clickable, { role: "tab", class: cn("ep:px-3 ep:py-1.5 ep:text-ui-small ep:rounded-t-md ep:transition-colors ep:border-b-2", activeTab === id
                ? "ep:text-obs-accent ep:border-obs-accent ep:bg-obs-accent/5"
                : "ep:text-obs-muted ep:border-transparent ep:hover:text-obs-normal ep:hover:bg-obs-hover"), onClick: () => onTabChange(id), children: label }, id))) }));
}
