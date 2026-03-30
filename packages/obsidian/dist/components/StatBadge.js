import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { cn } from "@true-recall/obsidian/utils";
export function StatBadge({ label, count, colorCls }) {
    return (_jsxs("div", { class: cn("ep:bg-surface-raised ep:rounded-md ep:p-2 ep:text-center", colorCls), children: [_jsx("div", { class: "ep:text-lg ep:font-bold", children: count }), _jsx("div", { class: "ep:text-ui-smaller ep:text-obs-muted", children: label })] }));
}
export function StatGrid({ children, columns = 2 }) {
    return (_jsx("div", { class: "ep:grid ep:gap-2", style: { gridTemplateColumns: `repeat(${columns}, 1fr)` }, children: children }));
}
