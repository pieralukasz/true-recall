import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
export function FormSection({ title, description, children, }) {
    return (_jsxs("div", { class: "ep:pt-4 first:ep:pt-0", children: [_jsxs("div", { class: "ep:mb-2", children: [_jsx("span", { class: "ep:ep-text-heading-sm", children: title }), description && (_jsx("p", { class: "ep:ep-text-caption ep:mt-0.5", children: description }))] }), children] }));
}
