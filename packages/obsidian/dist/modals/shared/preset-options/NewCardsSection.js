import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { FormCard, FormField, SelectInput, TextInput, } from "@true-recall/obsidian/components";
const ORDER_OPTIONS = [
    { value: "random", label: "Random" },
    { value: "oldest-first", label: "Oldest first" },
    { value: "newest-first", label: "Newest first" },
];
const MIX_OPTIONS = [
    { value: "mix-with-reviews", label: "Mix with reviews" },
    { value: "show-after-reviews", label: "Show after reviews" },
    { value: "show-before-reviews", label: "Show before reviews" },
];
export function NewCardsSection({ preset, updatePreset, }) {
    var _a, _b;
    return (_jsxs(FormCard, { title: "New cards", children: [_jsx(FormField, { name: "Learning steps (minutes)", description: "Comma-separated delays, e.g. 1, 10 = 1min then 10min", children: _jsx(TextInput, { value: preset.learningSteps.join(", "), onChange: (v) => {
                        const steps = v
                            .split(",")
                            .map((s) => parseFloat(s.trim()))
                            .filter((n) => !Number.isNaN(n) && n > 0);
                        if (steps.length > 0) {
                            void updatePreset({ learningSteps: steps });
                        }
                    }, placeholder: "1, 10" }) }), _jsx(FormField, { name: "New card order", description: "Order in which new cards are introduced", children: _jsx(SelectInput, { value: (_a = preset.newCardOrder) !== null && _a !== void 0 ? _a : "random", onChange: (v) => void updatePreset({ newCardOrder: v }), options: ORDER_OPTIONS }) }), _jsx(FormField, { name: "Mix with reviews", description: "How new cards are interspersed with review cards", children: _jsx(SelectInput, { value: (_b = preset.newReviewMix) !== null && _b !== void 0 ? _b : "mix-with-reviews", onChange: (v) => void updatePreset({ newReviewMix: v }), options: MIX_OPTIONS }) })] }));
}
