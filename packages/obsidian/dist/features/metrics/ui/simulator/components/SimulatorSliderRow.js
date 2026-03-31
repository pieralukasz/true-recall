import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { formatSliderValue } from "../utils/simulator-helpers";
import { useCallback, useEffect, useRef } from "preact/hooks";
export function SimulatorSliderRow({ config, value, onValueChange, }) {
    const rangeRef = useRef(null);
    const numberRef = useRef(null);
    const debounceRef = useRef(null);
    // Sync inputs when value changes externally (undo/redo/reset)
    useEffect(() => {
        if (rangeRef.current)
            rangeRef.current.value = String(value);
        if (numberRef.current)
            numberRef.current.value = formatSliderValue(value, config);
    }, [value, config]);
    useEffect(() => {
        return () => {
            if (debounceRef.current)
                clearTimeout(debounceRef.current);
        };
    }, []);
    const debouncedUpdate = useCallback((newValue) => {
        if (debounceRef.current)
            clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            onValueChange(config.index, newValue);
            debounceRef.current = null;
        }, 150);
    }, [config.index, onValueChange]);
    const handleRangeInput = useCallback((e) => {
        const val = parseFloat(e.target.value);
        if (numberRef.current)
            numberRef.current.value = formatSliderValue(val, config);
        debouncedUpdate(val);
    }, [config, debouncedUpdate]);
    const handleNumberChange = useCallback(() => {
        if (!numberRef.current)
            return;
        let val = parseFloat(numberRef.current.value);
        if (Number.isNaN(val))
            val = config.defaultValue;
        val = Math.max(config.min, Math.min(config.max, val));
        numberRef.current.value = formatSliderValue(val, config);
        if (rangeRef.current)
            rangeRef.current.value = String(val);
        debouncedUpdate(val);
    }, [config, debouncedUpdate]);
    const handleKeyDown = useCallback((e) => {
        if (e.key === "Enter")
            e.target.blur();
    }, []);
    return (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2", children: [_jsx("div", { class: "ep:w-[200px] ep:text-ui-smaller ep:text-obs-muted ep:truncate", title: config.description, children: config.name }), _jsx("input", { ref: numberRef, type: "text", class: [
                    "ep:w-[70px] ep:px-2 ep:py-1",
                    "ep:bg-obs-primary ep:text-obs-normal",
                    "ep:border ep:border-obs-border ep:rounded-lg",
                    "ep:text-ui-smaller ep:text-center",
                ].join(" "), value: formatSliderValue(value, config), onChange: handleNumberChange, onKeyDown: handleKeyDown }), _jsx("div", { class: "ep:text-ui-smaller ep:text-obs-muted ep:w-[40px] ep:text-right", children: config.min }), _jsx("input", { ref: rangeRef, type: "range", class: "ep:flex-1 ep:cursor-pointer ep:h-1 ep:simulator-slider", min: config.min, max: config.max, step: config.step, value: value, onInput: handleRangeInput }), _jsx("div", { class: "ep:text-ui-smaller ep:text-obs-muted ep:w-[40px]", children: config.max })] }));
}
