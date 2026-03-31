import { jsx as _jsx } from "preact/jsx-runtime";
import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import { ObsidianProvider } from "@true-recall/obsidian/preact/ObsidianContext";
import { render } from "preact";
import { IOEditorApp } from "./IOEditorApp";
export class IOEditorModal extends BasePromiseModal {
    constructor(app, plugin, mode) {
        super(app, {
            title: mode.mode === "edit"
                ? "Edit image occlusion"
                : "Create image occlusion",
            width: "1120px",
        });
        this.plugin = plugin;
        this.mode = mode;
    }
    getDefaultResult() {
        return { cancelled: true };
    }
    renderBody(container) {
        render(_jsx(ObsidianProvider, { value: { app: this.app, plugin: this.plugin }, children: _jsx(IOEditorApp, { mode: this.mode, onDone: (result) => this.resolve(result) }) }), container);
    }
}
