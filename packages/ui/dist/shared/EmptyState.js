import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "./Clickable";
export function EmptyState({ message, icon, actionLabel, onAction, }) {
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:items-center ep:justify-center ep:flex-1 ep:text-obs-muted ep:text-center ep:py-4 ep:px-2", children: [icon && _jsx("div", { class: "ep:text-3xl ep:mb-2", children: icon }), _jsx("div", { children: message }), actionLabel && onAction && (_jsx(Clickable, { class: "ep:mt-3 mod-cta", onClick: onAction, stopPropagation: false, children: actionLabel }))] }));
}
export const EmptyStateMessages = {
    NO_FILE: "Open a note to see flashcard options",
    NOT_MARKDOWN: "Select a markdown file",
    NO_FLASHCARDS: "No flashcards yet for this note.",
    LOADING: "Loading flashcards...",
    ERROR: "An error occurred",
};
