import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { FSRS_CONFIG } from "@true-recall/core/constants";
import { FormCard, FormField, SliderInput, TextInput, } from "@true-recall/obsidian/components";
export function AlgorithmSection({ preset, updatePreset, }) {
    return (_jsxs(FormCard, { title: "FSRS algorithm", children: [_jsx(FormField, { name: "Desired retention", description: `Target probability of recall (${FSRS_CONFIG.minRetention}-${FSRS_CONFIG.maxRetention}). Default: 0.9 (90%)`, children: _jsx(SliderInput, { value: preset.requestRetention, onChange: (v) => void updatePreset({ requestRetention: v }), min: FSRS_CONFIG.minRetention, max: FSRS_CONFIG.maxRetention, step: 0.01, formatTooltip: (v) => v.toFixed(2) }) }), _jsx(FormField, { name: "Maximum interval (days)", description: "Maximum days between reviews. Default: 36500 (100 years)", children: _jsx(TextInput, { value: String(preset.maximumInterval), onChange: (v) => {
                        const num = parseInt(v, 10) || 36500;
                        void updatePreset({ maximumInterval: Math.max(1, num) });
                    }, placeholder: "36500" }) })] }));
}
