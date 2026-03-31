import { jsx as _jsx } from "preact/jsx-runtime";
import { FormField } from "@true-recall/obsidian/components";
const NUM_INPUT_CLS = "ep:w-20 ep:py-1.5 ep:px-2.5 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:text-right";
export function NumberField({ id, label, description, value, onChange, min = 0, max, step = 1, }) {
    return (_jsx(FormField, { name: label, description: description, children: _jsx("input", { id: id, type: "number", class: NUM_INPUT_CLS, min: min, max: max, step: step, value: value, onChange: (e) => {
                const raw = Number(e.target.value) || min;
                let clamped = Math.max(min, raw);
                if (max !== undefined)
                    clamped = Math.min(max, clamped);
                onChange(clamped);
            } }) }));
}
