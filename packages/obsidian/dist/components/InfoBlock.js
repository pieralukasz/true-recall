import { jsx as _jsx } from "preact/jsx-runtime";
import { cn } from "@true-recall/obsidian/utils";
export function InfoBlock({ children, class: cls }) {
    return (_jsx("div", { class: cn("ep:text-ui-smaller ep:text-obs-muted ep:leading-relaxed ep:py-2", cls), children: children }));
}
