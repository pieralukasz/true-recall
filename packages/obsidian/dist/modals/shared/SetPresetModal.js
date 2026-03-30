import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
import { ModalFooter } from "@true-recall/obsidian/components/ModalFooter";
import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import { render } from "preact";
function SetPresetBody({ presetNames, currentPreset, onResolve, }) {
    return (_jsxs(_Fragment, { children: [_jsxs("div", { class: "ep:border ep:border-obs-border ep:rounded-md ep:overflow-y-auto", style: "max-height: 240px", children: [_jsxs(Clickable, { class: "ep:bg-transparent ep:border-none ep:p-0 ep:font-inherit ep:text-left ep:w-full ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-2 ep:rounded-md hover:ep:bg-interactive-hover", onClick: () => onResolve({ cancelled: false, presetName: null }), stopPropagation: false, children: [_jsx("span", { class: "ep:text-ui-small", children: "Default (remove override)" }), !currentPreset && (_jsx("span", { class: "ep:text-ui-small ep:opacity-50", children: " (current)" }))] }), presetNames
                        .filter((n) => n !== "Default")
                        .map((name) => (_jsxs(Clickable, { class: "ep:bg-transparent ep:border-none ep:p-0 ep:font-inherit ep:text-left ep:w-full ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-2 ep:rounded-md hover:ep:bg-interactive-hover", onClick: () => onResolve({
                            cancelled: false,
                            presetName: name,
                        }), stopPropagation: false, children: [_jsx("span", { class: "ep:text-ui-small", children: name }), name === currentPreset && (_jsx("span", { class: "ep:text-ui-small ep:opacity-50", children: " (current)" }))] }, name)))] }), _jsx(ModalFooter, { onCancel: () => onResolve({ cancelled: true, presetName: null }), cancelLabel: "Cancel" })] }));
}
export class SetPresetModal extends BasePromiseModal {
    constructor(app, presetNames, currentPreset) {
        super(app, {
            title: "Set FSRS preset",
            width: "360px",
        });
        this.presetNames = presetNames;
        this.currentPreset = currentPreset;
    }
    getDefaultResult() {
        return { cancelled: true, presetName: null };
    }
    renderBody(container) {
        render(_jsx(SetPresetBody, { presetNames: this.presetNames, currentPreset: this.currentPreset, onResolve: (result) => this.resolve(result) }), container);
    }
}
