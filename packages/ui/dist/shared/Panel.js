import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { cn } from "../utils/cn";
export function Panel({ disableScroll, children, footer }) {
    return (_jsxs("div", { class: "ep:h-full ep:flex ep:flex-col ep:px-1 ep:overflow-hidden", children: [_jsx("div", { class: cn("ep:flex-1 ep:min-h-0", !disableScroll && "ep:overflow-y-auto"), children: children }), footer && _jsx("div", { class: "ep:shrink-0", children: footer })] }));
}
