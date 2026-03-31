import { jsx as _jsx } from "preact/jsx-runtime";
import { BaseModal } from "@true-recall/obsidian/modals/shared/BaseModal";
import { PresetOptionsBody, } from "@true-recall/obsidian/modals/shared/preset-options/PresetOptionsBody";
import { ObsidianProvider } from "@true-recall/obsidian/preact/ObsidianContext";
import { render } from "preact";
export class PresetOptionsModal extends BaseModal {
    constructor(app, plugin, options = {}) {
        super(app, {
            title: "Preset Options",
            width: "560px",
        });
        this.plugin = plugin;
        this.options = options;
    }
    renderBody(container) {
        const context = this.options.contextPath
            ? {
                contextPath: this.options.contextPath,
                contextName: this.options.contextName,
            }
            : undefined;
        render(_jsx(ObsidianProvider, { value: { app: this.app, plugin: this.plugin }, children: _jsx(PresetOptionsBody, { initialPresetId: this.options.initialPresetId, context: context, onClose: () => this.close() }) }), container);
    }
}
