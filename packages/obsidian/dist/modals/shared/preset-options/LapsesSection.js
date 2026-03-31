import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { FormCard, FormField, SelectInput, TextInput, } from "@true-recall/obsidian/components";
const LEECH_ACTION_OPTIONS = [
    { value: "tag-only", label: "Tag only" },
    { value: "suspend", label: "Suspend card" },
];
export function LapsesSection({ preset, updatePreset }) {
    var _a, _b;
    return (_jsxs(FormCard, { title: "Lapses", children: [_jsx(FormField, { name: "Relearning steps (minutes)", description: "Steps after a lapse (Again on a review card). Leave empty to skip relearning.", children: _jsx(TextInput, { value: preset.relearningSteps.join(", "), onChange: (v) => {
                        const trimmed = v.trim();
                        if (trimmed === "") {
                            void updatePreset({ relearningSteps: [] });
                            return;
                        }
                        const steps = trimmed
                            .split(",")
                            .map((s) => parseFloat(s.trim()))
                            .filter((n) => !Number.isNaN(n) && n > 0);
                        void updatePreset({ relearningSteps: steps });
                    }, placeholder: "10" }) }), _jsx(FormField, { name: "Leech threshold", description: "Number of lapses before a card is flagged as a leech (0 = disabled)", children: _jsx(TextInput, { value: String((_a = preset.leechThreshold) !== null && _a !== void 0 ? _a : 8), onChange: (v) => {
                        const num = parseInt(v, 10);
                        if (!Number.isNaN(num)) {
                            void updatePreset({
                                leechThreshold: Math.max(0, num),
                            });
                        }
                    }, placeholder: "8" }) }), _jsx(FormField, { name: "Leech action", description: "What happens when a card exceeds the leech threshold", children: _jsx(SelectInput, { value: (_b = preset.leechAction) !== null && _b !== void 0 ? _b : "tag-only", onChange: (v) => void updatePreset({ leechAction: v }), options: LEECH_ACTION_OPTIONS }) })] }));
}
