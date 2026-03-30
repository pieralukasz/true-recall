import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { FormCard, FormField, TextInput } from "@true-recall/obsidian/components";
export function DailyLimitsSection({ preset, updatePreset, }) {
    return (_jsxs(FormCard, { title: "Daily limits", children: [_jsx(FormField, { name: "New cards per day", description: "Maximum new cards introduced per day", children: _jsx(TextInput, { value: String(preset.newCardsPerDay), onChange: (v) => {
                        const parsed = parseInt(v, 10);
                        const num = Number.isNaN(parsed) ? 20 : parsed;
                        void updatePreset({ newCardsPerDay: Math.max(0, num) });
                    }, placeholder: "20" }) }), _jsx(FormField, { name: "Reviews per day", description: "Maximum reviews per day (0 = unlimited)", children: _jsx(TextInput, { value: String(preset.reviewsPerDay), onChange: (v) => {
                        const parsed = parseInt(v, 10);
                        const num = Number.isNaN(parsed) ? 200 : parsed;
                        void updatePreset({ reviewsPerDay: Math.max(0, num) });
                    }, placeholder: "200" }) })] }));
}
