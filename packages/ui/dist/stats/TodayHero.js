import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useIcon } from "../hooks/use-icon";
export function TodayHero({ today, streak, dueTomorrow, totalCards, }) {
    return (_jsxs("div", { class: "ep:grid ep:grid-cols-2 sm:ep:grid-cols-3 lg:ep:grid-cols-6 ep:gap-2", children: [_jsx(StatCard, { label: "Studied today", value: today.studied, icon: "book-open" }), _jsx(StatCard, { label: "Minutes", value: today.minutes, icon: "clock" }), _jsx(StatCard, { label: "Correct", value: `${Math.round(today.correctRate * 100)}%`, icon: "check-circle", color: today.correctRate >= 0.8
                    ? "green"
                    : today.correctRate >= 0.6
                        ? "orange"
                        : "red" }), _jsx(StatCard, { label: "Current streak", value: `${streak.current}d`, icon: "flame", color: "orange" }), _jsx(StatCard, { label: "Due tomorrow", value: dueTomorrow, icon: "calendar" }), _jsx(StatCard, { label: "Total cards", value: totalCards, icon: "layers" })] }));
}
function StatCard({ label, value, icon, color, }) {
    const iconRef = useIcon(icon);
    const colorCls = color === "green"
        ? "ep:text-obs-green"
        : color === "orange"
            ? "ep:text-obs-orange"
            : color === "red"
                ? "ep:text-obs-error"
                : "ep:text-obs-interactive";
    return (_jsxs("div", { class: "ep:rounded-lg ep:border ep:border-obs-modifier-border ep:bg-obs-primary ep:p-3 ep:flex ep:flex-col ep:gap-1", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:gap-1.5 ep:text-obs-muted", children: [_jsx("span", { ref: iconRef, class: "[&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5" }), _jsx("span", { class: "ep:text-xs", children: label })] }), _jsx("span", { class: `ep:text-xl ep:font-bold ${colorCls}`, children: value })] }));
}
