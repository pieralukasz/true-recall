import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useSettings } from "../../hooks/useSettings";
import { ActionButton, FormCard, FormField } from "@true-recall/obsidian/components";
export function ManualBackupSection() {
    const { plugin } = useSettings();
    return (_jsxs(FormCard, { title: "Manual backup", children: [_jsx(FormField, { name: "Create backup now", description: "Manually create a backup of the current database", children: _jsx(ActionButton, { label: "Create backup", variant: "primary", onClick: () => void plugin.createManualBackup() }) }), _jsx(FormField, { name: "Restore from backup", description: "Restore the database from a previous backup (requires Obsidian reload)", children: _jsx(ActionButton, { label: "Restore...", variant: "danger", onClick: () => void plugin.openRestoreBackupModal() }) })] }));
}
