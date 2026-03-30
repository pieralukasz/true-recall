import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useFsrsHelperOp } from "./useFsrsHelperOp";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { ActionButton, FormCard, FormField, TextInput, } from "@true-recall/obsidian/components";
import { confirm } from "@true-recall/obsidian/modals/shared";
import { useCallback, useMemo, useState } from "preact/hooks";
export function BulkOperationsSection({ plugin }) {
    const [rescheduling, setRescheduling] = useState(false);
    const [postponeDays, setPostponeDays] = useState("7");
    const postponeConfig = useMemo(() => ({
        plugin,
        operationName: "shift-due-dates",
        undoDescription: (n) => `Postpone ${n} cards by ${parseInt(postponeDays, 10) || 7} days`,
        successMessage: (n) => `Postponed ${n} cards by ${parseInt(postponeDays, 10) || 7} days (Ctrl+Z to undo)`,
        emptyMessage: "No cards to postpone",
        errorPrefix: "Postpone failed",
    }), [plugin, postponeDays]);
    const { running: postponing, execute: executePostpone } = useFsrsHelperOp(postponeConfig);
    const handleReschedule = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        setRescheduling(true);
        try {
            const previewResult = yield ((_a = plugin.fsrsHelper) === null || _a === void 0 ? void 0 : _a.rescheduleCards({
                scope: "all",
                dryRun: true,
            }));
            if (previewResult && previewResult.affectedCount > 0) {
                const confirmed = yield confirm(plugin.app, {
                    title: "Reschedule cards",
                    message: `This will reschedule ${previewResult.affectedCount} cards. Proceed?`,
                    confirmLabel: "Reschedule",
                });
                if (confirmed) {
                    const result = yield ((_b = plugin.fsrsHelper) === null || _b === void 0 ? void 0 : _b.rescheduleCards({
                        scope: "all",
                        dryRun: false,
                    }));
                    if (result && result.affectedCount > 0) {
                        (_c = plugin.undoService) === null || _c === void 0 ? void 0 : _c.push({
                            id: crypto.randomUUID(),
                            actionType: "fsrs-helper-operation",
                            description: `Reschedule cards (${result.affectedCount} cards)`,
                            timestamp: Date.now(),
                            payload: {
                                type: "fsrs-helper-operation",
                                operation: "reschedule-cards",
                                changes: result.changes.map((c) => ({
                                    cardId: c.cardId,
                                    originalDue: c.originalDue,
                                    newDue: c.newDue,
                                })),
                            },
                        });
                        notify().success(`Rescheduled ${result.affectedCount} cards (Ctrl+Z to undo)`);
                    }
                }
            }
            else if (previewResult) {
                notify().info("No cards to reschedule");
            }
        }
        catch (err) {
            notify().error(`Reschedule failed: ${String(err)}`);
        }
        finally {
            setRescheduling(false);
        }
    }), [plugin]);
    return (_jsxs(FormCard, { title: "Bulk operations", children: [_jsx(FormField, { name: "Reschedule all cards", description: "Recalculate all intervals with current FSRS weights (preview first)", children: _jsx(ActionButton, { label: rescheduling ? "Calculating..." : "Preview reschedule", variant: "secondary", disabled: rescheduling, onClick: () => void handleReschedule() }) }), _jsxs(FormField, { name: "Postpone all due cards", description: "Push all due cards forward by N days", children: [_jsx(TextInput, { value: postponeDays, onChange: setPostponeDays, placeholder: "7" }), _jsx(ActionButton, { label: postponing ? "Postponing..." : "Postpone", variant: "secondary", disabled: postponing, onClick: () => {
                            const days = parseInt(postponeDays, 10) || 7;
                            void executePostpone(() => {
                                var _a;
                                return (_a = plugin.fsrsHelper) === null || _a === void 0 ? void 0 : _a.shiftDueDates({
                                    action: "postpone",
                                    days,
                                    scope: "due_today",
                                    dryRun: false,
                                });
                            });
                        } })] })] }));
}
