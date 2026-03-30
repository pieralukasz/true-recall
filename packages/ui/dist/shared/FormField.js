import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { cn } from "../utils/cn";
export function FormField({ name, description, children, class: cls, }) {
    return (_jsxs("div", { class: cn("ep:flex ep:items-center ep:justify-between ep:gap-4 ep:py-3 ep:border-b ep:border-obs-border last:ep:border-b-0", cls), children: [_jsxs("div", { class: "ep:flex ep:flex-col ep:min-w-0", children: [_jsx("span", { class: "ep:text-ui-small ep:font-medium ep:text-obs-normal", children: name }), description && (_jsx("span", { class: "ep:text-ui-smaller ep:text-obs-muted ep:leading-snug ep:mt-0.5", children: description }))] }), children && (_jsx("div", { class: "ep:shrink-0 ep:flex ep:items-center", children: children }))] }));
}
