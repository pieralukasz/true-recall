import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { DeviceSelectionModal } from "@true-recall/obsidian/modals/integration/DeviceSelectionModal";
import { useSettings } from "../../hooks/useSettings";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { ActionButton, FormCard, FormField, InfoBlock, TextInput, } from "@true-recall/obsidian/components";
import { useCallback } from "preact/hooks";
export function DeviceDatabaseSection() {
    var _a, _b;
    const { plugin } = useSettings();
    const deviceId = ((_a = plugin.deviceIdService) === null || _a === void 0 ? void 0 : _a.getDeviceId()) || "unknown";
    const deviceLabel = (_b = plugin.deviceIdService) === null || _b === void 0 ? void 0 : _b.getDeviceLabel();
    const handleSwitchDatabase = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (!plugin.deviceDiscovery || !plugin.deviceIdService) {
            notify().error("Device services not initialized");
            return;
        }
        const databases = yield plugin.deviceDiscovery.discoverDeviceDatabases();
        const otherDevices = databases.filter((db) => !db.isCurrentDevice);
        if (otherDevices.length === 0) {
            notify().info("No other device databases available to import");
            return;
        }
        const modal = new DeviceSelectionModal(plugin.app, {
            databases: otherDevices,
            hasLegacy: false,
        });
        const result = yield modal.openAndWait();
        if (result.cancelled || result.action !== "import" || !result.sourcePath) {
            return;
        }
        const { confirm } = yield import("@true-recall/obsidian/modals/shared/ConfirmModal");
        const confirmed = yield confirm(plugin.app, {
            message: `Are you sure you want to replace the current database with data from device ${result.sourceDeviceId}?\n\nThe current database will be overwritten. This requires restarting Obsidian.`,
        });
        if (!confirmed)
            return;
        try {
            // Safety backup before database switch
            yield ((_a = plugin.backupService) === null || _a === void 0 ? void 0 : _a.createBackup());
            const currentDeviceId = (_b = plugin.deviceIdService) === null || _b === void 0 ? void 0 : _b.getDeviceId();
            const { normalizePath } = yield import("obsidian");
            const { DB_FOLDER, getDeviceDbFilename } = yield import("@true-recall/core/persistence/sqlite/sqlite.types");
            const targetPath = normalizePath(`${DB_FOLDER}/${getDeviceDbFilename(currentDeviceId)}`);
            const sourceData = yield plugin.app.vault.adapter.readBinary(result.sourcePath);
            yield plugin.app.vault.adapter.writeBinary(targetPath, sourceData);
            notify().success(`Imported data from device ${result.sourceDeviceId}. Please restart Obsidian.`);
        }
        catch (error) {
            console.error("[True Recall] Database switch failed:", error);
            notify().error("Failed to switch database.");
        }
    }), [plugin]);
    return (_jsxs(FormCard, { title: "Device database", children: [_jsxs(InfoBlock, { children: [_jsxs("p", { children: ["Device ID: ", _jsx("code", { children: deviceId })] }), _jsxs("p", { children: ["Database: ", _jsx("code", { children: `.true-recall/true-recall-${deviceId}.db` })] })] }), _jsx(FormField, { name: "Device name", description: "Optional name (stored locally)", children: _jsx(TextInput, { value: deviceLabel || "", onChange: (v) => { var _a; return (_a = plugin.deviceIdService) === null || _a === void 0 ? void 0 : _a.setDeviceLabel(v); }, placeholder: "e.g., work laptop, phone" }) }), _jsx(FormField, { name: "Switch database", description: "Import data from another device", children: _jsx(ActionButton, { label: "Switch...", variant: "primary", onClick: () => void handleSwitchDatabase() }) })] }));
}
