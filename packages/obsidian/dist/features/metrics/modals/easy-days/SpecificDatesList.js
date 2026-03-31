import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
function formatDate(dateStr) {
    const date = new Date(`${dateStr}T00:00:00`);
    return date.toLocaleDateString(undefined, {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}
export function SpecificDatesList({ dates, dateInputValue, today, onDateInputChange, onAddDate, onRemoveDate, }) {
    const sortedDates = Array.from(dates).sort();
    return (_jsxs("div", { class: "ep:mb-5", children: [_jsx("h4", { class: "ep:text-ui-small ep:font-semibold ep:mb-2 ep:text-obs-normal", children: "Specific dates" }), _jsx("p", { class: "ep:text-ui-smaller ep:text-obs-muted ep:mb-3", children: "Add individual dates with reduced workload" }), _jsxs("div", { class: "ep:flex ep:gap-2 ep:mb-3", children: [_jsx("input", { type: "date", class: "ep:flex-1 ep:py-2 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small", min: today, value: dateInputValue, onChange: (e) => onDateInputChange(e.target.value) }), _jsx(Clickable, { class: "ep:px-4 ep:py-2 ep:rounded-md ep:bg-obs-interactive ep:text-obs-on-accent ep:border-none ep:text-ui-small ep:font-medium ep:hover:opacity-90", onClick: onAddDate, children: "+ add" })] }), _jsx("div", { class: "ep:border ep:border-obs-border ep:rounded-md ep:max-h-[150px] ep:overflow-y-auto", children: sortedDates.length === 0 ? (_jsx("div", { class: "ep:py-4 ep:px-3 ep:text-center ep:text-obs-muted ep:text-ui-smaller ep:italic", children: "No specific dates added" })) : (sortedDates.map((dateStr) => (_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between ep:py-2 ep:px-3 ep:border-b ep:border-obs-border ep:last:border-b-0", children: [_jsx("span", { class: "ep:text-ui-small ep:text-obs-normal", children: formatDate(dateStr) }), _jsx(Clickable, { class: "ep:w-6 ep:h-6 ep:rounded-md ep:bg-transparent ep:border-none ep:text-obs-muted ep:text-lg ep:hover:text-obs-red ep:hover:bg-obs-red/10", onClick: () => onRemoveDate(dateStr), children: "\u00D7" })] }, dateStr)))) })] }));
}
