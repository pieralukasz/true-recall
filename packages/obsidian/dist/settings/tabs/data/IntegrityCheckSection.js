import { __awaiter } from "tslib";
import { jsx as _jsx } from "preact/jsx-runtime";
import { useSettings } from "../../hooks/useSettings";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { ActionButton, FormCard, FormField } from "@true-recall/obsidian/components";
import { useCallback, useState } from "preact/hooks";
export function IntegrityCheckSection() {
    const { plugin } = useSettings();
    const [running, setRunning] = useState(false);
    const handleCheck = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!plugin.cardStore) {
            notify().error("Database not initialized");
            return;
        }
        setRunning(true);
        try {
            const report = plugin.cardStore.integrity.check();
            if (report.totalIssues === 0) {
                notify().success("Database integrity OK — no orphaned records found");
                return;
            }
            const { confirm } = yield import("@true-recall/obsidian/modals/shared/ConfirmModal");
            const confirmed = yield confirm(plugin.app, {
                message: `Found ${report.totalIssues} orphaned records:\n` +
                    `- ${report.orphanedCards.length} cards with missing notes\n` +
                    `- ${report.orphanedNotes.length} notes with missing note types\n` +
                    `- ${report.orphanedReviewLogs.length} review logs with missing cards\n\n` +
                    `Soft-delete these records?`,
            });
            if (!confirmed)
                return;
            // Safety backup before repair
            try {
                yield ((_a = plugin.backupService) === null || _a === void 0 ? void 0 : _a.createBackup());
            }
            catch (_b) {
                console.warn("[True Recall] Pre-repair backup failed, proceeding anyway");
            }
            const fixed = plugin.cardStore.integrity.repair(report);
            notify().success(`Fixed ${fixed} orphaned records`);
        }
        catch (error) {
            console.error("[True Recall] Integrity check failed:", error);
            notify().error("Integrity check failed");
        }
        finally {
            setRunning(false);
        }
    }), [plugin]);
    return (_jsx(FormCard, { title: "Database integrity", children: _jsx(FormField, { name: "Check integrity", description: "Detect and repair orphaned cards, notes, and review logs", children: _jsx(ActionButton, { label: running ? "Checking..." : "Check now", variant: "primary", onClick: () => void handleCheck(), disabled: running }) }) }));
}
