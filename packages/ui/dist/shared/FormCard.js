import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { cn } from "../utils/cn";
export function FormCard({ title, description, children, class: cls, }) {
    return (_jsxs("div", { class: cn("ep:p-4 ep:rounded-lg ep:bg-surface-raised", cls), children: [title && (_jsx("div", { class: "ep:flex ep:items-center ep:justify-between ep:mb-3 ep:pb-2.5 ep:border-b ep:border-obs-border", children: _jsxs("div", { children: [_jsx("span", { class: "ep:ep-text-heading-md", children: title }), description && (_jsx("p", { class: "ep:ep-text-caption ep:mt-0.5", children: description }))] }) })), children] }));
}
