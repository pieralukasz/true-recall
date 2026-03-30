import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useSettings } from "../../hooks/useSettings";
import { FormCard } from "@true-recall/obsidian/components";
import { useEffect, useState } from "preact/hooks";
function fmt(value) {
    return value ? new Date(value).toLocaleString() : "N/A";
}
function fmtPath(path) {
    return path !== null && path !== void 0 ? path : "N/A";
}
export function StorageDiagnosticsSection() {
    var _a;
    const { plugin } = useSettings();
    const [diag, setDiag] = useState(() => plugin.getStorageDiagnostics());
    useEffect(() => {
        setDiag(plugin.getStorageDiagnostics());
        const id = setInterval(() => setDiag(plugin.getStorageDiagnostics()), 5000);
        return () => clearInterval(id);
    }, [plugin]);
    return (_jsxs(FormCard, { title: "Storage diagnostics", children: [_jsx("p", { class: "ep:text-ui-smaller ep:text-obs-muted", children: "Read-only diagnostics for save/restore behavior in this session." }), _jsxs("p", { children: ["Active database path: ", fmtPath(diag.activeDatabasePath)] }), _jsxs("p", { children: ["Dirty state: ", diag.isDirty ? "yes" : "no"] }), _jsxs("p", { children: ["Save timer active: ", diag.saveTimerActive ? "yes" : "no"] }), _jsxs("p", { children: ["Flush in progress: ", diag.flushInProgress ? "yes" : "no"] }), _jsxs("p", { children: ["Last flush started: ", fmt(diag.lastFlushStartedAt)] }), _jsxs("p", { children: ["Last flush success: ", fmt(diag.lastFlushSucceededAt)] }), _jsxs("p", { children: ["Last flush failure: ", fmt(diag.lastFlushFailedAt)] }), _jsxs("p", { children: ["Last flush error: ", (_a = diag.lastFlushError) !== null && _a !== void 0 ? _a : "N/A"] }), _jsxs("p", { children: ["Startup snapshot path: ", fmtPath(diag.startupSnapshotPath)] }), _jsxs("p", { children: ["Last auto-recovery backup path: ", fmtPath(diag.lastAutoRecoveryPath)] }), _jsxs("p", { children: ["Last auto-recovery at: ", fmt(diag.lastAutoRecoveryAt)] })] }));
}
