import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { ModalFooter } from "@true-recall/obsidian/components/ModalFooter";
import { DatabaseItem } from "@true-recall/obsidian/modals/integration/device-selection/DatabaseItem";
import { RadioOption } from "@true-recall/obsidian/modals/integration/device-selection/RadioOption";
import { BasePromiseModal, } from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import { render } from "preact";
import { useCallback, useState } from "preact/hooks";
function DeviceSelectionBody({ databases, onResolve, onClose, }) {
    const [selectedAction, setSelectedAction] = useState("fresh");
    const [selectedDatabase, setSelectedDatabase] = useState(null);
    const canContinue = selectedAction === "fresh" ||
        (selectedAction === "import" && selectedDatabase !== null);
    const handleContinue = useCallback(() => {
        if (selectedAction === "fresh") {
            onResolve({ cancelled: false, action: "fresh" });
        }
        else if (selectedAction === "import" && selectedDatabase) {
            onResolve({
                cancelled: false,
                action: "import",
                sourceDeviceId: selectedDatabase.deviceId,
                sourcePath: selectedDatabase.path,
            });
        }
    }, [selectedAction, selectedDatabase, onResolve]);
    return (_jsxs(_Fragment, { children: [_jsx("div", { class: "ep:mb-4", children: _jsx("p", { children: "Choose how to initialize the database on this device:" }) }), _jsxs("div", { children: [_jsx(RadioOption, { value: "fresh", label: "Start fresh", description: "Create a new, empty database", checked: selectedAction === "fresh", onChange: () => setSelectedAction("fresh") }), databases.length > 0 && (_jsx(RadioOption, { value: "import", label: "Import from another device", description: "Copy data from an existing database", checked: selectedAction === "import", onChange: () => setSelectedAction("import") }))] }), selectedAction === "import" && databases.length > 0 && (_jsx("div", { class: "ep:ml-7 ep:mt-2 ep:mb-4", children: databases.map((db) => (_jsx(DatabaseItem, { db: db, isSelected: selectedDatabase === db, onSelect: () => setSelectedDatabase(db) }, db.deviceId))) })), _jsx(ModalFooter, { onCancel: onClose, onConfirm: handleContinue, confirmLabel: "Continue", confirmDisabled: !canContinue })] }));
}
export class DeviceSelectionModal extends BasePromiseModal {
    constructor(app, options) {
        super(app, {
            title: "True Recall database setup",
            width: "480px",
        });
        this.databases = options.databases;
        this.hasLegacy = options.hasLegacy;
    }
    getDefaultResult() {
        return { cancelled: true, action: "fresh" };
    }
    renderBody(container) {
        render(_jsx(DeviceSelectionBody, { databases: this.databases, onResolve: (result) => this.resolve(result), onClose: () => this.close() }), container);
    }
}
