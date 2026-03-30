import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
export function ReviewEmptyState({ message, onClose, }) {
    return (_jsx("div", { class: "true-recall-review ep:flex ep:flex-col ep:h-full ep:p-0", children: _jsx("div", { class: "true-recall-review-card-container ep:flex-1 ep:min-h-0 ep:flex ep:items-start ep:justify-center ep:p-2 ep:mt-8 ep:overflow-y-auto", children: _jsxs("div", { class: "ep:text-center ep:py-12 ep:px-6", children: [_jsx("div", { class: "ep:text-5xl ep:mb-4", children: "\uD83C\uDF89" }), _jsx("div", { class: "ep:text-ui-medium ep:text-obs-muted ep:mb-6", children: message }), _jsx(Clickable, { stopPropagation: false, class: "ep-btn mod-cta", onClick: onClose, children: "Close" })] }) }) }));
}
