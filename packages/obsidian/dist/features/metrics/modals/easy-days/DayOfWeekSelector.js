import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const BASE_BTN = "ep:px-3 ep:py-1.5 ep:rounded-md ep:border ep:text-ui-small ep:font-medium ep:transition-colors";
const SELECTED_BTN = `${BASE_BTN} ep:bg-obs-interactive ep:text-obs-on-accent ep:border-obs-interactive`;
const UNSELECTED_BTN = `${BASE_BTN} ep:bg-transparent ep:border-obs-border ep:text-obs-normal ep:hover:bg-obs-modifier-hover`;
function DayButton({ name, isSelected, onToggle, }) {
    return (_jsx(Clickable, { class: isSelected ? SELECTED_BTN : UNSELECTED_BTN, onClick: onToggle, children: name }));
}
export function DayOfWeekSelector({ selectedDays, onToggleDay, }) {
    return (_jsxs("div", { class: "ep:mb-5", children: [_jsx("h4", { class: "ep:text-ui-small ep:font-semibold ep:mb-2 ep:text-obs-normal", children: "Recurring days" }), _jsx("p", { class: "ep:text-ui-smaller ep:text-obs-muted ep:mb-3", children: "Select days of the week with reduced workload" }), _jsx("div", { class: "ep:flex ep:gap-1.5 ep:flex-wrap", children: DAY_NAMES.map((name, index) => (_jsx(DayButton, { name: name, isSelected: selectedDays.has(index), onToggle: () => onToggleDay(index) }, index))) })] }));
}
