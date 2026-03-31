import { jsx as _jsx } from "preact/jsx-runtime";
import { cn } from "../utils/cn";
import { useCallback } from "preact/hooks";
export function ToggleInput({ value, onChange, disabled, ariaLabel, }) {
    const handleClick = useCallback(() => {
        if (!disabled)
            onChange(!value);
    }, [value, onChange, disabled]);
    const handleKeyDown = useCallback((e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onChange(!value);
        }
    }, [value, onChange, disabled]);
    return (_jsx("div", { class: cn("checkbox-container", value && "is-enabled", disabled && "ep:opacity-50 ep:cursor-not-allowed"), role: "switch", tabIndex: 0, "aria-checked": value, "aria-label": ariaLabel, onClick: handleClick, onKeyDown: handleKeyDown }));
}
