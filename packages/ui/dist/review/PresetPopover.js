import { jsxs as _jsxs, jsx as _jsx } from "preact/jsx-runtime";
import { Clickable } from "../shared/Clickable";
import { cn } from "../utils/cn";
import { useEffect, useRef, useState } from "preact/hooks";
export function PresetPopover({ value, options, onChange, }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    useEffect(() => {
        if (!isOpen)
            return;
        const handlePointerDown = (e) => {
            if (containerRef.current &&
                !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === "Escape")
                setIsOpen(false);
        };
        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);
    return (_jsxs("div", { ref: containerRef, class: "ep:relative", children: [_jsxs(Clickable, { class: "ep:flex ep:items-center ep:gap-1 ep:text-obs-faint ep:text-ui-smaller ep:hover:text-obs-muted ep:transition-colors", onClick: () => setIsOpen((v) => !v), "aria-expanded": isOpen, "aria-haspopup": "listbox", children: [_jsxs("span", { children: ["FSRS: ", value] }), _jsx("svg", { "aria-hidden": "true", class: cn("ep:w-3 ep:h-3 ep:transition-transform ep:duration-150", isOpen && "ep:rotate-180"), viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2.5", "stroke-linecap": "round", "stroke-linejoin": "round", children: _jsx("polyline", { points: "6 9 12 15 18 9" }) })] }), isOpen && (_jsx("ul", { "aria-label": "FSRS preset", class: "ep:absolute ep:bottom-full ep:left-1/2 ep:-translate-x-1/2 ep:mb-2 ep:z-50 ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:shadow-lg ep:py-1 ep:min-w-[160px]", children: options.map((option) => {
                    const isActive = option.value === value;
                    return (_jsx("li", { children: _jsxs(Clickable, { class: cn("ep:flex ep:items-center ep:justify-between ep:gap-3 ep:px-3 ep:py-1.5 ep:w-full ep:text-ui-small ep:hover:bg-obs-modifier-hover ep:transition-colors ep:rounded-none", isActive ? "ep:text-obs-normal" : "ep:text-obs-muted"), onClick: () => {
                                onChange(option.value);
                                setIsOpen(false);
                            }, children: [_jsxs("span", { class: "ep:flex ep:items-center ep:gap-2", children: [_jsx("span", { class: "ep:w-3 ep:flex-shrink-0", children: isActive && (_jsx("svg", { "aria-hidden": "true", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2.5", "stroke-linecap": "round", "stroke-linejoin": "round", class: "ep:w-3 ep:h-3 ep:text-obs-accent", children: _jsx("polyline", { points: "20 6 9 17 4 12" }) })) }), _jsx("span", { children: option.label })] }), _jsxs("span", { class: "ep:text-obs-faint ep:text-[11px] ep:tabular-nums ep:flex-shrink-0", children: [Math.round(option.retention * 100), "%"] })] }) }, option.value));
                }) }))] }));
}
