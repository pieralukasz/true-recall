import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useSettings } from "../../hooks/useSettings";
import { FormCard, FormField, InfoBlock, SelectInput, TextInput, ToggleInput, } from "@true-recall/obsidian/components";
export function BackgroundBackupSection() {
    const { settings, save } = useSettings();
    return (_jsxs(FormCard, { title: "Background backup", children: [_jsxs(InfoBlock, { children: [_jsx("p", { children: "Your active SQL database remains the source of truth during study and editing." }), _jsx("p", { children: "Periodic backups run in the background as protection only." }), _jsx("p", { children: "Smart retention keeps recent backups densely and older ones sparsely." })] }), _jsx(FormField, { name: "Enable periodic backups", description: "Automatically backup database at regular intervals", children: _jsx(ToggleInput, { value: settings.periodicBackupEnabled, onChange: (v) => void save({ periodicBackupEnabled: v }) }) }), _jsx(FormField, { name: "Backup interval", description: "How often to create automatic backups (only when changes exist)", children: _jsx(SelectInput, { value: String(settings.backupIntervalMinutes), onChange: (v) => void save({
                        backupIntervalMinutes: parseInt(v, 10),
                    }), options: [
                        { value: "15", label: "Every 15 minutes" },
                        { value: "30", label: "Every 30 minutes" },
                        { value: "60", label: "Every hour" },
                        { value: "120", label: "Every 2 hours" },
                        { value: "240", label: "Every 4 hours" },
                    ] }) }), _jsx(FormField, { name: "Activity-triggered backup", description: "Create backup after completing a certain number of reviews", children: _jsx(ToggleInput, { value: settings.activityTriggeredBackup, onChange: (v) => void save({ activityTriggeredBackup: v }) }) }), _jsx(FormField, { name: "Reviews before backup", description: "Number of reviews after which to trigger an automatic backup", children: _jsx(TextInput, { value: String(settings.reviewsBeforeBackup), onChange: (v) => {
                        const num = parseInt(v, 10) || 50;
                        void save({ reviewsBeforeBackup: Math.max(10, num) });
                    }, placeholder: "50" }) })] }));
}
