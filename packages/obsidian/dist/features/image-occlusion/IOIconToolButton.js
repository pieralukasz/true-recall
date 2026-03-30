import { jsx as _jsx } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components/Clickable";
import { useIcon } from "@true-recall/obsidian/preact/hooks";
import { cn } from "@true-recall/ui/utils/cn";
export function IconToolButton({ icon, label, shortcut, active = false, danger = false, disabled = false, onClick, }) {
    const iconRef = useIcon(icon);
    const tooltip = shortcut ? `${label} (${shortcut})` : label;
    return (_jsx(Clickable, { class: cn("true-recall-io-icon-btn", active && "is-active", danger && "is-danger"), "aria-label": label, title: tooltip, onClick: () => onClick(), disabled: disabled, children: _jsx("span", { ref: iconRef }) }));
}
