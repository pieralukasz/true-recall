import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useCallback } from "preact/hooks";
export function CheckboxListItem({ label, itemKey, selectedSet, onToggle, }) {
    const checked = selectedSet.has(itemKey);
    const toggle = useCallback(() => {
        onToggle(itemKey, !checked);
    }, [checked, itemKey, onToggle]);
    return (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:p-2 ep:border-b ep:border-obs-border ep:last:border-b-0 ep:cursor-pointer ep:hover:bg-obs-modifier-hover", role: "option", tabIndex: 0, "aria-selected": checked, onClick: toggle, onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggle();
            }
        }, children: [_jsx("input", { type: "checkbox", class: "ep:w-4 ep:h-4 ep:accent-obs-interactive", checked: checked, onClick: (e) => e.stopPropagation(), onChange: toggle }), _jsx("span", { class: "ep:text-ui-small", children: label })] }));
}
