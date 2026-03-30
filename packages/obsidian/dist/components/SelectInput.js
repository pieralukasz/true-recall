import { jsx as _jsx } from "preact/jsx-runtime";
import { cn } from "@true-recall/obsidian/utils";
import { useCallback } from "preact/hooks";
const BASE_CLS = "ep:py-2 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:transition-colors ep:disabled:opacity-50 ep:disabled:cursor-not-allowed";
function isOptionGroup(opt) {
    return "options" in opt;
}
export function SelectInput({ value, onChange, options, disabled, class: cls, ariaLabel, }) {
    const handleChange = useCallback((e) => {
        onChange(e.target.value);
    }, [onChange]);
    return (_jsx("select", { class: cn(BASE_CLS, cls), value: value, onChange: handleChange, disabled: disabled, "aria-label": ariaLabel, children: options.map((opt) => isOptionGroup(opt) ? (_jsx("optgroup", { label: opt.label, children: opt.options.map((o) => (_jsx("option", { value: o.value, disabled: o.disabled, children: o.label }, o.value))) }, opt.label)) : (_jsx("option", { value: opt.value, disabled: opt.disabled, children: opt.label }, opt.value))) }));
}
