import { __rest } from "tslib";
import { jsx as _jsx } from "preact/jsx-runtime";
import { cn } from "@true-recall/obsidian/utils";
export function Clickable(_a) {
    var { onClick, disabled, role: roleOverride, stopPropagation: stop = true, preventDefault: prevent = true, class: cls, children } = _a, rest = __rest(_a, ["onClick", "disabled", "role", "stopPropagation", "preventDefault", "class", "children"]);
    const handleClick = disabled
        ? undefined
        : (e) => {
            if (prevent)
                e.preventDefault();
            if (stop)
                e.stopPropagation();
            onClick(e);
        };
    const handleKeyDown = disabled
        ? undefined
        : (e) => {
            if (e.key === "Enter" || e.key === " ") {
                if (prevent)
                    e.preventDefault();
                if (stop)
                    e.stopPropagation();
                onClick(e);
            }
        };
    return (
    // biome-ignore lint/a11y/noStaticElementInteractions: div with role="button" and keyboard handlers
    _jsx("div", Object.assign({}, rest, { role: roleOverride !== null && roleOverride !== void 0 ? roleOverride : "button", tabIndex: disabled ? -1 : 0, "aria-disabled": disabled || undefined, class: cn("ep:cursor-pointer", disabled && "ep:opacity-60 ep:cursor-not-allowed", cls), onClick: handleClick, onKeyDown: handleKeyDown, children: children })));
}
