import { __awaiter } from "tslib";
import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "preact/jsx-runtime";
import { ExportScopeSelector, } from "@true-recall/obsidian/features/integration/components/ExportScopeSelector";
import { CsvExportService, } from "@true-recall/core/integration/csv/csv-export.service";
import { ObsidianSourceUidResolver } from "@true-recall/obsidian/adapters/ObsidianSourceUidResolver";
import { downloadBlob, resolveNotes, } from "@true-recall/obsidian/features/integration/utils/export-helpers";
import { Clickable } from "@true-recall/obsidian/components";
import { ModalFooter, PRIMARY_BTN, SECONDARY_BTN, } from "@true-recall/obsidian/components/ModalFooter";
import { OptionCheckbox } from "@true-recall/obsidian/components/OptionCheckbox";
import { BaseModal } from "@true-recall/obsidian/modals/shared/BaseModal";
import { render } from "preact";
import { useCallback, useRef, useState } from "preact/hooks";
function CsvExportBody({ totalCards, allNotes, onExport, onClose, }) {
    const [phase, setPhase] = useState({ type: "form" });
    const [exportMode, setExportMode] = useState("all");
    const [separator, setSeparator] = useState(",");
    const [includeScheduling, setIncludeScheduling] = useState(false);
    const selectedSourceUids = useRef(new Set());
    const handleToggleNote = useCallback((key, checked) => {
        if (checked)
            selectedSourceUids.current.add(key);
        else
            selectedSourceUids.current.delete(key);
    }, []);
    const handleExport = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        const result = yield onExport({
            exportMode,
            selectedSourceUids: selectedSourceUids.current,
            includeScheduling,
            separator,
        });
        setPhase(result);
    }), [exportMode, includeScheduling, separator, onExport]);
    if (phase.type === "success") {
        return (_jsxs(_Fragment, { children: [_jsx("div", { class: "ep:text-center ep:py-6", children: _jsxs("div", { class: "ep:text-ui-small ep:font-medium ep:text-green-500", children: ["Exported as ", phase.filename] }) }), _jsx("div", { class: "ep-modal-footer ep:flex ep:justify-end ep:gap-2", children: _jsx(Clickable, { stopPropagation: false, class: PRIMARY_BTN, onClick: onClose, children: "Done" }) })] }));
    }
    if (phase.type === "error") {
        return (_jsxs(_Fragment, { children: [_jsxs("div", { class: "ep:text-ui-small ep:text-red-500 ep:py-4 ep:text-center", children: ["Export failed: ", phase.message] }), _jsx("div", { class: "ep-modal-footer ep:flex ep:justify-end ep:gap-2", children: _jsx(Clickable, { stopPropagation: false, class: SECONDARY_BTN, onClick: onClose, children: "Close" }) })] }));
    }
    const separators = [
        { label: "Comma (,)", value: "," },
        { label: "Tab", value: "\t" },
        { label: "Semicolon (;)", value: ";" },
    ];
    return (_jsxs(_Fragment, { children: [_jsx(ExportScopeSelector, { exportMode: exportMode, onModeChange: setExportMode, totalCards: totalCards, allNotes: allNotes, selectedSourceUids: selectedSourceUids.current, onToggleNote: handleToggleNote }), _jsxs("div", { class: "ep:mb-4", children: [_jsx("div", { class: "ep:text-ui-small ep:font-medium ep:mb-2", children: "Separator" }), separators.map((sep) => {
                        const sepId = `csv-sep-${sep.label.replace(/[^a-zA-Z]/g, "")}`;
                        return (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:py-1", children: [_jsx("input", { id: sepId, type: "radio", name: "csv-separator", class: "ep:w-4 ep:h-4 ep:accent-obs-interactive", checked: separator === sep.value, onChange: () => setSeparator(sep.value) }), _jsx("label", { htmlFor: sepId, class: "ep:text-ui-small", children: sep.label })] }, sep.value));
                    })] }), _jsxs("div", { class: "ep:mb-4", children: [_jsx("div", { class: "ep:text-ui-small ep:font-medium ep:mb-2", children: "Options" }), _jsx(OptionCheckbox, { label: "Include scheduling data", description: "Adds State, Due, Interval, Lapses columns", checked: includeScheduling, onChange: setIncludeScheduling })] }), _jsx(ModalFooter, { onCancel: onClose, onConfirm: () => void handleExport(), cancelLabel: "Cancel", confirmLabel: "Export" })] }));
}
export class CsvExportModal extends BaseModal {
    constructor(app, store) {
        super(app, { title: "Export as CSV", width: "520px" });
        this.allNotes = [];
        this.store = store;
        this.allNotes = resolveNotes(this.app);
    }
    renderBody(container) {
        const totalCards = this.store.size();
        this.updateTitle(`Export as CSV (${totalCards} cards)`);
        render(_jsx(CsvExportBody, { totalCards: totalCards, allNotes: this.allNotes, onExport: (opts) => this.startExport(opts), onClose: () => this.close() }), container);
    }
    startExport(opts) {
        try {
            const service = new CsvExportService(this.store, new ObsidianSourceUidResolver(this.app));
            const { content, filename } = service.export({
                sourceUids: opts.exportMode === "notes"
                    ? [...opts.selectedSourceUids]
                    : undefined,
                includeScheduling: opts.includeScheduling,
                separator: opts.separator,
            });
            downloadBlob(content, filename, "text/plain;charset=utf-8");
            return { type: "success", filename };
        }
        catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            return { type: "error", message: errMsg };
        }
    }
}
