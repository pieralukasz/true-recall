import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
import { cn } from "@true-recall/ui/utils/cn";
export function BottomBar({ readOnly, showFields, onToggleFields, onFlip, onClose, }) {
    return (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:pt-3 ep:border-t ep:border-obs-border", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2", children: [!readOnly && (_jsxs(_Fragment, { children: [_jsxs(Clickable, { class: cn("ep:px-3 ep:py-1.5 ep:text-ui-small ep:rounded ep:border ep:border-obs-border ep:transition-colors", showFields
                                    ? "ep:bg-obs-accent/10 ep:text-obs-accent ep:border-obs-accent"
                                    : "ep:text-obs-muted ep:hover:bg-obs-hover"), onClick: onToggleFields, children: ["Fields ", showFields ? "▴" : "▾"] }), _jsx(Clickable, { class: "ep:px-3 ep:py-1.5 ep:text-ui-small ep:text-obs-muted ep:rounded ep:border ep:border-obs-border ep:hover:bg-obs-hover ep:transition-colors", onClick: onFlip, children: "Flip" })] })), readOnly && (_jsx("span", { class: "ep:text-ui-smaller ep:text-obs-muted ep:italic", children: "Built-in note type (read-only)" }))] }), _jsx("div", { class: "ep:flex-1" }), _jsx(Clickable, { class: "ep:px-4 ep:py-1.5 ep:text-ui-small ep:text-obs-muted ep:hover:text-obs-normal ep:rounded ep:transition-colors", onClick: onClose, children: "Close" })] }));
}
