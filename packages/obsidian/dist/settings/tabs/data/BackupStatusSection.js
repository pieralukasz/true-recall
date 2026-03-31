import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useSettings } from "../../hooks/useSettings";
import { FormCard } from "@true-recall/obsidian/components";
import { useEffect, useState } from "preact/hooks";
export function BackupStatusSection() {
    const { plugin } = useSettings();
    const manager = plugin.backgroundBackupManager;
    const [status, setStatus] = useState(() => manager === null || manager === void 0 ? void 0 : manager.getStatus());
    useEffect(() => {
        if (!manager)
            return;
        setStatus(manager.getStatus());
        const id = setInterval(() => setStatus(manager.getStatus()), 10000);
        return () => clearInterval(id);
    }, [manager]);
    if (!manager || !status)
        return null;
    const lastBackup = status.lastBackupTime
        ? new Date(status.lastBackupTime).toLocaleString()
        : "Never (this session)";
    const nextBackup = status.nextScheduledBackup
        ? new Date(status.nextScheduledBackup).toLocaleString()
        : "Not scheduled";
    const sessionStartFilename = status.sessionStartBackupPath
        ? status.sessionStartBackupPath.split("/").pop()
        : null;
    return (_jsxs(FormCard, { title: "Backup status", children: [_jsx("p", { class: "ep:text-ui-smaller ep:text-obs-muted", children: "Startup snapshot is a safety copy only. It does not restore or overwrite your active database." }), _jsxs("p", { children: ["Last backup: ", lastBackup] }), _jsxs("p", { children: ["Next scheduled: ", nextBackup] }), _jsxs("p", { children: ["Reviews since last backup: ", status.reviewsSinceLastBackup] }), sessionStartFilename && _jsxs("p", { children: ["Startup snapshot: ", sessionStartFilename] })] }));
}
