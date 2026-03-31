import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { BackgroundBackupSection, BackupSettingsSection, BackupStatusSection, DeviceDatabaseSection, ImportExportSection, IntegrityCheckSection, ManualBackupSection, SmartRetentionSection, StorageDiagnosticsSection, } from "./data";
export function DataTab() {
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-3", children: [_jsx(DeviceDatabaseSection, {}), _jsx(ManualBackupSection, {}), _jsx(BackupSettingsSection, {}), _jsx(BackgroundBackupSection, {}), _jsx(SmartRetentionSection, {}), _jsx(BackupStatusSection, {}), _jsx(StorageDiagnosticsSection, {}), _jsx(IntegrityCheckSection, {}), _jsx(ImportExportSection, {})] }));
}
