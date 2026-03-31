import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useSettings } from "../../hooks/useSettings";
import { FormCard, FormField, InfoBlock, ToggleInput, } from "@true-recall/obsidian/components";
export function BackupSettingsSection() {
    const { settings, save } = useSettings();
    return (_jsxs(FormCard, { title: "Database backup", children: [_jsxs(InfoBlock, { children: [_jsx("p", { children: "True Recall works directly on your active SQLite database during normal use." }), _jsx("p", { children: "Backups are safety copies to recover from corruption or accidental changes." }), _jsxs("p", { children: ["Stored in ", _jsx("code", { children: ".true-recall/backups/" })] })] }), _jsx(FormField, { name: "Automatic backup on load", description: "Create a backup automatically when the plugin loads", children: _jsx(ToggleInput, { value: settings.autoBackupOnLoad, onChange: (v) => void save({ autoBackupOnLoad: v }) }) })] }));
}
