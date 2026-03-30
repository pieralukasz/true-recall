import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { EasyDaysModal } from "@true-recall/obsidian/features/metrics/modals/EasyDaysModal";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { ActionButton, FormCard, FormField, InfoBlock, } from "@true-recall/obsidian/components";
import { useCallback } from "preact/hooks";
export function EasyDaysSection({ plugin, settings, save, app, onRefresh, }) {
    const easyDays = settings.easyDays;
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const recurringDaysText = easyDays.recurringDays.length > 0
        ? easyDays.recurringDays.map((d) => dayNames[d]).join(", ")
        : "None";
    const specificDatesCount = easyDays.specificDates.length;
    const pushUndo = useCallback((affectedCount, changes) => {
        var _a;
        (_a = plugin.undoService) === null || _a === void 0 ? void 0 : _a.push({
            id: crypto.randomUUID(),
            actionType: "fsrs-helper-operation",
            description: `Apply easy days (${affectedCount} cards)`,
            timestamp: Date.now(),
            payload: {
                type: "fsrs-helper-operation",
                operation: "apply-easy-days",
                changes: changes.map((c) => ({
                    cardId: c.cardId,
                    originalDue: c.originalDue,
                    newDue: c.newDue,
                })),
            },
        });
    }, [plugin]);
    const handleConfigure = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const modal = new EasyDaysModal(app, {
            easyDays: settings.easyDays,
            multiplier: settings.easyDaysMultiplier,
        });
        const result = yield modal.openAndWait();
        if (!result.cancelled && result.easyDays) {
            yield save(Object.assign({ easyDays: result.easyDays }, (result.multiplier !== undefined && {
                easyDaysMultiplier: result.multiplier,
            })));
            if (result.applyNow) {
                const applyResult = (_a = plugin.fsrsHelper) === null || _a === void 0 ? void 0 : _a.applyEasyDays({
                    dryRun: false,
                });
                if (applyResult && applyResult.affectedCount > 0) {
                    pushUndo(applyResult.affectedCount, applyResult.changes);
                    notify().success(`Applied easy days: ${applyResult.affectedCount} cards moved (Ctrl+Z to undo)`);
                }
                else if (applyResult) {
                    notify().info("No cards needed to be moved");
                }
            }
            onRefresh();
        }
    }), [app, settings, save, plugin, pushUndo, onRefresh]);
    const handleApplyNow = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const applyResult = yield ((_a = plugin.fsrsHelper) === null || _a === void 0 ? void 0 : _a.applyEasyDays({
            dryRun: false,
        }));
        if (applyResult && applyResult.affectedCount > 0) {
            pushUndo(applyResult.affectedCount, applyResult.changes);
            notify().success(`Applied easy days: ${applyResult.affectedCount} cards moved (Ctrl+Z to undo)`);
        }
        else if (applyResult) {
            notify().info("No cards needed to be moved");
        }
    }), [plugin, pushUndo]);
    return (_jsxs(FormCard, { title: "Easy days", children: [_jsx(InfoBlock, { children: _jsx("p", { children: "Reduce your review workload on specific days (recurring weekdays or specific dates). Cards due on easy days will be moved to adjacent days." }) }), _jsxs(FormField, { name: "Easy days", description: `Recurring: ${recurringDaysText} | Specific dates: ${specificDatesCount} | Workload: ${Math.round(settings.easyDaysMultiplier * 100)}%`, children: [_jsx(ActionButton, { label: "Configure...", variant: "secondary", onClick: () => void handleConfigure() }), _jsx(ActionButton, { label: "Apply now", variant: "secondary", onClick: () => void handleApplyNow() })] })] }));
}
