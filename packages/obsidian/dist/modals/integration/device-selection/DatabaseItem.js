import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
function formatDate(date) {
    return date.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
    });
}
function formatRelativeTime(date) {
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffMinutes < 1) {
        return "just now";
    }
    else if (diffMinutes < 60) {
        return `${diffMinutes}min ago`;
    }
    else if (diffHours < 24) {
        return `${diffHours}h ago`;
    }
    else if (diffDays < 7) {
        return `${diffDays}d ago`;
    }
    else {
        return formatDate(date);
    }
}
export function DatabaseItem({ db, isSelected, onSelect, }) {
    const statsParts = [];
    if (db.cardCount !== null) {
        statsParts.push(`${db.cardCount.toLocaleString()} cards`);
    }
    if (db.lastReviewDate) {
        statsParts.push(`Last: ${formatDate(db.lastReviewDate)}`);
    }
    return (_jsxs("div", { class: `ep:flex ep:items-center ep:justify-between ep:p-3 ep:border-b ep:border-obs-border ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:last:border-b-0 ${isSelected ? "ep:bg-obs-interactive/10 ep:border-l-2 ep:border-l-obs-interactive" : ""}`, role: "option", tabIndex: 0, "aria-selected": isSelected, onClick: onSelect, onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
            }
        }, children: [_jsxs("div", { children: [_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2", children: [_jsx("span", { children: "device" }), _jsx("span", { class: "ep:font-mono", children: db.deviceId })] }), _jsx("div", { class: "ep:text-ui-smaller ep:text-obs-muted ep:mt-1", children: statsParts.join(" | ") })] }), _jsxs("div", { class: "ep:text-right ep:text-ui-smaller ep:text-obs-muted", children: [_jsx("div", { children: db.formattedSize }), _jsxs("div", { children: ["Mod: ", formatRelativeTime(db.lastModified)] })] })] }));
}
