import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import { SetPresetModal } from "@true-recall/obsidian/modals/shared/SetPresetModal";
import { render } from "preact";
const SOURCE_LABELS = {
    note: "Note",
    parent: "Parent",
    default: "Default",
};
function ChainRow({ entry }) {
    var _a, _b;
    const label = SOURCE_LABELS[entry.source];
    const fileName = (_b = (_a = entry.sourcePath) === null || _a === void 0 ? void 0 : _a.split("/").pop()) === null || _b === void 0 ? void 0 : _b.replace(/\.md$/, "");
    return (_jsxs("div", { class: `ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-1.5 ep:rounded-md ${entry.active
            ? "ep:bg-obs-accent/10 ep:text-obs-text-normal"
            : "ep:text-obs-muted"}`, children: [_jsx("span", { class: `ep:w-2 ep:h-2 ep:rounded-full ep:shrink-0 ${entry.active ? "ep:bg-obs-accent" : "ep:bg-obs-modifier-border"}` }), _jsx("span", { class: "ep:text-ui-small ep:font-medium ep:w-16 ep:shrink-0", children: label }), fileName && entry.source !== "default" && (_jsx("span", { class: "ep:text-ui-smaller ep:opacity-60 ep:truncate ep:max-w-[140px]", children: fileName })), _jsx("span", { class: "ep:ml-auto ep:text-ui-small", children: entry.presetName ? (_jsx("span", { class: entry.active ? "ep:font-semibold" : "ep:opacity-50", children: entry.presetName })) : (_jsx("span", { class: "ep:opacity-30 ep:italic", children: "none" })) }), entry.active && (_jsx("span", { class: "ep:text-[10px] ep:text-obs-accent ep:shrink-0", children: "active" }))] }));
}
function PresetInspectorBody({ chain, effectivePresetName, onResolve, }) {
    return (_jsxs(_Fragment, { children: [_jsxs("div", { class: "ep:mb-3", children: [_jsx("div", { class: "ep:text-ui-small ep:text-obs-muted ep:mb-1", children: "Effective preset" }), _jsx("div", { class: "ep:text-lg ep:font-semibold ep:text-obs-text-normal", children: effectivePresetName })] }), _jsx("div", { class: "ep:text-ui-small ep:text-obs-muted ep:mb-1", children: "Inheritance chain" }), _jsx("div", { class: "ep:border ep:border-obs-border ep:rounded-md ep:overflow-hidden ep:mb-4", children: chain.map((entry) => (_jsx(ChainRow, { entry: entry }, entry.source))) }), _jsxs("div", { class: "ep-modal-footer ep:flex ep:justify-end ep:gap-2", children: [_jsx(Clickable, { class: "ep-btn ep-btn-outline", onClick: () => onResolve({ action: "clear" }), stopPropagation: false, children: "Clear note preset" }), _jsx(Clickable, { class: "ep-btn mod-cta", onClick: () => onResolve({ action: "set" }), stopPropagation: false, children: "Set preset..." })] })] }));
}
export class PresetInspectorModal extends BasePromiseModal {
    constructor(app, presetService, notePath, context) {
        super(app, {
            title: "FSRS Preset",
            width: "420px",
        });
        this.presetService = presetService;
        this.notePath = notePath;
        this.context = context;
    }
    getDefaultResult() {
        return { action: "cancel" };
    }
    renderBody(container) {
        const { chain, effective } = this.presetService.resolvePresetChain(this.notePath, this.context);
        render(_jsx(PresetInspectorBody, { chain: chain, effectivePresetName: effective.preset.name, onResolve: (result) => {
                if (result.action === "set") {
                    void this.openPresetPicker(result);
                }
                else {
                    this.resolve(result);
                }
            } }), container);
    }
    openPresetPicker(_partialResult) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const presetNames = this.presetService.getPresets().map((p) => p.name);
            const currentPreset = (_b = (_a = this.presetService.resolvePresetChain(this.notePath, this.context)
                .chain[0]) === null || _a === void 0 ? void 0 : _a.presetName) !== null && _b !== void 0 ? _b : null;
            const pickerModal = new SetPresetModal(this.app, presetNames, currentPreset);
            const pickerResult = yield pickerModal.openAndWait();
            if (!pickerResult.cancelled) {
                this.resolve({
                    action: "set",
                    presetName: (_c = pickerResult.presetName) !== null && _c !== void 0 ? _c : undefined,
                });
            }
        });
    }
}
