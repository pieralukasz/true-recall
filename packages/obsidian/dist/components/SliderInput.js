import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useCallback } from "preact/hooks";
export function SliderInput({ value, onChange, min, max, step, formatTooltip, disabled, }) {
    const handleInput = useCallback((e) => {
        onChange(Number(e.target.value));
    }, [onChange]);
    return (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2", children: [_jsx("input", { type: "range", min: min, max: max, step: step, value: value, onInput: handleInput, disabled: disabled }), formatTooltip && (_jsx("span", { class: "ep:text-ui-smaller ep:text-obs-muted ep:min-w-[3em] ep:text-right", children: formatTooltip(value) }))] }));
}
