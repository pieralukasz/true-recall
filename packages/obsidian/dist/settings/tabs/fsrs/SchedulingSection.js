import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { FormCard, FormField, SelectInput, TextInput, ToggleInput, } from "@true-recall/obsidian/components";
export function SchedulingSection({ preset, updatePreset, settings, save, }) {
    return (_jsxs(_Fragment, { children: [_jsxs(FormCard, { title: "Learning steps", children: [_jsx(FormField, { name: "Learning steps (minutes)", description: "Comma-separated steps for new cards. Default: 1, 10", children: _jsx(TextInput, { value: preset.learningSteps.join(", "), onChange: (v) => {
                                const steps = v
                                    .split(",")
                                    .map((s) => parseInt(s.trim(), 10))
                                    .filter((n) => !Number.isNaN(n) && n > 0);
                                void updatePreset({
                                    learningSteps: steps.length > 0 ? steps : [1, 10],
                                });
                            }, placeholder: "1, 10" }) }), _jsx(FormField, { name: "Relearning steps (minutes)", description: "Comma-separated steps for lapsed cards. Default: 10", children: _jsx(TextInput, { value: preset.relearningSteps.join(", "), onChange: (v) => {
                                const steps = v
                                    .split(",")
                                    .map((s) => parseInt(s.trim(), 10))
                                    .filter((n) => !Number.isNaN(n) && n > 0);
                                void updatePreset({
                                    relearningSteps: steps.length > 0 ? steps : [10],
                                });
                            }, placeholder: "10" }) })] }), _jsxs(FormCard, { title: "Display order", children: [_jsx(FormField, { name: "New card order", description: "How to order new cards in the review queue", children: _jsx(SelectInput, { value: settings.newCardOrder, onChange: (v) => void save({ newCardOrder: v }), options: [
                                { value: "random", label: "Random" },
                                {
                                    value: "oldest-first",
                                    label: "Oldest first (by position in file)",
                                },
                                {
                                    value: "newest-first",
                                    label: "Newest first (by position in file)",
                                },
                            ] }) }), _jsx(FormField, { name: "Review order", description: "How to order cards due for review", children: _jsx(SelectInput, { value: settings.reviewOrder, onChange: (v) => void save({ reviewOrder: v }), options: [
                                { value: "due-date", label: "By due date" },
                                { value: "random", label: "Random" },
                                { value: "due-date-random", label: "Due date, then random" },
                                {
                                    value: "by-retrievability",
                                    label: "By retrievability (lowest R first)",
                                },
                            ] }) }), _jsx(FormField, { name: "New/review mix", description: "When to show new cards relative to reviews", children: _jsx(SelectInput, { value: settings.newReviewMix, onChange: (v) => void save({ newReviewMix: v }), options: [
                                { value: "mix-with-reviews", label: "Mix with reviews" },
                                { value: "show-after-reviews", label: "Show after reviews" },
                                { value: "show-before-reviews", label: "Show before reviews" },
                            ] }) })] }), _jsx(FormCard, { title: "Siblings", children: _jsx(FormField, { name: "Bury sibling cards", description: "After reviewing an image occlusion or cloze card, bury remaining cards from the same note until next day. When off, siblings are spaced apart in the queue instead.", children: _jsx(ToggleInput, { value: preset.burySiblings !== false, onChange: (v) => void updatePreset({ burySiblings: v }) }) }) })] }));
}
