import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { ActionButton, Clickable, FormCard, FormField, InfoBlock, } from "@true-recall/obsidian/components";
import { useApp } from "@true-recall/obsidian/preact";
import { useCallback } from "preact/hooks";
export function ScheduledBreaksSection({ settings, save, onRefresh, }) {
    const app = useApp();
    const breaks = settings.scheduledBreaks;
    const handleDeleteBreak = useCallback((index) => __awaiter(this, void 0, void 0, function* () {
        yield save({
            scheduledBreaks: breaks.filter((_, i) => i !== index),
        });
        onRefresh();
    }), [breaks, save, onRefresh]);
    const handleAddBreak = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        const { promptText } = yield import("@true-recall/obsidian/modals/shared/TextInputModal");
        const startDate = yield promptText(app, {
            title: "Add scheduled break",
            label: "Start date (YYYY-MM-DD)",
            placeholder: "YYYY-MM-DD",
        });
        if (!startDate)
            return;
        const endDate = yield promptText(app, {
            title: "Add scheduled break",
            label: "End date (YYYY-MM-DD)",
            placeholder: "YYYY-MM-DD",
        });
        if (!endDate)
            return;
        yield save({
            scheduledBreaks: [
                ...breaks,
                {
                    id: crypto.randomUUID(),
                    startDate,
                    endDate,
                    redistributeBefore: true,
                    redistributeAfter: true,
                },
            ],
        });
        onRefresh();
    }), [app, breaks, save, onRefresh]);
    return (_jsxs(FormCard, { title: "Scheduled breaks", children: [_jsx(InfoBlock, { children: _jsx("p", { children: "Schedule breaks (vacations) to redistribute reviews and prevent backlog accumulation." }) }), breaks.length > 0 && (_jsx("div", { class: "ep:space-y-2 ep:mb-4", children: breaks.map((brk, index) => (_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between ep:p-2 ep:bg-obs-background-modifier-form ep:rounded-lg", children: [_jsxs("span", { children: [brk.startDate, " to ", brk.endDate] }), _jsx(Clickable, { class: "ep:text-ui-small", stopPropagation: false, onClick: () => void handleDeleteBreak(index), children: "Delete" })] }, brk.id))) })), _jsx(FormField, { name: "Add scheduled break", description: "Schedule a break period", children: _jsx(ActionButton, { label: "Add break...", variant: "secondary", onClick: () => void handleAddBreak() }) })] }));
}
